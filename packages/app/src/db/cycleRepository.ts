import type { ActiveCycleSummary, VariantMode } from '@creighton/rules-engine';
import type { SqlExecutor } from './executor';

interface CycleRow {
  id: string;
  start_date: string;
}

interface VariantModeRow {
  variant_mode_snapshot: VariantMode;
}

interface CountRow {
  count: number;
}

/** The single currently-open cycle (is_active = 1), or null if none exists yet. */
export async function getActiveCycle(db: SqlExecutor): Promise<ActiveCycleSummary | null> {
  const cycle = await db.getFirstAsync<CycleRow>(
    'SELECT id, start_date FROM cycles WHERE is_active = 1 LIMIT 1',
    [],
  );
  if (!cycle) {
    return null;
  }
  const countRow = await db.getFirstAsync<CountRow>(
    'SELECT COUNT(*) as count FROM daily_entries WHERE cycle_id = ?',
    [cycle.id],
  );
  return {
    id: cycle.id,
    startDate: cycle.start_date,
    hasEntries: (countRow?.count ?? 0) > 0,
  };
}

/** Whether this device has ever recorded any cycle — used to gate the one-time role-choice screen. */
export async function getCycleCount(db: SqlExecutor): Promise<number> {
  const row = await db.getFirstAsync<CountRow>('SELECT COUNT(*) as count FROM cycles', []);
  return row?.count ?? 0;
}

/**
 * `newId` is injected (rather than importing expo-crypto here directly) so
 * this file — and entryRepository.ts, which calls it — stay importable from
 * plain-Node vitest without pulling in expo-crypto's RN/Flow dependency
 * chain. Production callers pass db/id.ts's `newId`; tests pass a stub.
 */
export async function createCycle(
  db: SqlExecutor,
  startDate: string,
  newId: () => string,
  variantMode: VariantMode,
): Promise<string> {
  const id = newId();
  await db.runAsync(
    'INSERT INTO cycles (id, start_date, is_active, variant_mode_snapshot) VALUES (?, ?, 1, ?)',
    [id, startDate, variantMode],
  );
  return id;
}

export async function closeCycle(db: SqlExecutor, cycleId: string, endDate: string): Promise<void> {
  await db.runAsync('UPDATE cycles SET end_date = ?, is_active = 0 WHERE id = ?', [endDate, cycleId]);
}

/** The variant mode this specific cycle was created under — fixed at creation, independent of the user's live current setting. */
export async function getCycleVariantMode(db: SqlExecutor, cycleId: string): Promise<VariantMode> {
  const row = await db.getFirstAsync<VariantModeRow>(
    'SELECT variant_mode_snapshot FROM cycles WHERE id = ?',
    [cycleId],
  );
  return row?.variant_mode_snapshot ?? 'REGULAR';
}
