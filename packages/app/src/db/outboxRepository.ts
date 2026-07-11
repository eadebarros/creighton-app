import type { OutboxPayloadEntry } from '../api/client';
import type { SqlExecutor } from './executor';

export interface PendingOutboxEntry {
  observationId: string;
  queuedAt: string;
  attemptCount: number;
}

export async function getPendingOutboxEntries(db: SqlExecutor): Promise<PendingOutboxEntry[]> {
  const rows = await db.getAllAsync<{ observation_id: string; queued_at: string; attempt_count: number }>(
    'SELECT observation_id, queued_at, attempt_count FROM sync_outbox WHERE synced_at IS NULL ORDER BY queued_at ASC',
    [],
  );
  return rows.map((row) => ({
    observationId: row.observation_id,
    queuedAt: row.queued_at,
    attemptCount: row.attempt_count,
  }));
}

export async function markOutboxSynced(db: SqlExecutor, observationIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  for (const observationId of observationIds) {
    await db.runAsync('UPDATE sync_outbox SET synced_at = ? WHERE observation_id = ?', [now, observationId]);
  }
}

export async function markOutboxFailed(db: SqlExecutor, observationId: string, error: string): Promise<void> {
  await db.runAsync(
    'UPDATE sync_outbox SET attempt_count = attempt_count + 1, last_error = ? WHERE observation_id = ?',
    [error, observationId],
  );
}

interface JoinedRow {
  id: string;
  cycle_id: string;
  date: string;
  bleeding_type: OutboxPayloadEntry['bleedingType'];
  mucus_sensation: OutboxPayloadEntry['mucusSensation'];
  mucus_stretch: OutboxPayloadEntry['mucusStretch'];
  mucus_color: OutboxPayloadEntry['mucusColor'];
  shiny_reflex: number | null;
  intercourse: number;
  observed_at: string;
  cycle_start_date: string;
  cycle_end_date: string | null;
  cycle_is_active: number;
  cycle_variant_mode_snapshot: OutboxPayloadEntry['cycle']['variantModeSnapshot'];
  daily_entry_id: string | null;
}

/**
 * Joins each pending outbox row (now an Observation, Adendo 01) with its
 * cycle data — and the day's consolidated `daily_entries.id`, which
 * `consolidateDay` always creates synchronously right after the observation
 * itself is written, so it's expected to already exist by the time this
 * flushes. An observation whose row has vanished (shouldn't normally happen,
 * observations are append-only) is silently skipped rather than sent as a gap.
 */
export async function buildOutboxPayload(db: SqlExecutor, observationIds: string[]): Promise<OutboxPayloadEntry[]> {
  const payload: OutboxPayloadEntry[] = [];
  for (const observationId of observationIds) {
    const row = await db.getFirstAsync<JoinedRow>(
      `SELECT o.id, o.cycle_id, o.date, o.bleeding_type, o.mucus_sensation, o.mucus_stretch, o.mucus_color,
              o.shiny_reflex, o.intercourse, o.observed_at,
              c.start_date as cycle_start_date, c.end_date as cycle_end_date,
              c.is_active as cycle_is_active, c.variant_mode_snapshot as cycle_variant_mode_snapshot,
              e.id as daily_entry_id
       FROM observations o
       JOIN cycles c ON c.id = o.cycle_id
       LEFT JOIN daily_entries e ON e.cycle_id = o.cycle_id AND e.date = o.date
       WHERE o.id = ?`,
      [observationId],
    );
    if (!row || !row.daily_entry_id) {
      continue;
    }
    payload.push({
      id: row.id,
      dailyEntryId: row.daily_entry_id,
      cycle: {
        id: row.cycle_id,
        startDate: row.cycle_start_date,
        endDate: row.cycle_end_date,
        isActive: row.cycle_is_active === 1,
        variantModeSnapshot: row.cycle_variant_mode_snapshot,
      },
      date: row.date,
      bleedingType: row.bleeding_type,
      mucusSensation: row.mucus_sensation,
      mucusStretch: row.mucus_stretch,
      mucusColor: row.mucus_color,
      shinyReflex: row.shiny_reflex === null ? null : row.shiny_reflex === 1,
      intercourse: row.intercourse === 1,
      enteredAt: row.observed_at,
      entrySource: 'USER',
    });
  }
  return payload;
}
