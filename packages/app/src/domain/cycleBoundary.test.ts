import { describe, expect, it } from 'vitest';
import { resolveCycleForNewEntry } from './cycleBoundary';

describe('resolveCycleForNewEntry', () => {
  it('opens a new cycle when none is active, regardless of bleeding type', () => {
    expect(resolveCycleForNewEntry(null, '2026-01-01', 'NONE')).toEqual({
      type: 'OPEN_NEW',
      startDate: '2026-01-01',
    });
    expect(resolveCycleForNewEntry(null, '2026-01-01', 'H')).toEqual({
      type: 'OPEN_NEW',
      startDate: '2026-01-01',
    });
  });

  it('H/M on a still-empty active cycle just opens/uses it — no close', () => {
    const active = { id: 'cycle-1', startDate: '2026-01-01', hasEntries: false };
    expect(resolveCycleForNewEntry(active, '2026-01-01', 'H')).toEqual({
      type: 'USE_EXISTING',
      cycleId: 'cycle-1',
    });
  });

  it('H/M on an active cycle that already has entries closes it and opens a new one', () => {
    const active = { id: 'cycle-1', startDate: '2026-01-01', hasEntries: true };
    expect(resolveCycleForNewEntry(active, '2026-01-29', 'H')).toEqual({
      type: 'OPEN_NEW',
      startDate: '2026-01-29',
      closePreviousCycle: { id: 'cycle-1', endDate: '2026-01-28' },
    });
  });

  it('spotting (L/VL/B) never closes the active cycle, even with entries present', () => {
    const active = { id: 'cycle-1', startDate: '2026-01-01', hasEntries: true };
    for (const bleedingType of ['L', 'VL', 'B'] as const) {
      expect(resolveCycleForNewEntry(active, '2026-01-15', bleedingType)).toEqual({
        type: 'USE_EXISTING',
        cycleId: 'cycle-1',
      });
    }
  });

  it('no bleeding belongs to the current active cycle', () => {
    const active = { id: 'cycle-1', startDate: '2026-01-01', hasEntries: true };
    expect(resolveCycleForNewEntry(active, '2026-01-15', 'NONE')).toEqual({
      type: 'USE_EXISTING',
      cycleId: 'cycle-1',
    });
  });
});
