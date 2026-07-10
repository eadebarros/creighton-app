import { describe, expect, it } from 'vitest';
import { migrate } from './schema';
import { createTestSqlExecutor } from './testSqlExecutor';
import { closeCycle, createCycle, getActiveCycle } from './cycleRepository';

let counter = 0;
const testNewId = () => `test-id-${++counter}`;

describe('cycleRepository', () => {
  it('getActiveCycle returns null when no cycle exists', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    expect(await getActiveCycle(db)).toBeNull();
  });

  it('createCycle then getActiveCycle reports hasEntries=false for a fresh cycle', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const id = await createCycle(db, '2026-01-01', testNewId);
    const active = await getActiveCycle(db);
    expect(active).toEqual({ id, startDate: '2026-01-01', hasEntries: false });
  });

  it('closeCycle deactivates it — getActiveCycle no longer returns it', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const id = await createCycle(db, '2026-01-01', testNewId);
    await closeCycle(db, id, '2026-01-28');
    expect(await getActiveCycle(db)).toBeNull();
  });

  it('getActiveCycle reports hasEntries=true once a daily_entries row exists', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    const id = await createCycle(db, '2026-01-01', testNewId);
    await db.runAsync(
      `INSERT INTO daily_entries
         (id, cycle_id, date, bleeding_type, mucus_sensation, mucus_stretch, raw_code, intercourse, entered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['e1', id, '2026-01-01', 'NONE', 'DRY', 'NONE', '0', 0, '2026-01-01T08:00:00Z'],
    );
    const active = await getActiveCycle(db);
    expect(active?.hasEntries).toBe(true);
  });
});
