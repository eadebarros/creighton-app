import { describe, expect, it } from 'vitest';
import { pickDailyPeak } from './index.js';
import type { Observation } from './pickDailyPeak.js';

const DATE = '2026-04-01';

function obs(id: string, observedAt: string, overrides: Partial<Observation> = {}): Observation {
  return {
    id,
    date: DATE,
    observedAt,
    bleedingType: 'NONE',
    mucusSensation: 'DRY',
    mucusStretch: 'NONE',
    intercourse: false,
    ...overrides,
  };
}

describe('pickDailyPeak', () => {
  it('throws on an empty array', () => {
    expect(() => pickDailyPeak([])).toThrow();
  });

  it('throws when observations have mixed dates', () => {
    const a = obs('a', '2026-04-01T08:00:00Z');
    const b = obs('b', '2026-04-02T08:00:00Z', { date: '2026-04-02' });
    expect(() => pickDailyPeak([a, b])).toThrow();
  });

  it('criterion a: morning dry + evening 10C picks 10C, regardless of input order', () => {
    const morning = obs('morning', '2026-04-01T07:00:00Z');
    const evening = obs('evening', '2026-04-01T20:00:00Z', {
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
    });

    expect(pickDailyPeak([morning, evening]).peakObservationId).toBe('evening');
    expect(pickDailyPeak([evening, morning]).peakObservationId).toBe('evening');
  });

  it('criterion b: within the same tier, the peak-type observation wins', () => {
    const cloudy = obs('cloudy', '2026-04-01T07:00:00Z', { mucusStretch: 'STICKY', mucusColor: 'CLOUDY' });
    const clear = obs('clear', '2026-04-01T09:00:00Z', { mucusStretch: 'STICKY', mucusColor: 'CLEAR' });

    expect(pickDailyPeak([cloudy, clear]).peakObservationId).toBe('clear');
    expect(pickDailyPeak([clear, cloudy]).peakObservationId).toBe('clear');
  });

  it('a genuine tie (identical raw_code) falls back to the most recent observedAt', () => {
    const first = obs('first', '2026-04-01T07:00:00Z', { mucusStretch: 'STICKY', mucusColor: 'CLEAR' });
    const second = obs('second', '2026-04-01T19:00:00Z', { mucusStretch: 'STICKY', mucusColor: 'CLEAR' });

    expect(pickDailyPeak([first, second]).peakObservationId).toBe('second');
    expect(pickDailyPeak([second, first]).peakObservationId).toBe('second');
  });

  it('criterion d: bleeding consolidates by the most intense of the day, independent of the mucus winner', () => {
    const morningFlow = obs('morningFlow', '2026-04-01T07:00:00Z', { bleedingType: 'M' });
    const nightMucus = obs('nightMucus', '2026-04-01T20:00:00Z', {
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
      intercourse: true,
    });

    const result = pickDailyPeak([morningFlow, nightMucus]);
    expect(result.peakObservationId).toBe('nightMucus');
    expect(result.bleedingType).toBe('M');
    expect(result.intercourse).toBe(true);
  });

  it('criterion d: intercourse consolidates by logical OR across the day', () => {
    const a = obs('a', '2026-04-01T07:00:00Z', { intercourse: false });
    const b = obs('b', '2026-04-01T20:00:00Z', { intercourse: true });
    expect(pickDailyPeak([a, b]).intercourse).toBe(true);
    expect(pickDailyPeak([a]).intercourse).toBe(false);
  });

  it('criterion e: an unmapped combination ranks as the maximum tier', () => {
    // STICKY with no color is UNMAPPED per deriveRawCode — must not be treated as low-fertility.
    const unmapped = obs('unmapped', '2026-04-01T07:00:00Z', { mucusStretch: 'STICKY' });
    const dry = obs('dry', '2026-04-01T20:00:00Z');
    expect(pickDailyPeak([unmapped, dry]).peakObservationId).toBe('unmapped');
  });
});
