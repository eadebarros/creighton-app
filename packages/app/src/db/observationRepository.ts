import { deriveRawCode, pickDailyPeak, resolveCycleForNewEntry } from '@creighton/rules-engine';
import type {
  BleedingType,
  MucusColor,
  MucusSensation,
  MucusStretch,
  Observation as EngineObservation,
  VariantMode,
} from '@creighton/rules-engine';
import { answersToEntryInput, entryInputToRowValues } from '../domain/mapping';
import type { CaptureAnswers } from '../domain/mapping';
import { closeCycle, createCycle, getActiveCycle } from './cycleRepository';
import { getMostRecentEntry } from './entryRepository';
import type { SqlExecutor } from './executor';

/** Shape of an observations row as SQLite stores it (booleans as 0/1, optionals as null). */
export interface ObservationRow {
  id: string;
  cycle_id: string;
  date: string;
  observed_at: string;
  bleeding_type: BleedingType;
  mucus_sensation: MucusSensation;
  mucus_stretch: MucusStretch;
  mucus_color: MucusColor | null;
  shiny_reflex: number | null;
  raw_code: string;
  intercourse: number;
  voided: number;
  voided_at: string | null;
}

function toEngineObservation(row: ObservationRow): EngineObservation {
  return {
    id: row.id,
    date: row.date,
    observedAt: row.observed_at,
    bleedingType: row.bleeding_type,
    mucusSensation: row.mucus_sensation,
    mucusStretch: row.mucus_stretch,
    mucusColor: row.mucus_color ?? undefined,
    shinyReflex: row.shiny_reflex === null ? undefined : row.shiny_reflex === 1,
    intercourse: row.intercourse === 1,
  };
}

/** Every observation of a given (cycle, date), in the order they were taken — for the "anular" UI. */
export async function getObservationsForDate(db: SqlExecutor, cycleId: string, date: string): Promise<ObservationRow[]> {
  return db.getAllAsync<ObservationRow>(
    'SELECT * FROM observations WHERE cycle_id = ? AND date = ? ORDER BY observed_at ASC',
    [cycleId, date],
  );
}

/**
 * Adendo 01 — recomputes the day's `daily_entries` row (the "peak of the
 * day") from every non-voided observation for (cycleId, date), and upserts
 * it. `dailyEntryId` is this app's own stable id for that (cycle, date) —
 * the caller is responsible for reusing the SAME id across every observation
 * of the day (see `recordObservation`), so it stays identical to whatever
 * the backend consolidates to under the same trust model already used for
 * `cycle.id`.
 *
 * If voiding leaves zero observations for the day, there's no peak left —
 * the derived row (and its confirmed_fertility_states shadow, if any) is
 * deleted instead of left stale.
 */
export async function consolidateDay(db: SqlExecutor, cycleId: string, date: string, dailyEntryId: string): Promise<void> {
  const rows = await db.getAllAsync<ObservationRow>(
    'SELECT * FROM observations WHERE cycle_id = ? AND date = ? AND voided = 0',
    [cycleId, date],
  );

  if (rows.length === 0) {
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM daily_entries WHERE cycle_id = ? AND date = ?',
      [cycleId, date],
    );
    if (existing) {
      await db.runAsync('DELETE FROM confirmed_fertility_states WHERE daily_entry_id = ?', [existing.id]);
      await db.runAsync('DELETE FROM daily_entries WHERE id = ?', [existing.id]);
    }
    return;
  }

  const consolidation = pickDailyPeak(rows.map(toEngineObservation));
  const peak = rows.find((r) => r.id === consolidation.peakObservationId)!;

  await db.runAsync(
    `INSERT OR REPLACE INTO daily_entries
       (id, cycle_id, date, bleeding_type, mucus_sensation, mucus_stretch, mucus_color, shiny_reflex, raw_code, intercourse, entered_at, peak_observation_id, consolidated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dailyEntryId,
      cycleId,
      date,
      consolidation.bleedingType,
      peak.mucus_sensation,
      peak.mucus_stretch,
      peak.mucus_color,
      peak.shiny_reflex,
      peak.raw_code,
      consolidation.intercourse ? 1 : 0,
      peak.observed_at,
      peak.id,
      new Date().toISOString(),
    ],
  );
}

/**
 * Records one intraday check (Adendo 01) — the capture flow's write
 * entrypoint, replacing the old `recordEntry`. Always inserts a brand-new
 * `observations` row (never overwrites a prior check of the same day) and
 * queues it for sync, then reconsolidates the day's peak.
 */
export async function recordObservation(
  db: SqlExecutor,
  answers: CaptureAnswers,
  date: string,
  newId: () => string,
  getVariantMode: () => Promise<VariantMode>,
): Promise<{ cycleId: string }> {
  const activeCycle = await getActiveCycle(db);
  const lastEntry = activeCycle ? await getMostRecentEntry(db, activeCycle.id) : null;
  const action = resolveCycleForNewEntry(activeCycle, date, answers.bleedingType, lastEntry);

  let cycleId: string;
  if (action.type === 'OPEN_NEW') {
    if (action.closePreviousCycle) {
      await closeCycle(db, action.closePreviousCycle.id, action.closePreviousCycle.endDate);
    }
    const variantMode = await getVariantMode();
    cycleId = await createCycle(db, action.startDate, newId, variantMode);
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
  const observationId = newId();
  const observedAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO observations
       (id, cycle_id, date, observed_at, bleeding_type, mucus_sensation, mucus_stretch, mucus_color, shiny_reflex, raw_code, intercourse)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      observationId,
      cycleId,
      date,
      observedAt,
      values.bleeding_type,
      values.mucus_sensation,
      values.mucus_stretch,
      values.mucus_color,
      values.shiny_reflex,
      values.raw_code,
      values.intercourse,
    ],
  );
  await db.runAsync('INSERT INTO sync_outbox (observation_id, queued_at) VALUES (?, ?)', [observationId, observedAt]);

  // Reuse the day's existing derived-row id if one already exists (a 2nd+
  // observation of the same day) — otherwise mint a fresh one.
  const existingEntry = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM daily_entries WHERE cycle_id = ? AND date = ?',
    [cycleId, date],
  );
  const dailyEntryId = existingEntry?.id ?? newId();
  await consolidateDay(db, cycleId, date, dailyEntryId);

  return { cycleId };
}

/** Marks an observation as anulada (never deleted/edited in place) and reconsolidates its day. */
export async function voidObservation(db: SqlExecutor, observationId: string): Promise<void> {
  const row = await db.getFirstAsync<{ cycle_id: string; date: string }>(
    'SELECT cycle_id, date FROM observations WHERE id = ?',
    [observationId],
  );
  if (!row) {
    return;
  }
  await db.runAsync('UPDATE observations SET voided = 1, voided_at = ? WHERE id = ?', [
    new Date().toISOString(),
    observationId,
  ]);

  const existingEntry = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM daily_entries WHERE cycle_id = ? AND date = ?',
    [row.cycle_id, row.date],
  );
  await consolidateDay(db, row.cycle_id, row.date, existingEntry?.id ?? observationId);
}
