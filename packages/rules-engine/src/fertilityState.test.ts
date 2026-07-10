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
    'intercourse forces the NEXT day FERTILE, and that propagates forward ' +
      '("D-1 fértil por qualquer motivo -> D fértil" is written literally in Section 3.4, ' +
      'with no decay condition — flagging this as worth a product/clinical sanity check, ' +
      'but implementing it as written per the "ambiguity -> FERTILE" principle)',
    () => {
      const result = assignStates(
        [
          dryDay('2026-01-01', { intercourse: true }),
          dryDay('2026-01-02'),
          dryDay('2026-01-03'),
        ],
        NO_PEAK,
      );
      expect(result.map((r) => r.computedState)).toEqual(['INFERTILE_ALTERNATING', 'FERTILE', 'FERTILE']);
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

  it('menstrual bleeding (H/M) at cycle start forces FERTILE and, per the literal cascade above, so does the day after', () => {
    const result = assignStates(
      [
        entry('2026-01-01', { bleedingType: 'H' }),
        entry('2026-01-02', { bleedingType: 'H' }),
        dryDay('2026-01-03'),
      ],
      NO_PEAK,
    );
    expect(result.map((r) => r.computedState)).toEqual(['FERTILE', 'FERTILE', 'FERTILE']);
    expect(result[0]!.peakRelation).toBe('NOT_APPLICABLE');
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
