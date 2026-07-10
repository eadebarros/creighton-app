import { describe, expect, it } from 'vitest';
import { computeFertilityStates, VariantNotImplementedError } from './index.js';
import { dryDay } from './testHelpers.js';

describe('computeFertilityStates — variant mode gating', () => {
  it('REGULAR runs normally', () => {
    expect(() => computeFertilityStates([dryDay('2026-01-01')], 'REGULAR')).not.toThrow();
  });

  it.each(['LACTATION', 'MENOPAUSE', 'BIP'] as const)(
    '%s is not implemented yet and throws a clear, typed error instead of silently misbehaving',
    (mode) => {
      expect(() => computeFertilityStates([dryDay('2026-01-01')], mode)).toThrow(VariantNotImplementedError);
    },
  );
});
