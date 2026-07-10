import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, today } from './dateMath';

describe('dateMath', () => {
  it('daysBetween computes whole-day differences', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0);
    expect(daysBetween('2026-01-01', '2026-01-15')).toBe(14);
    expect(daysBetween('2026-01-15', '2026-01-01')).toBe(-14);
  });

  it('addDays shifts forward and backward', () => {
    expect(addDays('2026-01-01', 1)).toBe('2026-01-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-02-01', 0)).toBe('2026-02-01');
  });

  it('today returns an ISO yyyy-mm-dd string', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
