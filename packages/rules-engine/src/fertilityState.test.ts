import { describe, expect, it } from 'vitest';
import { assignStates } from './fertilityState.js';
import type { PeakTrackerResult } from './peakTracker.js';
import { addDays, dryDay, entry } from './testHelpers.js';

const NO_PEAK: PeakTrackerResult = { confirmed: null, lastCandidateDate: null };

describe('assignStates — Section 3.4', () => {
  it('dry phase with no fertile trigger ever -> INFERTILE_ALTERNATING throughout', () => {
    const result = assignStates([dryDay('2026-01-01'), dryDay('2026-01-02'), dryDay('2026-01-03')], NO_PEAK);
    expect(result.map((r) => r.computedState)).toEqual([
      'INFERTILE_ALTERNATING',
      'INFERTILE_ALTERNATING',
      'INFERTILE_ALTERNATING',
    ]);
  });

  it('first day of the cycle has no D-1 — evaluated directly on its own raw_code', () => {
    const result = assignStates([dryDay('2026-01-01')], NO_PEAK);
    expect(result[0]!.computedState).toBe('INFERTILE_ALTERNATING');
  });

  it(
    'semen clearing: intercourse forces exactly the NEXT day FERTILE, then a genuinely dry ' +
      'D+2 reverts to INFERTILE_ALTERNATING (clinically confirmed 2026-07-10 — does not cascade)',
    () => {
      const result = assignStates(
        [
          dryDay('2026-01-01', { intercourse: true }),
          dryDay('2026-01-02'),
          dryDay('2026-01-03'),
        ],
        NO_PEAK,
      );
      expect(result.map((r) => r.computedState)).toEqual([
        'INFERTILE_ALTERNATING',
        'FERTILE',
        'INFERTILE_ALTERNATING',
      ]);
    },
  );

  it('raw_code 4 (shiny reflex on a DRY/DAMP day) starts the mucus phase just like 2W (WET)', () => {
    const viaShiny = assignStates([dryDay('2026-01-01', { shinyReflex: true })], NO_PEAK);
    const viaWet = assignStates([entry('2026-01-01', { mucusSensation: 'WET' })], NO_PEAK);
    expect(viaShiny[0]!.rawCode).toBe('4');
    expect(viaShiny[0]!.computedState).toBe('FERTILE');
    expect(viaShiny[0]!.peakRelation).toBe(viaWet[0]!.peakRelation);
    expect(viaShiny[0]!.computedState).toBe(viaWet[0]!.computedState);
  });

  it('menstrual bleeding (H/M) at cycle start forces FERTILE but does not open a wait-and-see tail — the first dry day after goes straight to alternating', () => {
    const result = assignStates(
      [
        entry('2026-01-01', { bleedingType: 'H' }),
        entry('2026-01-02', { bleedingType: 'H' }),
        dryDay('2026-01-03'),
      ],
      NO_PEAK,
    );
    expect(result.map((r) => r.computedState)).toEqual(['FERTILE', 'FERTILE', 'INFERTILE_ALTERNATING']);
    expect(result[0]!.peakRelation).toBe('NOT_APPLICABLE');
  });

  it('wait and see: an isolated mucus/spotting blip pre-Peak opens a 3-dry-day countdown before alternating resumes', () => {
    const result = assignStates(
      [
        dryDay('2026-01-01'),
        entry('2026-01-02', { mucusSensation: 'WET' }), // isolated blip, not a real Peak build-up
        dryDay('2026-01-03'),
        dryDay('2026-01-04'),
        dryDay('2026-01-05'),
        dryDay('2026-01-06'), // 4th dry day since the blip -> countdown exhausted
      ],
      NO_PEAK,
    );
    expect(result.map((r) => r.computedState)).toEqual([
      'INFERTILE_ALTERNATING',
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'INFERTILE_ALTERNATING',
    ]);
  });

  it('wait and see: minor spotting (L/VL/B) pre-mucus-phase also opens the 3-dry-day countdown, not just post-Peak breakthrough', () => {
    const result = assignStates(
      [
        dryDay('2026-01-01'),
        entry('2026-01-02', { bleedingType: 'L' }),
        dryDay('2026-01-03'),
        dryDay('2026-01-04'),
        dryDay('2026-01-05'),
        dryDay('2026-01-06'),
      ],
      NO_PEAK,
    );
    expect(result.map((r) => r.computedState)).toEqual([
      'INFERTILE_ALTERNATING',
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'INFERTILE_ALTERNATING',
    ]);
  });

  it('a fresh mucus signal mid-countdown re-arms the wait-and-see clock instead of letting it expire', () => {
    const result = assignStates(
      [
        entry('2026-01-01', { mucusSensation: 'WET' }),
        dryDay('2026-01-02'),
        entry('2026-01-03', { mucusSensation: 'WET' }), // re-arms countdown to 3
        dryDay('2026-01-04'),
        dryDay('2026-01-05'),
        dryDay('2026-01-06'),
        dryDay('2026-01-07'), // 4th dry day since the 2nd blip -> exhausted
      ],
      NO_PEAK,
    );
    expect(result.map((r) => r.computedState)).toEqual([
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'INFERTILE_ALTERNATING',
    ]);
  });

  it('interruptive bleeding after a confirmed peak (INFERTILE_ABSOLUTE window) forces FERTILE + 3 dry days after', () => {
    const Tc = '2026-01-01';
    const peak: PeakTrackerResult = { confirmed: { date: Tc }, lastCandidateDate: Tc };
    const entries = [
      dryDay(addDays(Tc, 4)), // baseline: should be ABSOLUTE
      entry(addDays(Tc, 5), { bleedingType: 'L' }), // breakthrough bleed
      dryDay(addDays(Tc, 6)),
      dryDay(addDays(Tc, 7)),
      dryDay(addDays(Tc, 8)),
      dryDay(addDays(Tc, 9)), // countdown exhausted -> back to ABSOLUTE
    ];
    const result = assignStates(entries, peak);
    expect(result.map((r) => r.computedState)).toEqual([
      'INFERTILE_ABSOLUTE',
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'INFERTILE_ABSOLUTE',
    ]);
  });

  it('P / P1 / P2 / P3 / P4_PLUS window around a confirmed peak', () => {
    const Tc = '2026-01-10';
    const peak: PeakTrackerResult = { confirmed: { date: Tc }, lastCandidateDate: Tc };
    const entries = [0, 1, 2, 3, 4, 5].map((n) => dryDay(addDays(Tc, n)));
    const result = assignStates(entries, peak);
    expect(result.map((r) => r.peakRelation)).toEqual(['P', 'P1', 'P2', 'P3', 'P4_PLUS', 'P4_PLUS']);
    expect(result.map((r) => r.computedState)).toEqual([
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'FERTILE',
      'INFERTILE_ABSOLUTE',
      'INFERTILE_ABSOLUTE',
    ]);
  });

  it('days before Tc are evaluated on their own terms, not diverted into the post-peak window', () => {
    const Tc = '2026-01-10';
    const peak: PeakTrackerResult = { confirmed: { date: Tc }, lastCandidateDate: Tc };
    const result = assignStates([dryDay(addDays(Tc, -5))], peak);
    // no mucus signal yet, no candidate active on this earlier day -> alternating-day rule, not P4_PLUS
    expect(result[0]!.peakRelation).not.toBe('P4_PLUS');
    expect(result[0]!.computedState).toBe('INFERTILE_ALTERNATING');
  });

  it('every missing/malformed field resolves to FERTILE, never throws', () => {
    const malformed = entry('2026-01-01', {
      mucusSensation: undefined as any,
      mucusStretch: 'NONE',
    });
    const result = assignStates([malformed], NO_PEAK);
    expect(result[0]!.computedState).toBe('FERTILE');
  });
});
