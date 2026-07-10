/** Bindable SQL parameter values — the subset both expo-sqlite and better-sqlite3 accept. */
export type SqlBindValue = string | number | null;

/**
 * Shape shared by expo-sqlite's SQLiteDatabase (production) and the
 * better-sqlite3-backed test double (db/testSqlExecutor.ts) — production
 * code only ever depends on this interface, never on either concrete
 * implementation, so tests exercise real SQL without the RN runtime.
 */
export interface SqlExecutor {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlBindValue[]): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, params: SqlBindValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlBindValue[]): Promise<T | null>;
}
