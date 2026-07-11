import type { OutboxPayloadEntry } from '../api/client';
import type { SqlExecutor } from './executor';

export interface PendingOutboxEntry {
  entryId: string;
  queuedAt: string;
  attemptCount: number;
}

export async function getPendingOutboxEntries(db: SqlExecutor): Promise<PendingOutboxEntry[]> {
  const rows = await db.getAllAsync<{ entry_id: string; queued_at: string; attempt_count: number }>(
    'SELECT entry_id, queued_at, attempt_count FROM sync_outbox WHERE synced_at IS NULL ORDER BY queued_at ASC',
    [],
  );
  return rows.map((row) => ({ entryId: row.entry_id, queuedAt: row.queued_at, attemptCount: row.attempt_count }));
}

export async function markOutboxSynced(db: SqlExecutor, entryIds: string[]): Promise<void> {
  const now = new Date().toISOString();
  for (const entryId of entryIds) {
    await db.runAsync('UPDATE sync_outbox SET synced_at = ? WHERE entry_id = ?', [now, entryId]);
  }
}

export async function markOutboxFailed(db: SqlExecutor, entryId: string, error: string): Promise<void> {
  await db.runAsync(
    'UPDATE sync_outbox SET attempt_count = attempt_count + 1, last_error = ? WHERE entry_id = ?',
    [error, entryId],
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
  entered_at: string;
  cycle_start_date: string;
  cycle_end_date: string | null;
  cycle_is_active: number;
  cycle_variant_mode_snapshot: OutboxPayloadEntry['cycle']['variantModeSnapshot'];
}

/**
 * Joins each pending outbox row with its entry + cycle data into the shape
 * `POST /entries` expects. An entry that's vanished (superseded by a same-day
 * re-registration — entryRepository.ts deletes the old outbox row for
 * exactly this reason) is silently skipped rather than sent as a gap.
 */
export async function buildOutboxPayload(db: SqlExecutor, entryIds: string[]): Promise<OutboxPayloadEntry[]> {
  const payload: OutboxPayloadEntry[] = [];
  for (const entryId of entryIds) {
    const row = await db.getFirstAsync<JoinedRow>(
      `SELECT e.id, e.cycle_id, e.date, e.bleeding_type, e.mucus_sensation, e.mucus_stretch, e.mucus_color,
              e.shiny_reflex, e.intercourse, e.entered_at,
              c.start_date as cycle_start_date, c.end_date as cycle_end_date,
              c.is_active as cycle_is_active, c.variant_mode_snapshot as cycle_variant_mode_snapshot
       FROM daily_entries e JOIN cycles c ON c.id = e.cycle_id
       WHERE e.id = ?`,
      [entryId],
    );
    if (!row) {
      continue;
    }
    payload.push({
      id: row.id,
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
      enteredAt: row.entered_at,
      entrySource: 'USER',
    });
  }
  return payload;
}
