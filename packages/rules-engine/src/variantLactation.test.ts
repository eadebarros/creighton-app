import { describe, expect, it } from 'vitest';
import { assignLactationStates } from './index.js';
import { addDays, dryDay, entry, peakDay } from './testHelpers.js';

const start = '2026-03-01';

describe('assignLactationStates — observation window', () => {
  it('days 1-15 are always FERTILE/OBSERVATION, even on a peak-type reading', () => {
    const entries = [
      ...Array.from({ length: 4 }, (_, i) => dryDay(addDays(start, i))), // days 1-4
      peakDay(addDays(start, 4)), // day 5 — a real mucus-peak reading
      ...Array.from({ length: 10 }, (_, i) => dryDay(addDays(start, 5 + i))), // days 6-15
    ];
    const result = assignLactationStates(entries);
    for (const day of result) {
      expect(day.computedState).toBe('FERTILE');
      expect(day.lactationPhase).toBe('OBSERVATION');
      expect(day.pibActive).toBe(false);
    }
  });
});

describe('assignLactationStates — PIB establishment', () => {
  const observationDays = Array.from({ length: 15 }, (_, i) => dryDay(addDays(start, i)));

  it('3 identical raw codes from day 16 establish the PIB on day 18, still FERTILE that day; day 19 is the first INFERTILE_ALTERNATING', () => {
    const entries = [
      ...observationDays,
      dryDay(addDays(start, 15)), // day 16
      dryDay(addDays(start, 16)), // day 17
      dryDay(addDays(start, 17)), // day 18 — 3rd match, PIB established, still FERTILE
      dryDay(addDays(start, 18)), // day 19 — first day under active PIB
    ];
    const result = assignLactationStates(entries);
    const byDate = new Map(result.map((r) => [r.date, r]));

    expect(byDate.get(addDays(start, 17))).toMatchObject({
      computedState: 'FERTILE',
      lactationPhase: 'ESTABLISHING_PIB',
      pibActive: false,
    });
    expect(byDate.get(addDays(start, 18))).toMatchObject({
      computedState: 'INFERTILE_ALTERNATING',
      lactationPhase: 'PIB_ACTIVE',
      pibActive: true,
    });
  });

  it('a deviating raw code breaks an established PIB and requires a fresh 3-day re-establishment', () => {
    const entries = [
      ...observationDays,
      dryDay(addDays(start, 15)), // day 16
      dryDay(addDays(start, 16)), // day 17
      dryDay(addDays(start, 17)), // day 18 — established
      dryDay(addDays(start, 18)), // day 19 — PIB_ACTIVE
      entry(addDays(start, 19), { mucusSensation: 'WET' }), // day 20 — deviation, breaks PIB
      dryDay(addDays(start, 20)), // day 21 — restart count (1)
      dryDay(addDays(start, 21)), // day 22 — restart count (2)
      dryDay(addDays(start, 22)), // day 23 — restart count (3), still FERTILE
      dryDay(addDays(start, 23)), // day 24 — re-established, INFERTILE_ALTERNATING
    ];
    const result = assignLactationStates(entries);
    const byDate = new Map(result.map((r) => [r.date, r]));

    expect(byDate.get(addDays(start, 19))).toMatchObject({
      computedState: 'FERTILE',
      lactationPhase: 'PIB_BROKEN',
      pibActive: false,
    });
    expect(byDate.get(addDays(start, 20))).toMatchObject({ lactationPhase: 'ESTABLISHING_PIB', pibActive: false });
    expect(byDate.get(addDays(start, 21))).toMatchObject({ lactationPhase: 'ESTABLISHING_PIB', pibActive: false });
    expect(byDate.get(addDays(start, 22))).toMatchObject({
      computedState: 'FERTILE',
      lactationPhase: 'ESTABLISHING_PIB',
      pibActive: false,
    });
    expect(byDate.get(addDays(start, 23))).toMatchObject({
      computedState: 'INFERTILE_ALTERNATING',
      lactationPhase: 'PIB_ACTIVE',
      pibActive: true,
    });
  });

  it('semen clearing masks one PIB_ACTIVE day as FERTILE without disturbing the established pattern', () => {
    const entries = [
      ...observationDays,
      dryDay(addDays(start, 15)), // day 16
      dryDay(addDays(start, 16)), // day 17
      dryDay(addDays(start, 17)), // day 18 — established
      dryDay(addDays(start, 18), { intercourse: true }), // day 19 — PIB_ACTIVE, intercourse today
      dryDay(addDays(start, 19)), // day 20 — masked by day 19's intercourse
      dryDay(addDays(start, 20)), // day 21 — resumes PIB_ACTIVE immediately, no re-establishment
    ];
    const result = assignLactationStates(entries);
    const byDate = new Map(result.map((r) => [r.date, r]));

    expect(byDate.get(addDays(start, 18))).toMatchObject({ computedState: 'INFERTILE_ALTERNATING', pibActive: true });
    expect(byDate.get(addDays(start, 19))).toMatchObject({
      computedState: 'FERTILE',
      lactationPhase: 'PIB_ACTIVE',
      pibActive: false,
    });
    expect(byDate.get(addDays(start, 20))).toMatchObject({
      computedState: 'INFERTILE_ALTERNATING',
      lactationPhase: 'PIB_ACTIVE',
      pibActive: true,
    });
  });

  it('bleeding breaks an established PIB just like a raw-code deviation', () => {
    const entries = [
      ...observationDays,
      dryDay(addDays(start, 15)),
      dryDay(addDays(start, 16)),
      dryDay(addDays(start, 17)), // day 18 — established
      dryDay(addDays(start, 18)), // day 19 — PIB_ACTIVE
      entry(addDays(start, 19), { bleedingType: 'L' }), // day 20 — breaks it
    ];
    const result = assignLactationStates(entries);
    const byDate = new Map(result.map((r) => [r.date, r]));

    expect(byDate.get(addDays(start, 19))).toMatchObject({ computedState: 'FERTILE', pibActive: false });
  });
});

