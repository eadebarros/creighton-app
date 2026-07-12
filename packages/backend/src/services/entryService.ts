import type { Prisma } from '@prisma/client';
import { deriveRawCode, resolveCycleForNewEntry } from '@creighton/rules-engine';
import type { ActiveCycleSummary, LastEntrySummary } from '@creighton/rules-engine';
import { toIsoDate } from '../domain/mapping.js';
import type { EntryPayload } from '../validation/entries.js';
import { consolidateDay } from './dailyConsolidationService.js';
import { maybeReprocessClosedCyclePeak, resolvePeakOnCycleClose } from './cyclePeakClosureService.js';
import { recomputeCycleFertilityStates } from './recomputeCycle.js';

export interface EntryResult {
  id: string;
  status: 'created' | 'duplicate';
}

async function getActiveCycleSummary(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<ActiveCycleSummary | null> {
  const cycle = await tx.cycle.findFirst({ where: { userId, isActive: true } });
  if (!cycle) {
    return null;
  }
  const count = await tx.dailyEntry.count({ where: { cycleId: cycle.id } });
  return { id: cycle.id, startDate: toIsoDate(cycle.startDate), hasEntries: count > 0 };
}

/**
 * Processes a batch of offline-queued Observations for one user, in date
 * order (Adendo 01 — each payload is now a raw intraday observation, not a
 * direct write to the derived DailyEntry). The server is authoritative for
 * the cycle-open/close decision, resolved once per DISTINCT date in the
 * batch — not once per observation, since a second same-day observation must
 * never re-run cycle-boundary resolution (it would wrongly see "today" as a
 * fresh flow candidate against yesterday's already-updated in-memory state).
 * The client's proposed `cycle.id`/`variantModeSnapshot` are only used as the
 * row's data on the occasions the server agrees a new cycle should be
 * created; a mismatch is logged, not silently trusted (Sprint 3's real
 * dual-device conflict handling doesn't exist yet).
 *
 * Idempotent on a repeated observation `id` (duplicate outright, no-op) —
 * but a genuinely new observation for an already-used date is NOT a
 * duplicate anymore: multiple observations per day is the normal case now,
 * each one triggers reconsolidation of that day's peak.
 *
 * Runs entirely inside the caller's transaction. After the loop: one
 * `consolidateDay` per distinct (cycleId, date) touched, then one
 * `recomputeCycleFertilityStates` per distinct cycle touched (in that order
 * — consolidate before recomputing, since recompute reads DailyEntry).
 */
export async function processObservationBatch(
  tx: Prisma.TransactionClient,
  userId: string,
  entries: EntryPayload[],
): Promise<EntryResult[]> {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const results: EntryResult[] = [];
  const touchedDates = new Map<string, string>(); // date -> cycleId
  const dailyEntryIdByDate = new Map<string, string>();
  const touchedCycleIds = new Set<string>();

  const existingById = new Map(
    (
      await tx.observation.findMany({
        where: { id: { in: sorted.map((e) => e.id) } },
        select: { id: true, cycleId: true },
      })
    ).map((row) => [row.id, row.cycleId]),
  );

  let activeCycle = await getActiveCycleSummary(tx, userId);
  let lastEntry: LastEntrySummary | null = activeCycle
    ? await (async () => {
        const entry = await tx.dailyEntry.findFirst({
          where: { cycleId: activeCycle!.id },
          orderBy: { date: 'desc' },
        });
        return entry ? { date: toIsoDate(entry.date), bleedingType: entry.bleedingType } : null;
      })()
    : null;
  // date -> cycleId already established: either a pre-existing DailyEntry, or
  // a date already resolved earlier in this same batch.
  const cycleIdByDate = new Map<string, string>(
    activeCycle
      ? (await tx.dailyEntry.findMany({ where: { cycleId: activeCycle.id }, select: { date: true } })).map((row) => [
          toIsoDate(row.date),
          activeCycle!.id,
        ])
      : [],
  );

  for (const payload of sorted) {
    dailyEntryIdByDate.set(payload.date, payload.dailyEntryId);

    const existingCycleId = existingById.get(payload.id);
    if (existingCycleId) {
      results.push({ id: payload.id, status: 'duplicate' });
      touchedDates.set(payload.date, existingCycleId);
      touchedCycleIds.add(existingCycleId);
      continue;
    }

    let cycleId = cycleIdByDate.get(payload.date);
    if (!cycleId) {
      const action = resolveCycleForNewEntry(activeCycle, payload.date, payload.bleedingType, lastEntry);
      if (action.type === 'OPEN_NEW') {
        if (action.closePreviousCycle) {
          await tx.cycle.update({
            where: { id: action.closePreviousCycle.id },
            data: { isActive: false, endDate: new Date(`${action.closePreviousCycle.endDate}T00:00:00Z`) },
          });
          // Adendo 02 — the real bleeding that just closed this cycle is
          // exactly the event `confirmPeakOnCycleClose` needs (cross-cycle
          // Ápice validation for MENOPAUSE; passthrough for everything else).
          await resolvePeakOnCycleClose(tx, action.closePreviousCycle.id, action.startDate);
        }
        const created = await tx.cycle.create({
          data: {
            id: payload.cycle.id,
            userId,
            startDate: new Date(`${action.startDate}T00:00:00Z`),
            isActive: true,
            variantModeSnapshot: payload.cycle.variantModeSnapshot,
          },
        });
        cycleId = created.id;
        activeCycle = { id: cycleId, startDate: action.startDate, hasEntries: false };
      } else {
        cycleId = action.cycleId;
      }
      cycleIdByDate.set(payload.date, cycleId);

      if (payload.cycle.id !== cycleId) {
        console.warn(
          `observation ${payload.id} (date ${payload.date}): client cycle id ${payload.cycle.id} disagrees with server-resolved cycle ${cycleId}`,
        );
      }
    }

    const { rawCode } = deriveRawCode(
      payload.mucusSensation,
      payload.mucusStretch,
      payload.mucusColor ?? undefined,
      payload.shinyReflex ?? undefined,
    );

    await tx.observation.create({
      data: {
        id: payload.id,
        cycleId,
        date: new Date(`${payload.date}T00:00:00Z`),
        observedAt: new Date(payload.enteredAt),
        bleedingType: payload.bleedingType,
        mucusSensation: payload.mucusSensation,
        mucusStretch: payload.mucusStretch,
        mucusColor: payload.mucusColor ?? null,
        shinyReflex: payload.shinyReflex ?? null,
        rawCode,
        intercourse: payload.intercourse,
        entrySource: payload.entrySource,
      },
    });
    results.push({ id: payload.id, status: 'created' });
    touchedDates.set(payload.date, cycleId);
    touchedCycleIds.add(cycleId);

    // Update in-memory tracking for the next iteration — avoids re-querying
    // state this same transaction already knows, having just written it.
    activeCycle = { id: cycleId, startDate: activeCycle?.startDate ?? payload.date, hasEntries: true };
    lastEntry = { date: payload.date, bleedingType: payload.bleedingType };
  }

  for (const [date, cycleId] of touchedDates) {
    await consolidateDay(tx, cycleId, new Date(`${date}T00:00:00Z`), dailyEntryIdByDate.get(date)!);
  }
  for (const cycleId of touchedCycleIds) {
    await recomputeCycleFertilityStates(tx, cycleId);
    // Adendo 02, Seção 2.4 — a backdated/retried batch could touch a cycle
    // that's already closed and resolved; re-decide its peak resolution.
    await maybeReprocessClosedCyclePeak(tx, cycleId);
  }

  // Return results in the caller's original (possibly unsorted) order.
  const resultById = new Map(results.map((r) => [r.id, r]));
  return entries.map((e) => resultById.get(e.id)!);
}
