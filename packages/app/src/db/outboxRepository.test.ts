import { describe, expect, it } from 'vitest';
import { createTestSqlExecutor } from './testSqlExecutor';
import { migrate } from './schema';
import { recordObservation } from './observationRepository';
import { buildOutboxPayload, getPendingOutboxEntries, markOutboxFailed, markOutboxSynced } from './outboxRepository';

let counter = 0;
const testNewId = () => `test-id-${++counter}`;
const testVariantMode = async () => 'REGULAR' as const;

describe('outboxRepository', () => {
  it('getPendingOutboxEntries returns queued observations in queued_at order, excluding synced ones', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-02',
      testNewId,
      testVariantMode,
    );

    const pending = await getPendingOutboxEntries(db);
    expect(pending).toHaveLength(2);

    await markOutboxSynced(db, [pending[0]!.observationId]);
    const stillPending = await getPendingOutboxEntries(db);
    expect(stillPending).toHaveLength(1);
    expect(stillPending[0]!.observationId).toBe(pending[1]!.observationId);
    void cycleId;
  });

  it('markOutboxFailed increments attempt_count and records the error', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await recordObservation(
      db,
      { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    const [pending] = await getPendingOutboxEntries(db);

    await markOutboxFailed(db, pending!.observationId, 'network error');
    const [after] = await getPendingOutboxEntries(db);
    expect(after).toMatchObject({ observationId: pending!.observationId, attemptCount: 1 });
  });

  it('buildOutboxPayload joins observation + cycle data, including the consolidated dailyEntryId', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
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

    const payload = await buildOutboxPayload(db, [pending!.observationId]);
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      id: pending!.observationId,
      cycle: { id: cycleId, startDate: '2026-01-10', isActive: true, variantModeSnapshot: 'REGULAR' },
      date: '2026-01-10',
      bleedingType: 'NONE',
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
      intercourse: true,
      entrySource: 'USER',
    });
    expect(payload[0]?.dailyEntryId).toBeTruthy();
  });

  it('buildOutboxPayload silently skips an observation id that no longer exists', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const payload = await buildOutboxPayload(db, ['does-not-exist']);
    expect(payload).toEqual([]);
  });
});
