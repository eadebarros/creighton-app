import { describe, expect, it } from 'vitest';
import { migrate } from './schema';
import { createTestSqlExecutor } from './testSqlExecutor';
import { getEntriesForCycle, getFertilityStatesForCycle, getMostRecentEntry, hasEntryForDate } from './entryRepository';
import { recordObservation } from './observationRepository';

let counter = 0;
const testNewId = () => `test-id-${++counter}`;
const testVariantMode = async () => 'REGULAR' as const;

describe('entryRepository read helpers (daily_entries is now the derived "peak of the day" row)', () => {
  it('getEntriesForCycle / getMostRecentEntry / hasEntryForDate reflect the consolidated row', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );

    const entries = await getEntriesForCycle(db, cycleId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ date: '2026-01-01', bleeding_type: 'NONE', raw_code: '0' });

    expect(await getMostRecentEntry(db, cycleId)).toEqual({ date: '2026-01-01', bleedingType: 'NONE' });
    expect(await hasEntryForDate(db, cycleId, '2026-01-01')).toBe(true);
    expect(await hasEntryForDate(db, cycleId, '2026-01-02')).toBe(false);
  });

  it('getFertilityStatesForCycle pairs each row with its rules-engine computed state', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const { cycleId } = await recordObservation(
      db,
      { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
      '2026-01-01',
      testNewId,
      testVariantMode,
    );
    const results = await getFertilityStatesForCycle(db, cycleId);
    expect(results).toHaveLength(1);
    expect(results[0]?.state.computedState).toBe('INFERTILE_ALTERNATING');
    expect(results[0]?.row.date).toBe('2026-01-01');
  });
});
