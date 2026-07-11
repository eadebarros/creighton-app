import { getSync, postEntries } from '../api/client';
import { buildOutboxPayload, getPendingOutboxEntries, markOutboxFailed, markOutboxSynced } from '../db/outboxRepository';
import type { SqlExecutor } from '../db/executor';

export type GetToken = () => Promise<string | null>;

/** Uploads whatever's queued in sync_outbox. A no-op if there's nothing pending or no session yet. */
export async function flush(db: SqlExecutor, getToken: GetToken, baseUrl: string): Promise<void> {
  const pending = await getPendingOutboxEntries(db);
  if (pending.length === 0) {
    return;
  }
  const token = await getToken();
  if (!token) {
    return;
  }

  const payload = await buildOutboxPayload(
    db,
    pending.map((p) => p.observationId),
  );
  if (payload.length === 0) {
    return;
  }

  try {
    const results = await postEntries(baseUrl, token, payload);
    const syncedIds = results.filter((r) => r.status === 'created' || r.status === 'duplicate').map((r) => r.id);
    await markOutboxSynced(db, syncedIds);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    for (const entry of pending) {
      await markOutboxFailed(db, entry.observationId, message);
    }
  }
}

/** Pulls server-confirmed fertility states since the last successful pull. A no-op with no session yet. */
export async function pull(db: SqlExecutor, getToken: GetToken, baseUrl: string): Promise<void> {
  const token = await getToken();
  if (!token) {
    return;
  }

  const meta = await db.getFirstAsync<{ last_synced_at: string | null }>(
    'SELECT last_synced_at FROM sync_meta WHERE id = 1',
    [],
  );
  const since = meta?.last_synced_at ?? new Date(0).toISOString();

  const response = await getSync(baseUrl, token, since);
  for (const state of response.fertilityStates) {
    await db.runAsync(
      `INSERT OR REPLACE INTO confirmed_fertility_states
         (daily_entry_id, computed_state, peak_relation, computed_at, rule_engine_version)
       VALUES (?, ?, ?, ?, ?)`,
      [state.entryId, state.computedState, state.peakRelation, state.computedAt, state.ruleEngineVersion],
    );
  }
  await db.runAsync('INSERT OR REPLACE INTO sync_meta (id, last_synced_at) VALUES (1, ?)', [response.serverTime]);
}

/** Push then pull — the one function callers actually reach for. */
export async function syncNow(db: SqlExecutor, getToken: GetToken, baseUrl: string): Promise<void> {
  await flush(db, getToken, baseUrl);
  await pull(db, getToken, baseUrl);
}
