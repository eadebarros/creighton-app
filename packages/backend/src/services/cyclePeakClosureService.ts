import type { Prisma } from '@prisma/client';
import { assignStates, computeFertilityStates, confirmPeakOnCycleClose, findConfirmedPeak } from '@creighton/rules-engine';
import type { DailyEntryInput, PeakTrackerState, VariantMode } from '@creighton/rules-engine';
import { entryToInput, toIsoDate } from '../domain/mapping.js';
import { persistComputedStates } from './recomputeCycle.js';

/**
 * Ápice/Tc tracking doesn't apply to Lactação at all (Adendo 01) — never run
 * `findConfirmedPeak` on its raw-code patterns, which could spuriously look
 * "peak-type" (e.g. a real mucus day during lactation) without meaning
 * anything clinically. Forcing NONE here means Lactação cycles always
 * passthrough to UNCONFIRMED_CLOSED with no candidate — a safe "not
 * applicable" outcome, never a false CONFIRMED cascade.
 */
function toPeakTrackerState(variantMode: VariantMode, inputs: DailyEntryInput[]): PeakTrackerState {
  if (variantMode === 'LACTATION') {
    return { type: 'NONE' };
  }
  const peakResult = findConfirmedPeak(inputs);
  if (peakResult.confirmed) {
    return { type: 'CONFIRMED', date: peakResult.confirmed.date };
  }
  if (peakResult.lastCandidateDate) {
    return { type: 'CANDIDATE', date: peakResult.lastCandidateDate };
  }
  return { type: 'NONE' };
}

/**
 * Adendo 02 — decides and persists a cycle's Ápice resolution at the moment
 * it closes (the "cycle-close" event, which already exists in
 * entryService.ts's cycle-boundary resolution). Also re-run by
 * `maybeReprocessClosedCyclePeak` whenever a closed cycle's entries change
 * afterward.
 */
export async function resolvePeakOnCycleClose(
  tx: Prisma.TransactionClient,
  closedCycleId: string,
  nextCycleStartDate: string,
): Promise<void> {
  const cycle = await tx.cycle.findUniqueOrThrow({ where: { id: closedCycleId } });
  const entries = await tx.dailyEntry.findMany({ where: { cycleId: closedCycleId }, orderBy: { date: 'asc' } });
  const inputs = entries.map(entryToInput);

  const peakTracker = toPeakTrackerState(cycle.variantModeSnapshot, inputs);
  const result = confirmPeakOnCycleClose({
    closingCycle: { variantMode: cycle.variantModeSnapshot, peakTracker, entries: inputs },
    nextCycleStartDate,
  });

  if (result.resolution === 'CONFIRMED') {
    await tx.cycle.update({
      where: { id: closedCycleId },
      data: {
        peakResolution: 'CONFIRMED',
        peakCandidateDate: new Date(`${result.peakDay}T00:00:00Z`),
        confirmedPeakDay: new Date(`${result.peakDay}T00:00:00Z`),
        peakDayConfirmedAt: cycle.peakDayConfirmedAt ?? new Date(),
      },
    });
    // Retroactive cascade using the cross-cycle-validated Tc — may differ
    // from whatever the ongoing per-entry recompute had been showing
    // (MENOPAUSE deliberately suppresses this until now; and even for
    // REGULAR, an earlier candidate could be the one that's truly confirmed).
    const computed = assignStates(inputs, { confirmed: { date: result.peakDay }, lastCandidateDate: result.peakDay });
    await persistComputedStates(tx, entries, computed);
  } else {
    await tx.cycle.update({
      where: { id: closedCycleId },
      data: {
        peakResolution: 'UNCONFIRMED_CLOSED',
        peakCandidateDate: result.lastCandidate ? new Date(`${result.lastCandidate}T00:00:00Z`) : null,
      },
    });
    // Re-run the normal (non-cross-cycle) computation and persist it — a
    // no-op if nothing had ever been confirmed (the usual first-closure
    // case), but essential when reprocessing REVERTS a previously-CONFIRMED
    // cascade (Seção 2.4/critério f): the stale P/P+n/INFERTILE_ABSOLUTE
    // states must be superseded back to the FERTILE default, never just
    // left in place.
    const fertileDefault = computeFertilityStates(inputs, cycle.variantModeSnapshot);
    await persistComputedStates(tx, entries, fertileDefault);
  }
}

/**
 * A closed cycle whose peak resolution was already decided can still change
 * later — an observation voided or added after the fact (Seção 2.4). Re-runs
 * the closure decision idempotently; safe to call after every recompute,
 * even for cycles that were never MENOPAUSE or never had a resolution
 * change (persistComputedStates already no-ops on unchanged days).
 */
export async function maybeReprocessClosedCyclePeak(tx: Prisma.TransactionClient, cycleId: string): Promise<void> {
  const cycle = await tx.cycle.findUniqueOrThrow({ where: { id: cycleId } });
  if (cycle.isActive || cycle.peakResolution === 'PENDING') {
    return;
  }
  const nextCycle = await tx.cycle.findFirst({
    where: { userId: cycle.userId, startDate: { gt: cycle.startDate } },
    orderBy: { startDate: 'asc' },
  });
  if (!nextCycle) {
    return; // Defensive — a closed cycle should always have a successor by construction.
  }
  await resolvePeakOnCycleClose(tx, cycleId, toIsoDate(nextCycle.startDate));
}
