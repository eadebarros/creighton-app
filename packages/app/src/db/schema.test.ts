import { describe, expect, it } from 'vitest';
import { migrate, SCHEMA_VERSION } from './schema';
import { createTestSqlExecutor } from './testSqlExecutor';

describe('schema.migrate', () => {
  it('creates cycles and daily_entries tables and sets user_version', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);

    const cycleTable = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cycles'",
      [],
    );
    const entriesTable = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_entries'",
      [],
    );
    expect(cycleTable?.name).toBe('cycles');
    expect(entriesTable?.name).toBe('daily_entries');

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(version?.user_version).toBe(SCHEMA_VERSION);
  });

  it('is idempotent — running migrate twice does not error or duplicate tables', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await expect(migrate(db)).resolves.not.toThrow();
  });

  it('enforces UNIQUE(cycle_id, date) on daily_entries', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await db.runAsync('INSERT INTO cycles (id, start_date) VALUES (?, ?)', ['cycle-1', '2026-01-01']);
    await db.runAsync(
      `INSERT INTO daily_entries
         (id, cycle_id, date, bleeding_type, mucus_sensation, mucus_stretch, raw_code, intercourse, entered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['entry-1', 'cycle-1', '2026-01-01', 'NONE', 'DRY', 'NONE', '0', 0, '2026-01-01T08:00:00Z'],
    );

    await expect(
      db.runAsync(
        `INSERT INTO daily_entries
           (id, cycle_id, date, bleeding_type, mucus_sensation, mucus_stretch, raw_code, intercourse, entered_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['entry-2', 'cycle-1', '2026-01-01', 'NONE', 'WET', 'NONE', '2W', 0, '2026-01-01T20:00:00Z'],
      ),
    ).rejects.toThrow();
  });
});
