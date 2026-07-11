import type { SqlExecutor } from './executor';

export const SCHEMA_VERSION = 3;

const CREATE_CYCLES_TABLE = `
  CREATE TABLE IF NOT EXISTS cycles (
    id TEXT PRIMARY KEY,
    start_date TEXT NOT NULL,
    end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    variant_mode_snapshot TEXT NOT NULL DEFAULT 'REGULAR'
  );
`;

const CREATE_DAILY_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS daily_entries (
    id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL REFERENCES cycles(id),
    date TEXT NOT NULL,
    bleeding_type TEXT NOT NULL,
    mucus_sensation TEXT NOT NULL,
    mucus_stretch TEXT NOT NULL,
    mucus_color TEXT,
    shiny_reflex INTEGER,
    raw_code TEXT NOT NULL,
    intercourse INTEGER NOT NULL,
    entered_at TEXT NOT NULL,
    UNIQUE(cycle_id, date)
  );
`;

/** Offline outbox — one row per entry pending upload to @creighton/backend. */
const CREATE_SYNC_OUTBOX_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_outbox (
    entry_id TEXT PRIMARY KEY REFERENCES daily_entries(id),
    queued_at TEXT NOT NULL,
    synced_at TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
`;

/** Single-row cursor for GET /sync?since=. */
const CREATE_SYNC_META_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_synced_at TEXT
  );
`;

/**
 * Server-confirmed fertility state, populated only from GET /sync responses.
 * The app still computes state locally in memory exactly as in Sprint 1 —
 * this table only powers a "confirmed by server" vs. "provisional" UI
 * indicator (the offline/eventually-consistent trade-off the architecture
 * doc accepts in Seção 4.3), it is never the primary source the chart reads.
 */
const CREATE_CONFIRMED_FERTILITY_STATES_TABLE = `
  CREATE TABLE IF NOT EXISTS confirmed_fertility_states (
    daily_entry_id TEXT PRIMARY KEY REFERENCES daily_entries(id),
    computed_state TEXT NOT NULL,
    peak_relation TEXT NOT NULL,
    computed_at TEXT NOT NULL,
    rule_engine_version TEXT NOT NULL
  );
`;

/**
 * Adendo 01 — raw append-only event, one row per intraday check. No
 * UNIQUE(cycle_id, date): multiple per day is the normal case. `daily_entries`
 * becomes the derived "peak of the day" row, upserted by the consolidator.
 */
const CREATE_OBSERVATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    cycle_id TEXT NOT NULL REFERENCES cycles(id),
    date TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    bleeding_type TEXT NOT NULL,
    mucus_sensation TEXT NOT NULL,
    mucus_stretch TEXT NOT NULL,
    mucus_color TEXT,
    shiny_reflex INTEGER,
    raw_code TEXT NOT NULL,
    intercourse INTEGER NOT NULL,
    voided INTEGER NOT NULL DEFAULT 0,
    voided_at TEXT
  );
`;

const CREATE_OBSERVATIONS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_observations_cycle_date ON observations(cycle_id, date);
`;

/** Outbox now queues Observations (the raw, syncable unit) instead of the derived daily_entries row. */
const CREATE_SYNC_OUTBOX_V2_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_outbox (
    observation_id TEXT PRIMARY KEY REFERENCES observations(id),
    queued_at TEXT NOT NULL,
    synced_at TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
`;

/**
 * One Observation per pre-existing DailyEntry (observed_at = entered_at,
 * voided = false), then daily_entries points at it as its own peak — a
 * pre-existing single-observation day trivially "wins" pickDailyPeak against
 * itself. Not re-queued for sync: this data already reached the server under
 * the old direct-write path, and the server backfills the same way from its
 * own pre-existing rows.
 */
const BACKFILL_OBSERVATIONS_SQL = `
  INSERT INTO observations (id, cycle_id, date, observed_at, bleeding_type, mucus_sensation, mucus_stretch, mucus_color, shiny_reflex, raw_code, intercourse, voided)
  SELECT lower(hex(randomblob(16))), cycle_id, date, entered_at, bleeding_type, mucus_sensation, mucus_stretch, mucus_color, shiny_reflex, raw_code, intercourse, 0
  FROM daily_entries;

  UPDATE daily_entries
  SET peak_observation_id = (
    SELECT o.id FROM observations o WHERE o.cycle_id = daily_entries.cycle_id AND o.date = daily_entries.date
  ),
  consolidated_at = entered_at;
`;

/**
 * Applies pending schema versions in order, tracked via PRAGMA user_version —
 * an existing Sprint 1 install (version 1) only picks up the version-2
 * addition; a fresh install (version 0) runs everything.
 */
export async function migrate(db: SqlExecutor): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) {
    return;
  }
  if (currentVersion < 1) {
    await db.execAsync(CREATE_CYCLES_TABLE);
    await db.execAsync(CREATE_DAILY_ENTRIES_TABLE);
  }
  if (currentVersion < 2) {
    await db.execAsync(CREATE_SYNC_OUTBOX_TABLE);
    await db.execAsync(CREATE_SYNC_META_TABLE);
    await db.execAsync(CREATE_CONFIRMED_FERTILITY_STATES_TABLE);
  }
  if (currentVersion < 3) {
    await db.execAsync(CREATE_OBSERVATIONS_TABLE);
    await db.execAsync(CREATE_OBSERVATIONS_INDEX);
    await db.execAsync('ALTER TABLE daily_entries ADD COLUMN peak_observation_id TEXT REFERENCES observations(id);');
    await db.execAsync('ALTER TABLE daily_entries ADD COLUMN consolidated_at TEXT;');
    await db.execAsync(BACKFILL_OBSERVATIONS_SQL);
    await db.execAsync('DROP TABLE IF EXISTS sync_outbox;');
    await db.execAsync(CREATE_SYNC_OUTBOX_V2_TABLE);
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

/**
 * Wipes every row from every table (schema/user_version untouched) — used
 * when a different Clerk identity signs in on this device than the one who
 * last used it (see navigation/RoleGate.tsx). The local DB has no per-user
 * scoping of its own; without this, a second person on the same device
 * would inherit the first person's health data. Deletes children before
 * parents since expo-sqlite doesn't enforce FKs by default.
 */
export async function resetLocalData(db: SqlExecutor): Promise<void> {
  await db.execAsync(`
    DELETE FROM confirmed_fertility_states;
    DELETE FROM sync_outbox;
    DELETE FROM daily_entries;
    DELETE FROM observations;
    DELETE FROM cycles;
    DELETE FROM sync_meta;
  `);
}
