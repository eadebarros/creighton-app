import Database from 'better-sqlite3';
import type { SqlBindValue, SqlExecutor } from './executor';

/**
 * Test-only SqlExecutor backed by better-sqlite3 (:memory:). Production code
 * never imports this file or better-sqlite3 — it exists purely so vitest can
 * exercise real SQL (constraints, ordering, nullability) without the RN
 * runtime, against the same interface expo-sqlite's SQLiteDatabase satisfies.
 */
export function createTestSqlExecutor(): SqlExecutor {
  const db = new Database(':memory:');

  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql: string, params: SqlBindValue[]) {
      const info = db.prepare(sql).run(...(params as never[]));
      return { lastInsertRowId: Number(info.lastInsertRowid), changes: info.changes };
    },
    async getAllAsync<T>(sql: string, params: SqlBindValue[]) {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlBindValue[]) {
      const row = sql.trim().toUpperCase().startsWith('PRAGMA')
        ? (db.pragma(sql.replace(/^PRAGMA\s+/i, ''), { simple: false }) as unknown[])[0]
        : db.prepare(sql).get(...(params as never[]));
      return (row ?? null) as T | null;
    },
  };
}
