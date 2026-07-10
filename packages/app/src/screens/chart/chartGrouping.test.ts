import { describe, expect, it } from 'vitest';
import { computeFertilityStates } from '@creighton/rules-engine';
import type { DailyEntryInput } from '@creighton/rules-engine';
import { derivePhaseLabel, groupByContiguousPhase, peakRelationLabel } from './chartGrouping';
import type { ChartDay } from './chartGrouping';

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const start = '2026-02-01';

// Mirrors rules-engine's own fullCycle.test.ts shape: menstruation -> dry ->
// mucus buildup -> peak candidate -> 3-day confirmation -> post-peak window.
const entries: DailyEntryInput[] = [
  { date: addDays(start, 0), bleedingType: 'H', mucusSensation: 'DRY', mucusStretch: 'NONE', intercourse: false },
  { date: addDays(start, 1), bleedingType: 'M', mucusSensation: 'DRY', mucusStretch: 'NONE', intercourse: false },
  { date: addDays(start, 2), bleedingType: 'NONE', mucusSensation: 'DRY', mucusStretch: 'NONE', intercourse: false },
  { date: addDays(start, 3), bleedingType: 'NONE', mucusSensation: 'DRY', mucusStretch: 'NONE', intercourse: false },
  {
    date: addDays(start, 4),
    bleedingType: 'NONE',
    mucusSensation: 'WET',
    mucusStretch: 'ELASTIC',
    mucusColor: 'CLEAR',
    intercourse: true,
  },
  { date: addDays(start, 5), bleedingType: 'NONE', mucusSensation: 'DRY', mucusStretch: 'NONE', intercourse: false },
  { date: addDays(start, 6), bleedingType: 'NONE', mucusSensation: 'DRY', mucusStretch: 'NONE', intercourse: false },
  { date: addDays(start, 7), bleedingType: 'NONE', mucusSensation: 'DRY', mucusStretch: 'NONE', intercourse: false },
  { date: addDays(start, 8), bleedingType: 'NONE', mucusSensation: 'DRY', mucusStretch: 'NONE', intercourse: false },
  { date: addDays(start, 9), bleedingType: 'NONE', mucusSensation: 'DRY', mucusStretch: 'NONE', intercourse: false },
];

function toChartDays(): ChartDay[] {
  const states = computeFertilityStates(entries, 'REGULAR');
  return entries.map((entry, i) => ({
    date: entry.date,
    rawCode: states[i]!.rawCode,
    bleedingType: entry.bleedingType,
    intercourse: entry.intercourse,
    computedState: states[i]!.computedState,
    peakRelation: states[i]!.peakRelation,
  }));
}

describe('derivePhaseLabel', () => {
  it('labels real rules-engine output correctly across the whole cycle shape', () => {
    const days = toChartDays();
    const labels = days.map(derivePhaseLabel);
    expect(labels).toEqual([
      'Menstruação', // day 0 (H)
      'Menstruação', // day 1 (M)
      'Infértil', // day 2 (dry, alternating)
      'Infértil', // day 3 (dry, alternating)
      'Pós-Ápice', // day 4 — Tc itself, peakRelation 'P' (confirmed by days 5-7's non-peak run)
      'Pós-Ápice', // day 5 (P1)
      'Pós-Ápice', // day 6 (P2)
      'Pós-Ápice', // day 7 (P3)
      'Infértil', // day 8 (P4_PLUS, no active wait-and-see -> ABSOLUTE -> Infértil)
      'Infértil', // day 9 (P4_PLUS)
    ]);
  });

  it('bleeding takes precedence over an active Peak window (breakthrough spotting still reads as Menstruação)', () => {
    expect(
      derivePhaseLabel({ bleedingType: 'L', computedState: 'FERTILE', peakRelation: 'P1' }),
    ).toBe('Menstruação');
  });
});

describe('groupByContiguousPhase', () => {
  it('groups the real cycle into contiguous same-label runs', () => {
    const groups = groupByContiguousPhase(toChartDays());
    expect(groups.map((g) => [g.label, g.days.length])).toEqual([
      ['Menstruação', 2],
      ['Infértil', 2],
      ['Pós-Ápice', 4],
      ['Infértil', 2],
    ]);
  });

  it('returns an empty array for no days', () => {
    expect(groupByContiguousPhase([])).toEqual([]);
  });
});

describe('peakRelationLabel', () => {
  it('maps P/P1/P2/P3 to display labels and everything else to null', () => {
    expect(peakRelationLabel('P')).toBe('P');
    expect(peakRelationLabel('P1')).toBe('P+1');
    expect(peakRelationLabel('P2')).toBe('P+2');
    expect(peakRelationLabel('P3')).toBe('P+3');
    expect(peakRelationLabel('P4_PLUS')).toBeNull();
    expect(peakRelationLabel('PRE_PEAK')).toBeNull();
    expect(peakRelationLabel('CANDIDATE')).toBeNull();
    expect(peakRelationLabel('NOT_APPLICABLE')).toBeNull();
  });
});
