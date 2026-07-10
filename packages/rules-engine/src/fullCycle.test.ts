import { describe, expect, it } from 'vitest';
import { computeFertilityStates } from './index.js';
import { addDays, entry } from './testHelpers.js';

/**
 * A synthetic ~28-day REGULAR cycle exercising the whole pipeline end to
 * end: menstruation -> dry stretch -> mucus buildup -> peak candidate ->
 * 3-day confirmation -> post-peak fertile window -> INFERTILE_ABSOLUTE.
 *
 * This fixture is self-consistent with the rules as implemented — it was
 * NOT reviewed by a Creighton instructor or checked against a real charted
 * cycle. Per Section 7 of the architecture doc, that external clinical
 * validation is a recommended gate before treating the engine as
 * "ready for real couples," independent of these tests passing.
 *
 * Note the dry days right after menstruation (days 5-9) come out FERTILE,
 * not INFERTILE_ALTERNATING — that's the literal, no-decay reading of the
 * "D-1 fértil por qualquer motivo -> D fértil" cascade in Section 3.4,
 * flagged separately for product/clinical review.
 */
const start = '2026-02-01';

const entries = [
  entry(addDays(start, 0), { bleedingType: 'H' }),
  entry(addDays(start, 1), { bleedingType: 'H' }),
  entry(addDays(start, 2), { bleedingType: 'M' }),
  entry(addDays(start, 3), { bleedingType: 'L' }),
  entry(addDays(start, 4)), // dry
  entry(addDays(start, 5)), // dry
  entry(addDays(start, 6)), // dry
  entry(addDays(start, 7)), // dry
  entry(addDays(start, 8)), // dry
  entry(addDays(start, 9), { mucusSensation: 'WET' }), // 2W, mucus phase begins
  entry(addDays(start, 10), { mucusStretch: 'TACKY', mucusColor: 'CLOUDY' }), // 8K
  entry(addDays(start, 11), { mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR' }), // 10C, Tc candidate
  entry(addDays(start, 12)), // Tc+1, dry, non-peak
  entry(addDays(start, 13)), // Tc+2, dry, non-peak
  entry(addDays(start, 14)), // Tc+3, dry, non-peak -> confirms Tc
  ...Array.from({ length: 13 }, (_, i) => entry(addDays(start, 15 + i))), // Tc+4..Tc+16, dry
];

describe('computeFertilityStates — full synthetic cycle', () => {
  const result = computeFertilityStates(entries, 'REGULAR');
  const byDate = new Map(result.map((r) => [r.date, r]));

  it('produces one state per input day', () => {
    expect(result).toHaveLength(entries.length);
  });

  it('menstruation is FERTILE with the right raw codes', () => {
    expect(byDate.get(addDays(start, 0))).toMatchObject({ rawCode: '0', computedState: 'FERTILE' });
    expect(byDate.get(addDays(start, 2))).toMatchObject({ rawCode: '0', computedState: 'FERTILE' });
  });

  it('the dry stretch right after menstruation stays FERTILE via the cascade rule (see file header)', () => {
    expect(byDate.get(addDays(start, 4))!.computedState).toBe('FERTILE');
    expect(byDate.get(addDays(start, 8))!.computedState).toBe('FERTILE');
  });

  it('mucus buildup is FERTILE with correct raw codes, pre-peak', () => {
    expect(byDate.get(addDays(start, 9))).toMatchObject({ rawCode: '2W', computedState: 'FERTILE', peakRelation: 'PRE_PEAK' });
    expect(byDate.get(addDays(start, 10))).toMatchObject({ rawCode: '8K', computedState: 'FERTILE', peakRelation: 'PRE_PEAK' });
  });

  it('the peak-type day is identified as the confirmed Ápice (P)', () => {
    const peakDate = addDays(start, 11);
    expect(byDate.get(peakDate)).toMatchObject({ rawCode: '10C', computedState: 'FERTILE', peakRelation: 'P' });
  });

  it('P1/P2/P3 are FERTILE, then P4_PLUS is INFERTILE_ABSOLUTE', () => {
    expect(byDate.get(addDays(start, 12))).toMatchObject({ computedState: 'FERTILE', peakRelation: 'P1' });
    expect(byDate.get(addDays(start, 13))).toMatchObject({ computedState: 'FERTILE', peakRelation: 'P2' });
    expect(byDate.get(addDays(start, 14))).toMatchObject({ computedState: 'FERTILE', peakRelation: 'P3' });
    expect(byDate.get(addDays(start, 15))).toMatchObject({
      computedState: 'INFERTILE_ABSOLUTE',
      peakRelation: 'P4_PLUS',
    });
    expect(byDate.get(addDays(start, 27))).toMatchObject({
      computedState: 'INFERTILE_ABSOLUTE',
      peakRelation: 'P4_PLUS',
    });
  });
});
