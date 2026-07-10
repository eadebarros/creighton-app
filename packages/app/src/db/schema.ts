import type { SqlExecutor } from './executor';

export const SCHEMA_VERSION = 1;

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

/**
 * Applies the schema exactly once per database, tracked via PRAGMA
 * user_version. Sprint 1 only ever has one version — this still uses the
 * versioned-migration shape so Sprint 2 can append migrations without
 * restructuring this function.
 */
export async function migrate(db: SqlExecutor): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion >= SCHEMA_VERSION) {
    return;
  }
  await db.execAsync(CREATE_CYCLES_TABLE);
  await db.execAsync(CREATE_DAILY_ENTRIES_TABLE);
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}
