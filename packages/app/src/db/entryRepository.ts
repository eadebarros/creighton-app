import { computeFertilityStates, deriveRawCode, resolveCycleForNewEntry } from '@creighton/rules-engine';
import type { DailyFertilityState } from '@creighton/rules-engine';
import { answersToEntryInput, entryInputToRowValues, rowToEntryInput } from '../domain/mapping';
import type { CaptureAnswers, DailyEntryRow } from '../domain/mapping';
import { closeCycle, createCycle, getActiveCycle } from './cycleRepository';
import type { SqlExecutor } from './executor';

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
  const states = computeFertilityStates(rows.map(rowToEntryInput), 'REGULAR');
  return rows.map((row, i) => ({ row, state: states[i]! }));
}

/**
 * Records today's capture-flow answers: resolves which cycle the entry
 * belongs to (opening/closing as needed per domain/cycleBoundary.ts),
 * derives raw_code, and writes the daily_entries row.
 *
 * Sprint 1 only ever captures today's date (no backdating UI) — registering
 * the same day twice replaces that day's row via SQLite's own ON CONFLICT
 * resolution against UNIQUE(cycle_id, date). This is a narrow allowance for
 * same-day re-entry, not a general edit-history feature: DAILY_ENTRY stays
 * conceptually immutable for any day once the user has moved on from it.
 */
export async function recordEntry(
  db: SqlExecutor,
  answers: CaptureAnswers,
  date: string,
  newId: () => string,
): Promise<{ cycleId: string }> {
  const activeCycle = await getActiveCycle(db);
  const lastEntry = activeCycle ? await getMostRecentEntry(db, activeCycle.id) : null;
  const action = resolveCycleForNewEntry(activeCycle, date, answers.bleedingType, lastEntry);

  let cycleId: string;
  if (action.type === 'OPEN_NEW') {
    if (action.closePreviousCycle) {
      await closeCycle(db, action.closePreviousCycle.id, action.closePreviousCycle.endDate);
    }
    cycleId = await createCycle(db, action.startDate, newId);
  } else {
    cycleId = action.cycleId;
  }

  const entryInput = answersToEntryInput(answers, date);
  const { rawCode } = deriveRawCode(
    entryInput.mucusSensation,
    entryInput.mucusStretch,
    entryInput.mucusColor,
    entryInput.shinyReflex,
  );
  const values = entryInputToRowValues(entryInput, rawCode);
  const id = newId();
  const enteredAt = new Date().toISOString();

  // recordEntry always mints a fresh id, so re-registering today replaces
  // the row via the UNIQUE(cycle_id, date) conflict below — which would
  // otherwise leave the old id's sync_outbox row orphaned (pointing at a
  // daily_entries row that's about to disappear). Clean it up first.
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM daily_entries WHERE cycle_id = ? AND date = ?',
    [cycleId, date],
  );
  if (existing) {
    await db.runAsync('DELETE FROM sync_outbox WHERE entry_id = ?', [existing.id]);
  }

  await db.runAsync(
    `INSERT OR REPLACE INTO daily_entries
       (id, cycle_id, date, bleeding_type, mucus_sensation, mucus_stretch, mucus_color, shiny_reflex, raw_code, intercourse, entered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      cycleId,
      date,
      values.bleeding_type,
      values.mucus_sensation,
      values.mucus_stretch,
      values.mucus_color,
      values.shiny_reflex,
      values.raw_code,
      values.intercourse,
      enteredAt,
    ],
  );

  await db.runAsync('INSERT INTO sync_outbox (entry_id, queued_at) VALUES (?, ?)', [id, enteredAt]);

  return { cycleId };
}
