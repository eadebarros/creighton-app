import { describe, expect, it } from 'vitest';
import { migrate } from './schema';
import { createTestSqlExecutor } from './testSqlExecutor';
import { getActiveCycle } from './cycleRepository';
import { getEntriesForCycle, getFertilityStatesForCycle, recordEntry } from './entryRepository';

let counter = 0;
const testNewId = () => `test-id-${++counter}`;

describe('entryRepository.recordEntry', () => {
  it('creates a new cycle for the very first entry', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordEntry(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
    );
    const entries = await getEntriesForCycle(db, cycleId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: '2026-01-01', bleeding_type: 'NONE', raw_code: '0', intercourse: 0 });
  });

  it('caches raw_code computed via deriveRawCode at write time', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordEntry(
      db,
      {
        bleedingType: 'NONE',
        mucusSensation: 'WET',
        mucusStretch: 'ELASTIC',
        mucusColor: 'CLEAR',
        intercourse: false,
      },
      '2026-01-10',
      testNewId,
    );
    const entries = await getEntriesForCycle(db, cycleId);
    expect(entries[0]?.raw_code).toBe('10C');
  });

  it('re-registering the same day replaces that day only, not the whole cycle', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordEntry(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
    );
    await recordEntry(
      db,
      { bleedingType: 'NONE', mucusSensation: 'WET', intercourse: true },
      '2026-01-01',
      testNewId,
    );
    const entries = await getEntriesForCycle(db, cycleId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ mucus_sensation: 'WET', intercourse: 1 });
  });

  it('real menstrual flow (H/M) on an active cycle with entries closes it and opens a new one', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const first = await recordEntry(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
    );
    const second = await recordEntry(
      db,
      { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false },
      '2026-01-29',
      testNewId,
    );
    expect(second.cycleId).not.toBe(first.cycleId);

    const active = await getActiveCycle(db);
    expect(active?.id).toBe(second.cycleId);
    expect(active?.startDate).toBe('2026-01-29');

    const firstCycleEntries = await getEntriesForCycle(db, first.cycleId);
    expect(firstCycleEntries).toHaveLength(1);
  });

  it('getFertilityStatesForCycle pairs each row with its rules-engine computed state', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordEntry(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
    );
    const results = await getFertilityStatesForCycle(db, cycleId);
    expect(results).toHaveLength(1);
    expect(results[0]?.state.computedState).toBe('INFERTILE_ALTERNATING');
    expect(results[0]?.row.date).toBe('2026-01-01');
  });
});
