import { describe, expect, it } from 'vitest';
import { hashRotationDegrees } from './stampRotation';

describe('hashRotationDegrees', () => {
  it('is deterministic for the same seed', () => {
    expect(hashRotationDegrees('2026-01-01')).toBe(hashRotationDegrees('2026-01-01'));
  });

  it('differs across seeds (not a constant)', () => {
    const values = new Set(
      ['2026-01-01', '2026-01-02', '2026-01-03', '10C', 'today'].map(hashRotationDegrees),
    );
    expect(values.size).toBeGreaterThan(1);
  });

  it('always stays within -3..3 degrees', () => {
    for (const seed of ['2026-01-01', '10C', 'abc', '', 'zzzzzzzzzzzzzz', '—']) {
      const deg = hashRotationDegrees(seed);
      expect(deg).toBeGreaterThanOrEqual(-3);
      expect(deg).toBeLessThanOrEqual(3);
    }
  });
});
