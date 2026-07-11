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

  it('creates the observations table added in schema version 3, and daily_entries gains peak_observation_id/consolidated_at', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);

    const observationsTable = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='observations'",
      [],
    );
    expect(observationsTable?.name).toBe('observations');

    await db.runAsync('INSERT INTO cycles (id, start_date) VALUES (?, ?)', ['cycle-1', '2026-01-01']);
    await db.runAsync(
      `INSERT INTO daily_entries
         (id, cycle_id, date, bleeding_type, mucus_sensation, mucus_stretch, raw_code, intercourse, entered_at, peak_observation_id, consolidated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['entry-1', 'cycle-1', '2026-01-01', 'NONE', 'DRY', 'NONE', '0', 0, '2026-01-01T08:00:00Z', null, null],
    );
    const row = await db.getFirstAsync('SELECT peak_observation_id, consolidated_at FROM daily_entries WHERE id = ?', [
      'entry-1',
    ]);
    expect(row).toBeTruthy();
  });

  it('sync_outbox now queues by observation_id, not entry_id', async () => {
    const db = createTestSqlExecutor();
    await migrate(db);
    await db.runAsync('INSERT INTO cycles (id, start_date) VALUES (?, ?)', ['cycle-1', '2026-01-01']);
    await db.runAsync(
      `INSERT INTO observations (id, cycle_id, date, observed_at, bleeding_type, mucus_sensation, mucus_stretch, raw_code, intercourse)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['obs-1', 'cycle-1', '2026-01-01', '2026-01-01T08:00:00Z', 'NONE', 'DRY', 'NONE', '0', 0],
    );
    await expect(
      db.runAsync('INSERT INTO sync_outbox (observation_id, queued_at) VALUES (?, ?)', ['obs-1', '2026-01-01T08:00:00Z']),
    ).resolves.not.toThrow();
  });

  it('upgrading from a version-2 database backfills one Observation per existing DailyEntry and points peak_observation_id at it', async () => {
    const db = createTestSqlExecutor();
    // Simulate a pre-existing version-2 install with one real entry already captured.
    await db.execAsync(`
      CREATE TABLE cycles (id TEXT PRIMARY KEY, start_date TEXT NOT NULL, end_date TEXT, is_active INTEGER NOT NULL DEFAULT 1, variant_mode_snapshot TEXT NOT NULL DEFAULT 'REGULAR');
      CREATE TABLE daily_entries (id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL, date TEXT NOT NULL, bleeding_type TEXT NOT NULL, mucus_sensation TEXT NOT NULL, mucus_stretch TEXT NOT NULL, mucus_color TEXT, shiny_reflex INTEGER, raw_code TEXT NOT NULL, intercourse INTEGER NOT NULL, entered_at TEXT NOT NULL, UNIQUE(cycle_id, date));
      CREATE TABLE sync_outbox (entry_id TEXT PRIMARY KEY REFERENCES daily_entries(id), queued_at TEXT NOT NULL, synced_at TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, last_error TEXT);
      CREATE TABLE sync_meta (id INTEGER PRIMARY KEY CHECK (id = 1), last_synced_at TEXT);
      CREATE TABLE confirmed_fertility_states (daily_entry_id TEXT PRIMARY KEY REFERENCES daily_entries(id), computed_state TEXT NOT NULL, peak_relation TEXT NOT NULL, computed_at TEXT NOT NULL, rule_engine_version TEXT NOT NULL);
      PRAGMA user_version = 2;
    `);
    await db.runAsync('INSERT INTO cycles (id, start_date) VALUES (?, ?)', ['cycle-1', '2026-01-01']);
    await db.runAsync(
      `INSERT INTO daily_entries
         (id, cycle_id, date, bleeding_type, mucus_sensation, mucus_stretch, raw_code, intercourse, entered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['entry-1', 'cycle-1', '2026-01-01', 'NONE', 'DRY', 'NONE', '0', 0, '2026-01-01T08:00:00Z'],
    );

    await migrate(db);

    const observationCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM observations', []);
    expect(observationCount?.count).toBe(1);

    const entry = await db.getFirstAsync<{ peak_observation_id: string | null; consolidated_at: string | null }>(
      'SELECT peak_observation_id, consolidated_at FROM daily_entries WHERE id = ?',
      ['entry-1'],
    );
    expect(entry?.peak_observation_id).toBeTruthy();
    expect(entry?.consolidated_at).toBe('2026-01-01T08:00:00Z');

    const observation = await db.getFirstAsync<{ raw_code: string; voided: number }>(
      'SELECT raw_code, voided FROM observations WHERE id = ?',
      [entry!.peak_observation_id!],
    );
    expect(observation).toMatchObject({ raw_code: '0', voided: 0 });
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
    await db.runAsync(
      `INSERT INTO observations (id, cycle_id, date, observed_at, bleeding_type, mucus_sensation, mucus_stretch, raw_code, intercourse)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['obs-1', 'cycle-1', '2026-01-01', '2026-01-01T08:00:00Z', 'NONE', 'DRY', 'NONE', '0', 0],
    );
    await db.runAsync('INSERT INTO sync_outbox (observation_id, queued_at) VALUES (?, ?)', ['obs-1', '2026-01-01T08:00:00Z']);

    await resetLocalData(db);

    const cycles = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cycles', []);
    const entries = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM daily_entries', []);
    const observations = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM observations', []);
    const outbox = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_outbox', []);
    expect(cycles?.count).toBe(0);
    expect(entries?.count).toBe(0);
    expect(observations?.count).toBe(0);
    expect(outbox?.count).toBe(0);

    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(version?.user_version).toBe(SCHEMA_VERSION);
  });
});
