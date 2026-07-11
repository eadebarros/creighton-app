import type { Prisma } from '@prisma/client';
import { deriveRawCode, resolveCycleForNewEntry } from '@creighton/rules-engine';
import type { ActiveCycleSummary, LastEntrySummary } from '@creighton/rules-engine';
import { toIsoDate } from '../domain/mapping.js';
import type { EntryPayload } from '../validation/entries.js';
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
 * Processes a batch of offline-queued entries for one user, in date order
 * (never the array's arrival order — an out-of-order batch must still
 * resolve cycle boundaries correctly). The server is authoritative for the
 * cycle-open/close decision (same shared `resolveCycleForNewEntry` the app
 * itself runs) — the client's proposed `cycle.id`/`variantModeSnapshot` are
 * only used as the row's data on the (rare, single-device) occasions the
 * server agrees a new cycle should be created; a mismatch is logged, not
 * silently trusted, since Sprint 3's real dual-device conflict handling
 * doesn't exist yet.
 *
 * Idempotent twice over: a repeated entry `id` is a duplicate outright; a
 * fresh `id` that collides with an existing `(cycleId, date)` pair is also
 * treated as a duplicate rather than a second row for that day.
 *
 * Performance note: this talks to Postgres over Railway's public proxy
 * (100-300ms/round-trip is normal, unlike a local DB), so it deliberately
 * batches its reads — one query for "which of this batch's ids already
 * exist" and one for "the active cycle's existing dates" up front, then
 * tracks cycle/last-entry state in memory across the loop — instead of a
 * handful of queries per entry, which made a 20-day batch take 30+ seconds.
 *
 * Runs entirely inside the caller's transaction, finishing with one
 * `recomputeCycleFertilityStates` call per distinct cycle touched — cheap,
 * since it recomputes a whole cycle in one pass regardless of how many days
 * changed.
 */
export async function processEntryBatch(
  tx: Prisma.TransactionClient,
  userId: string,
  entries: EntryPayload[],
): Promise<EntryResult[]> {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const results: EntryResult[] = [];
  const touchedCycleIds = new Set<string>();

  const existingById = new Map(
    (
      await tx.dailyEntry.findMany({
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
  // Existing dates in the active cycle, fetched once — lets duplicate-date
  // detection stay in memory instead of a query per entry.
  const existingDatesInActiveCycle = new Set<string>(
    activeCycle
      ? (await tx.dailyEntry.findMany({ where: { cycleId: activeCycle.id }, select: { date: true } })).map((row) =>
          toIsoDate(row.date),
        )
      : [],
  );

  for (const payload of sorted) {
    const existingCycleId = existingById.get(payload.id);
    if (existingCycleId) {
      results.push({ id: payload.id, status: 'duplicate' });
      touchedCycleIds.add(existingCycleId);
      continue;
    }

    // A resubmission of a date that's already recorded (same day re-sent
    // with a fresh entry id, e.g. a retried outbox flush) is a duplicate
    // outright — checked BEFORE cycle-boundary resolution, since resolving
    // boundaries for a date that already exists in the active cycle could
    // otherwise decide to open a brand-new cycle using the client's
    // (already-used) proposed cycle id, colliding with the one it made for
    // the original submission.
    if (activeCycle && existingDatesInActiveCycle.has(payload.date)) {
      results.push({ id: payload.id, status: 'duplicate' });
      touchedCycleIds.add(activeCycle.id);
      continue;
    }

    const action = resolveCycleForNewEntry(activeCycle, payload.date, payload.bleedingType, lastEntry);

    let cycleId: string;
    if (action.type === 'OPEN_NEW') {
      if (action.closePreviousCycle) {
        await tx.cycle.update({
          where: { id: action.closePreviousCycle.id },
          data: { isActive: false, endDate: new Date(`${action.closePreviousCycle.endDate}T00:00:00Z`) },
        });
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
      existingDatesInActiveCycle.clear();
    } else {
      cycleId = action.cycleId;
    }

    if (payload.cycle.id !== cycleId) {
      console.warn(
        `entry ${payload.id} (date ${payload.date}): client cycle id ${payload.cycle.id} disagrees with server-resolved cycle ${cycleId}`,
      );
    }

    const { rawCode } = deriveRawCode(
      payload.mucusSensation,
      payload.mucusStretch,
      payload.mucusColor ?? undefined,
      payload.shinyReflex ?? undefined,
    );

    await tx.dailyEntry.create({
      data: {
        id: payload.id,
        cycleId,
        date: new Date(`${payload.date}T00:00:00Z`),
        bleedingType: payload.bleedingType,
        mucusSensation: payload.mucusSensation,
        mucusStretch: payload.mucusStretch,
        mucusColor: payload.mucusColor ?? null,
        shinyReflex: payload.shinyReflex ?? null,
        rawCode,
        intercourse: payload.intercourse,
        enteredAt: new Date(payload.enteredAt),
        entrySource: payload.entrySource,
      },
    });
    results.push({ id: payload.id, status: 'created' });
    touchedCycleIds.add(cycleId);

    // Update in-memory tracking for the next iteration — avoids re-querying
    // state this same transaction already knows, having just written it.
    activeCycle = { id: cycleId, startDate: activeCycle?.startDate ?? payload.date, hasEntries: true };
    lastEntry = { date: payload.date, bleedingType: payload.bleedingType };
    existingDatesInActiveCycle.add(payload.date);
  }

  for (const cycleId of touchedCycleIds) {
    await recomputeCycleFertilityStates(tx, cycleId);
  }

  // Return results in the caller's original (possibly unsorted) order.
  const resultById = new Map(results.map((r) => [r.id, r]));
  return entries.map((e) => resultById.get(e.id)!);
}
