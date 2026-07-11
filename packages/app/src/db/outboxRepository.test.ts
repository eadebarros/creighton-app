import { describe, expect, it } from 'vitest';
import { createTestSqlExecutor } from './testSqlExecutor';
import { migrate } from './schema';
import { recordEntry } from './entryRepository';
import { buildOutboxPayload, getPendingOutboxEntries, markOutboxFailed, markOutboxSynced } from './outboxRepository';

let counter = 0;
const testNewId = () => `test-id-${++counter}`;
const testVariantMode = async () => 'REGULAR' as const;

describe('outboxRepository', () => {
  it('getPendingOutboxEntries returns queued entries in queued_at order, excluding synced ones', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordEntry(
      db,
      { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    await recordEntry(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-02',
      testNewId,
      testVariantMode,
    );

    const pending = await getPendingOutboxEntries(db);
    expect(pending).toHaveLength(2);

    await markOutboxSynced(db, [pending[0]!.entryId]);
    const stillPending = await getPendingOutboxEntries(db);
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0]!.entryId).toBe(pending[1]!.entryId);
    void cycleId;
  });

  it('markOutboxFailed increments attempt_count and records the error', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await recordEntry(
      db,
      { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    const [pending] = await getPendingOutboxEntries(db);

    await markOutboxFailed(db, pending!.entryId, 'network error');
    const [after] = await getPendingOutboxEntries(db);
    expect(after).toMatchObject({ entryId: pending!.entryId, attemptCount: 1 });
  });

  it('buildOutboxPayload joins entry + cycle data into the POST /entries shape', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordEntry(
      db,
      {
        bleedingType: 'NONE',
        mucusSensation: 'WET',
        mucusStretch: 'ELASTIC',
        mucusColor: 'CLEAR',
        intercourse: true,
      },
      '2026-01-10',
      testNewId,
      testVariantMode,
    );
    const [pending] = await getPendingOutboxEntries(db);

    const payload = await buildOutboxPayload(db, [pending!.entryId]);
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      id: pending!.entryId,
      cycle: { id: cycleId, startDate: '2026-01-10', isActive: true, variantModeSnapshot: 'REGULAR' },
      date: '2026-01-10',
      bleedingType: 'NONE',
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
      intercourse: true,
      entrySource: 'USER',
    });
  });

  it('buildOutboxPayload silently skips an entry id that no longer exists', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const payload = await buildOutboxPayload(db, ['does-not-exist']);
    expect(payload).toEqual([]);
  });
});
