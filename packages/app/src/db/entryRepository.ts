import { computeFertilityStates } from '@creighton/rules-engine';
import type { DailyFertilityState } from '@creighton/rules-engine';
import { rowToEntryInput } from '../domain/mapping';
import type { DailyEntryRow } from '../domain/mapping';
import { getCycleVariantMode } from './cycleRepository';
import type { SqlExecutor } from './executor';

/**
 * `daily_entries` is now the derived "peak of the day" row (Adendo 01) —
 * writes only ever happen through `observationRepository.ts`'s consolidator.
 * These read-only helpers are unaffected: the rules engine still consumes
 * this exact table exactly as before, no rule changes here, only the origin
 * of the data.
 */
export async function getEntriesForCycle(db: SqlExecutor, cycleId: string): Promise<DailyEntryRow[]> {
  return db.getAllAsync<DailyEntryRow>(
    'SELECT * FROM daily_entries WHERE cycle_id = ? ORDER BY date ASC',
    [cycleId],
  );
}

/** The most recent entry in a cycle (by date), or null if it has none yet. */
export async function getMostRecentEntry(
  db: SqlExecutor,
  cycleId: string,
): Promise<{ date: string; bleedingType: DailyEntryRow['bleeding_type'] } | null> {
  const row = await db.getFirstAsync<{ date: string; bleeding_type: DailyEntryRow['bleeding_type'] }>(
    'SELECT date, bleeding_type FROM daily_entries WHERE cycle_id = ? ORDER BY date DESC LIMIT 1',
    [cycleId],
  );
  return row ? { date: row.date, bleedingType: row.bleeding_type } : null;
}

/** Whether a cycle already has an entry for the given date. */
export async function hasEntryForDate(db: SqlExecutor, cycleId: string, date: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM daily_entries WHERE cycle_id = ? AND date = ?',
    [cycleId, date],
  );
  return (row?.count ?? 0) > 0;
}

/** Each entry's raw row alongside its rules-engine-computed fertility state, in date order. */
export async function getFertilityStatesForCycle(
  db: SqlExecutor,
  cycleId: string,
): Promise<{ row: DailyEntryRow; state: DailyFertilityState }[]> {
  const rows = await getEntriesForCycle(db, cycleId);
  const variantMode = await getCycleVariantMode(db, cycleId);
  const states = computeFertilityStates(rows.map(rowToEntryInput), variantMode);
  return rows.map((row, i) => ({ row, state: states[i]! }));
}
