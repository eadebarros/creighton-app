import { describe, expect, it } from 'vitest';
import { migrate } from './schema';
import { createTestSqlExecutor } from './testSqlExecutor';
import { getEntriesForCycle } from './entryRepository';
import { consolidateDay, getObservationsForDate, recordObservation, voidObservation } from './observationRepository';

let counter = 0;
const testNewId = () => `test-id-${++counter}`;
const testVariantMode = async () => 'REGULAR' as const;

describe('observationRepository.recordObservation', () => {
  it('creates a cycle and one observation for the very first check', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    const observations = await getObservationsForDate(db, cycleId, '2026-01-01');
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ raw_code: '0', voided: 0 });

    const entries = await getEntriesForCycle(db, cycleId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ raw_code: '0' });
  });

  it('a second same-day observation is a NEW row, not an overwrite — daily_entries reflects the peak', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );

    const observations = await getObservationsForDate(db, cycleId, '2026-01-01');
    expect(observations).toHaveLength(2);

    const entries = await getEntriesForCycle(db, cycleId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ raw_code: '10C' }); // the more fertile of the two wins
  });

  it('reuses the same daily_entries id across multiple observations of the same day', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    const firstEntries = await getEntriesForCycle(db, cycleId);
    const firstId = firstEntries[0]!.id;

    await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'WET', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    const secondEntries = await getEntriesForCycle(db, cycleId);
    expect(secondEntries).toHaveLength(1);
    expect(secondEntries[0]!.id).toBe(firstId);
  });

  it('queues a sync_outbox row keyed by observation_id for every check', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    const observations = await getObservationsForDate(db, cycleId, '2026-01-01');
    const outboxRow = await db.getFirstAsync<{ observation_id: string; synced_at: string | null }>(
      'SELECT observation_id, synced_at FROM sync_outbox WHERE observation_id = ?',
      [observations[0]!.id],
    );
    expect(outboxRow).toMatchObject({ observation_id: observations[0]!.id, synced_at: null });
  });
});

describe('observationRepository.voidObservation', () => {
  it('voiding the peak observation reconsolidates to the next-best remaining one', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );

    const observations = await getObservationsForDate(db, cycleId, '2026-01-01');
    const peak = observations.find((o) => o.raw_code === '10C')!;
    await voidObservation(db, peak.id);

    const entries = await getEntriesForCycle(db, cycleId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ raw_code: '0' });

    const remaining = await getObservationsForDate(db, cycleId, '2026-01-01');
    expect(remaining.find((o) => o.id === peak.id)?.voided).toBe(1);
  });

  it('voiding the only observation of a day removes the derived daily_entries row entirely', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    const observations = await getObservationsForDate(db, cycleId, '2026-01-01');

    await voidObservation(db, observations[0]!.id);

    const entries = await getEntriesForCycle(db, cycleId);
    expect(entries).toHaveLength(0);
  });
});

describe('consolidateDay', () => {
  it('consolidates bleeding by the most intense of the day, independent of the mucus winner', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'M', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR', intercourse: true },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );

    const entries = await getEntriesForCycle(db, cycleId);
    expect(entries[0]).toMatchObject({ bleeding_type: 'M', raw_code: '10C', intercourse: 1 });
  });
});
