import { describe, expect, it } from 'vitest';
import { computeFertilityStates, VariantNotImplementedError } from './index.js';
import { dryDay } from './testHelpers.js';

describe('computeFertilityStates — variant mode gating', () => {
  it.each(['REGULAR', 'LACTATION', 'MENOPAUSE'] as const)('%s runs normally', (mode) => {
    expect(() => computeFertilityStates([dryDay('2026-01-01')], mode)).not.toThrow();
  });

  it('BIP is not implemented yet and throws a clear, typed error instead of silently misbehaving', () => {
    expect(() => computeFertilityStates([dryDay('2026-01-01')], 'BIP')).toThrow(VariantNotImplementedError);
  });

  it('MENOPAUSE never produces INFERTILE_ABSOLUTE — confirmation is always provisional until cycle close (Adendo 02)', () => {
    const start = '2026-01-01';
    const addDays = (n: number) => {
      const d = new Date(`${start}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const entries = [
      { date: addDays(0), bleedingType: 'NONE' as const, mucusSensation: 'WET' as const, mucusStretch: 'ELASTIC' as const, mucusColor: 'CLEAR' as const, intercourse: false },
      ...Array.from({ length: 20 }, (_, i) => ({
        date: addDays(1 + i),
        bleedingType: 'NONE' as const,
        mucusSensation: 'DRY' as const,
        mucusStretch: 'NONE' as const,
        intercourse: false,
      })),
    ];
    const result = computeFertilityStates(entries, 'MENOPAUSE');
    expect(result.some((r) => r.computedState === 'INFERTILE_ABSOLUTE')).toBe(false);
  });
});
