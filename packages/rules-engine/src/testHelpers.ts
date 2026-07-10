import type { DailyEntryInput } from './types.js';

/** Builds a dry, uneventful day by default — override just what a test cares about. */
export function entry(date: string, overrides: Partial<DailyEntryInput> = {}): DailyEntryInput {
  return {
    date,
    bleedingType: 'NONE',
    mucusSensation: 'DRY',
    mucusStretch: 'NONE',
    intercourse: false,
    ...overrides,
  };
}

/** A peak-type day: ELASTIC + CLEAR -> raw_code 10C, HIGHLY_FERTILE. */
export function peakDay(date: string, overrides: Partial<DailyEntryInput> = {}): DailyEntryInput {
  return entry(date, { mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR', ...overrides });
}

/** A plain non-peak dry day. */
export function dryDay(date: string, overrides: Partial<DailyEntryInput> = {}): DailyEntryInput {
  return entry(date, overrides);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
