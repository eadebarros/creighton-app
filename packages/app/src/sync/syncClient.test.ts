import { beforeEach, describe, expect, it, vi } from 'vitest';

const postEntriesMock = vi.fn();
const getSyncMock = vi.fn();
vi.mock('../api/client', () => ({
  postEntries: (...args: unknown[]) => postEntriesMock(...args),
  getSync: (...args: unknown[]) => getSyncMock(...args),
}));

import { createTestSqlExecutor } from '../db/testSqlExecutor';
import { migrate } from '../db/schema';
import { recordObservation } from '../db/observationRepository';
import { getPendingOutboxEntries } from '../db/outboxRepository';
import { flush, pull, syncNow } from './syncClient';

let counter = 0;
const testNewId = () => `test-id-${++counter}`;
const testVariantMode = async () => 'REGULAR' as const;
const BASE_URL = 'https://api.example.test';
const getToken = async () => 'test-token';

beforeEach(() => {
  postEntriesMock.mockReset();
  getSyncMock.mockReset();
});

describe('flush', () => {
  it('does nothing when the outbox is empty', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await flush(db, getToken, BASE_URL);
    expect(postEntriesMock).not.toHaveBeenCalled();
  });

  it('does nothing when there is no session yet', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await recordObservation(db, { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false }, '2026-01-01', testNewId, testVariantMode);
    await flush(db, async () => null, BASE_URL);
    expect(postEntriesMock).not.toHaveBeenCalled();
    expect(await getPendingOutboxEntries(db)).toHaveLength(1);
  });

  it('marks entries synced on both created and duplicate results', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await recordObservation(db, { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false }, '2026-01-01', testNewId, testVariantMode);
    await recordObservation(db, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }, '2026-01-02', testNewId, testVariantMode);
    const [first, second] = await getPendingOutboxEntries(db);

    postEntriesMock.mockResolvedValue([
      { id: first!.observationId, status: 'created' },
      { id: second!.observationId, status: 'duplicate' },
    ]);

    await flush(db, getToken, BASE_URL);

    expect(postEntriesMock).toHaveBeenCalledWith(BASE_URL, 'test-token', expect.any(Array));
    expect(await getPendingOutboxEntries(db)).toHaveLength(0);
  });

  it('leaves entries queued and records the error when the request fails', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await recordObservation(db, { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false }, '2026-01-01', testNewId, testVariantMode);
    postEntriesMock.mockRejectedValue(new Error('network down'));

    await flush(db, getToken, BASE_URL);

    const pending = await getPendingOutboxEntries(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ attemptCount: 1 });
  });
});

describe('pull', () => {
  it('does nothing when there is no session yet', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await pull(db, async () => null, BASE_URL);
    expect(getSyncMock).not.toHaveBeenCalled();
  });

  it('upserts fertility states and advances the sync_meta cursor to the response serverTime', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    // confirmed_fertility_states.daily_entry_id FKs to daily_entries(id) — the
    // consolidated (peak-of-the-day) row, not the raw observation's own id
    // (Adendo 01), so the mocked sync response must reference that one.
    const dailyEntry = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM daily_entries WHERE cycle_id = ? AND date = ?',
      [cycleId, '2026-01-01'],
    );

    getSyncMock.mockResolvedValue({
      serverTime: '2026-01-02T00:00:00.000Z',
      cycles: [],
      fertilityStates: [
        {
          entryId: dailyEntry!.id,
          cycleId: 'cycle-1',
          date: '2026-01-01',
          computedState: 'FERTILE',
          peakRelation: 'NOT_APPLICABLE',
          computedAt: '2026-01-01T12:00:00.000Z',
          ruleEngineVersion: '0.1.0',
        },
      ],
    });

    await pull(db, getToken, BASE_URL);

    expect(getSyncMock).toHaveBeenCalledWith(BASE_URL, 'test-token', new Date(0).toISOString());
    const confirmed = await db.getFirstAsync<{ computed_state: string; peak_relation: string }>(
      'SELECT computed_state, peak_relation FROM confirmed_fertility_states WHERE daily_entry_id = ?',
      [dailyEntry!.id],
    );
    expect(confirmed).toMatchObject({ computed_state: 'FERTILE', peak_relation: 'NOT_APPLICABLE' });

    const meta = await db.getFirstAsync<{ last_synced_at: string }>('SELECT last_synced_at FROM sync_meta WHERE id = 1', []);
    expect(meta?.last_synced_at).toBe('2026-01-02T00:00:00.000Z');
  });

  it('uses the stored cursor as `since` on a subsequent pull, not the epoch again', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await db.runAsync('INSERT INTO sync_meta (id, last_synced_at) VALUES (1, ?)', ['2026-01-05T00:00:00.000Z']);
    getSyncMock.mockResolvedValue({ serverTime: '2026-01-06T00:00:00.000Z', cycles: [], fertilityStates: [] });

    await pull(db, getToken, BASE_URL);

    expect(getSyncMock).toHaveBeenCalledWith(BASE_URL, 'test-token', '2026-01-05T00:00:00.000Z');
  });
});

describe('syncNow', () => {
  it('flushes before pulling', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await recordObservation(db, { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false }, '2026-01-01', testNewId, testVariantMode);
    const [pending] = await getPendingOutboxEntries(db);

    postEntriesMock.mockResolvedValue([{ id: pending!.observationId, status: 'created' }]);
    getSyncMock.mockResolvedValue({ serverTime: '2026-01-02T00:00:00.000Z', cycles: [], fertilityStates: [] });

    await syncNow(db, getToken, BASE_URL);

    expect(postEntriesMock).toHaveBeenCalledTimes(1);
    expect(getSyncMock).toHaveBeenCalledTimes(1);
    expect(await getPendingOutboxEntries(db)).toHaveLength(0);
  });
});