describe('assignLactationStates — full synthetic timeline', () => {
  /**
   * Not clinically reviewed — a self-consistent synthetic timeline exercising
   * the whole pipeline end to end, same caveat as fullCycle.test.ts's REGULAR
   * fixture (Seção 7 of the architecture doc).
   */
  const entries = [
    ...Array.from({ length: 15 }, (_, i) => dryDay(addDays(start, i))), // days 1-15: observation
    dryDay(addDays(start, 15)), // day 16
    dryDay(addDays(start, 16)), // day 17
    dryDay(addDays(start, 17)), // day 18: established
    ...Array.from({ length: 10 }, (_, i) => dryDay(addDays(start, 18 + i))), // days 19-28: PIB_ACTIVE
    entry(addDays(start, 28), { mucusSensation: 'WET' }), // day 29: deviation breaks it
    ...Array.from({ length: 5 }, (_, i) => dryDay(addDays(start, 29 + i))), // days 30-34: re-establishing
  ];
  const result = assignLactationStates(entries);
  const byDate = new Map(result.map((r) => [r.date, r]));

  it('produces one state per input day', () => {
    expect(result).toHaveLength(entries.length);
  });

  it('never marks peakRelation as anything but NOT_APPLICABLE', () => {
    expect(result.every((r) => r.peakRelation === 'NOT_APPLICABLE')).toBe(true);
  });

  it('holds PIB_ACTIVE across the whole matching stretch', () => {
    expect(byDate.get(addDays(start, 20))).toMatchObject({ computedState: 'INFERTILE_ALTERNATING', pibActive: true });
    expect(byDate.get(addDays(start, 27))).toMatchObject({ computedState: 'INFERTILE_ALTERNATING', pibActive: true });
  });

  it('breaks on the deviation day, re-establishes 3 days later, then resumes PIB_ACTIVE', () => {
    expect(byDate.get(addDays(start, 28))).toMatchObject({ lactationPhase: 'PIB_BROKEN', pibActive: false });
    expect(byDate.get(addDays(start, 29))).toMatchObject({ lactationPhase: 'ESTABLISHING_PIB', pibActive: false });
    expect(byDate.get(addDays(start, 31))).toMatchObject({
      computedState: 'FERTILE',
      lactationPhase: 'ESTABLISHING_PIB',
      pibActive: false,
    });
    expect(byDate.get(addDays(start, 33))).toMatchObject({
      computedState: 'INFERTILE_ALTERNATING',
      lactationPhase: 'PIB_ACTIVE',
      pibActive: true,
    });
  });
});
