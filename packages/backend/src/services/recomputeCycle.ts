import type { Prisma } from '@prisma/client';
import { computeFertilityStates, findConfirmedPeak, RULES_ENGINE_VERSION } from '@creighton/rules-engine';
import { entryToInput, toIsoDate } from '../domain/mapping.js';

/**
 * Recomputes every day's fertility state for a cycle from scratch (cheap —
 * `assignStates`/`findConfirmedPeak` already do a full pass per call) and
 * persists the result as versioned DAILY_FERTILITY_STATE rows: a new row is
 * only inserted when a day's (computedState, peakRelation) actually changed
 * vs. its current version — writing on every no-op call would defeat the
 * point of this table (an audit log of what changed, and when), per the
 * architecture doc's own reasoning (Seção 2).
 *
 * Must run inside a transaction: takes a Postgres advisory lock keyed on the
 * cycle id first, serializing any accidental concurrent recompute for the
 * same cycle (e.g. an HTTP retry racing an in-flight sync). Auto-released on
 * commit/rollback.
 */
export async function recomputeCycleFertilityStates(tx: Prisma.TransactionClient, cycleId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${cycleId}, 0))`;

  const cycle = await tx.cycle.findUniqueOrThrow({ where: { id: cycleId } });
  const entries = await tx.dailyEntry.findMany({ where: { cycleId }, orderBy: { date: 'asc' } });
  const inputs = entries.map(entryToInput);

  const computed = computeFertilityStates(inputs, cycle.variantModeSnapshot);

  // Zip rules-engine output back to entry rows by date — never by array
  // index. Both `entries` and `computed` happen to be date-ascending here,
  // but `UNIQUE(cycle_id, date)` already makes date the natural join key, so
  // there's no reason to depend on incidental ordering staying in sync.
  const entryIdByDate = new Map(entries.map((entry) => [toIsoDate(entry.date), entry.id]));

  // One query for every entry's current version, instead of one query per
  // day in the loop below — Railway's public proxy adds real per-round-trip
  // latency, and a cycle can be a few dozen days long.
  const currentStates = await tx.dailyFertilityState.findMany({
    where: { dailyEntryId: { in: [...entryIdByDate.values()] }, supersededById: null },
  });
  const currentByEntryId = new Map(currentStates.map((s) => [s.dailyEntryId, s]));

  for (const result of computed) {
    const entryId = entryIdByDate.get(result.date);
    if (!entryId) {
      continue; // Defensive — every computed result should map back to an entry we just loaded.
    }

    const current = currentByEntryId.get(entryId) ?? null;

    const pibActive = result.pibActive ?? false;

    if (!current) {
      await tx.dailyFertilityState.create({
        data: {
          dailyEntryId: entryId,
          computedState: result.computedState,
          peakRelation: result.peakRelation,
          pibActive,
          ruleEngineVersion: RULES_ENGINE_VERSION,
        },
      });
      continue;
    }

    const unchanged =
      current.computedState === result.computedState &&
      current.peakRelation === result.peakRelation &&
      current.pibActive === pibActive;
    if (unchanged) {
      continue;
    }

    const next = await tx.dailyFertilityState.create({
      data: {
        dailyEntryId: entryId,
        computedState: result.computedState,
        peakRelation: result.peakRelation,
        pibActive,
        ruleEngineVersion: RULES_ENGINE_VERSION,
      },
    });
    await tx.dailyFertilityState.update({
      where: { id: current.id },
      data: { supersededById: next.id },
    });
  }

  // Peak/Ápice tracking only applies to REGULAR (Seção 3.5 — Lactação has no
  // Tc/Ápice concept, only the PIB mechanism above). Peak confirmation is
  // set-once — findConfirmedPeak's state machine never un-confirms a peak
  // once found, so this never needs to un-set confirmedPeakDay.
  if (cycle.variantModeSnapshot === 'REGULAR') {
    const peakResult = findConfirmedPeak(inputs);
    if (peakResult.confirmed !== null && cycle.confirmedPeakDay === null) {
      await tx.cycle.update({
        where: { id: cycleId },
        data: {
          confirmedPeakDay: new Date(`${peakResult.confirmed.date}T00:00:00Z`),
          peakDayConfirmedAt: new Date(),
        },
      });
    }
  }
}
