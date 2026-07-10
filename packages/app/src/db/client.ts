import * as SQLite from 'expo-sqlite';
import { migrate } from './schema';
import type { SqlExecutor } from './executor';

let dbPromise: Promise<SqlExecutor> | undefined;

/** Opens (or returns the already-open) local database, migrated and ready to query. */
export function getDb(): Promise<SqlExecutor> {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync('creighton.db');
    await migrate(db);
    return db;
  })();
  return dbPromise;
}
