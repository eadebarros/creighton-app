import { describe, expect, it } from 'vitest';
import { migrate, resetLocalData, SCHEMA_VERSION } from './schema';
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

  it('creates the sync tables added in schema version 2', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);

    for (const name of ['sync_outbox', 'sync_meta', 'confirmed_fertility_states']) {
      const table = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [name],
      );
      expect(table?.name).toBe(name);
    }
  });

  it('upgrading from a Sprint 1 (version 1) database only adds the new tables, without erroring', async () => {
    const db = createTestSqlExecutor();
    // Simulate a pre-existing Sprint 1 install: version 1 tables only.
    await db.execAsync(`
      CREATE TABLE cycles (id TEXT PRIMARY KEY, start_date TEXT NOT NULL, end_date TEXT, is_active INTEGER NOT NULL DEFAULT 1, variant_mode_snapshot TEXT NOT NULL DEFAULT 'REGULAR');
      CREATE TABLE daily_entries (id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, date TEXT NOT NULL, bleeding_type TEXT NOT NULL, mucus_sensation TEXT NOT NULL, mucus_stretch TEXT NOT NULL, mucus_color TEXT, shiny_reflex INTEGER, raw_code TEXT NOT NULL, intercourse INTEGER NOT NULL, entered_at TEXT NOT NULL, UNIQUE(cycle_id, date));
      PRAGMA user_version = 1;
    `);

    await expect(migrate(db)).resolves.not.toThrow();

    const outboxTable = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_outbox'",
      [],
    );
    expect(outboxTable?.name).toBe('sync_outbox');
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(version?.user_version).toBe(SCHEMA_VERSION);
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

  it('resetLocalData wipes every row but keeps the schema and user_version intact', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await db.runAsync('INSERT INTO cycles (id, start_date) VALUES (?, ?)', ['cycle-1', '2026-01-01']);
    await db.runAsync(
      `INSERT INTO daily_entries
         (id, cycle_id, date, bleeding_type, mucus_sensation, mucus_stretch, raw_code, intercourse, entered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['entry-1', 'cycle-1', '2026-01-01', 'NONE', 'DRY', 'NONE', '0', 0, '2026-01-01T08:00:00Z'],
    );
    await db.runAsync('INSERT INTO sync_outbox (entry_id, queued_at) VALUES (?, ?)', ['entry-1', '2026-01-01T08:00:00Z']);

    await resetLocalData(db);

    const cycles = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cycles', []);
    const entries = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM daily_entries', []);
    const outbox = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_outbox', []);
    expect(cycles?.count).toBe(0);
    expect(entries?.count).toBe(0);
    expect(outbox?.count).toBe(0);

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(version?.user_version).toBe(SCHEMA_VERSION);
  });
});
