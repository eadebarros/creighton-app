import { describe, expect, it } from 'vitest';
import { findConfirmedPeak } from './peakTracker.js';
import { addDays, dryDay, entry, peakDay } from './testHelpers.js';

describe('findConfirmedPeak — Section 3.2 state machine', () => {
  it('confirms Tc after exactly 3 consecutive non-peak days', () => {
    const Tc = '2026-01-10';
    const entries = [peakDay(Tc), dryDay(addDays(Tc, 1)), dryDay(addDays(Tc, 2)), dryDay(addDays(Tc, 3))];
    const result = findConfirmedPeak(entries);
    expect(result.confirmed).toEqual({ date: Tc });
    expect(result.lastCandidateDate).toBe(Tc);
  });

  it('a new peak-type day at Tc+1 discards the old candidate and restarts the count', () => {
    const Tc1 = '2026-01-10';
    const Tc2 = addDays(Tc1, 1);
    const entries = [
      peakDay(Tc1),
      peakDay(Tc2), // new candidate, discards Tc1
      dryDay(addDays(Tc2, 1)),
      dryDay(addDays(Tc2, 2)),
      dryDay(addDays(Tc2, 3)),
    ];
    const result = findConfirmedPeak(entries);
    expect(result.confirmed).toEqual({ date: Tc2 });
  });

  it('a new peak-type day at Tc+2 (interrupting the streak) discards and restarts', () => {
    const Tc1 = '2026-01-10';
    const interrupt = addDays(Tc1, 2);
    const entries = [
      peakDay(Tc1),
      dryDay(addDays(Tc1, 1)),
      peakDay(interrupt), // interrupts Tc1's streak, becomes new candidate
      dryDay(addDays(interrupt, 1)),
      dryDay(addDays(interrupt, 2)),
      dryDay(addDays(interrupt, 3)),
    ];
    const result = findConfirmedPeak(entries);
    expect(result.confirmed).toEqual({ date: interrupt });
  });

  it('bleeding H/M on day D blocks D from becoming a candidate, but does not invalidate an already-open candidate', () => {
    const Tc = '2026-01-10';
    const entries = [
      peakDay(Tc),
      entry(addDays(Tc, 1), { bleedingType: 'M' }), // still counts as non-peak day 1
      dryDay(addDays(Tc, 2)),
      dryDay(addDays(Tc, 3)),
    ];
    const result = findConfirmedPeak(entries);
    expect(result.confirmed).toEqual({ date: Tc });
  });

  it('bleeding H/M on the peak-type day itself blocks that day from becoming a candidate', () => {
    const wouldBeTc = '2026-01-10';
    const entries = [entry(wouldBeTc, { mucusStretch: 'ELASTIC', mucusColor: 'CLEAR', bleedingType: 'H' })];
    const result = findConfirmedPeak(entries);
    expect(result.confirmed).toBeNull();
    expect(result.lastCandidateDate).toBeNull();
  });

  it('two candidate windows in one cycle — only the second confirms', () => {
    const Tc1 = '2026-01-05';
    const Tc2 = '2026-01-15';
    const entries = [
      peakDay(Tc1),
      peakDay(addDays(Tc1, 1)), // discards Tc1 before it can confirm
      dryDay(addDays(Tc1, 2)),
      dryDay(addDays(Tc1, 5)),
      peakDay(Tc2),
      dryDay(addDays(Tc2, 1)),
      dryDay(addDays(Tc2, 2)),
      dryDay(addDays(Tc2, 3)),
    ];
    const result = findConfirmedPeak(entries);
    expect(result.confirmed).toEqual({ date: Tc2 });
  });

  it('cycle ends while still CANDIDATE — never confirms', () => {
    const Tc = '2026-01-10';
    const entries = [peakDay(Tc), dryDay(addDays(Tc, 1)), dryDay(addDays(Tc, 2))]; // only 2 of 3 needed
    const result = findConfirmedPeak(entries);
    expect(result.confirmed).toBeNull();
    expect(result.lastCandidateDate).toBe(Tc);
  });

  it('no peak-type day at all in the cycle -> no candidate, no confirmation', () => {
    const entries = [dryDay('2026-01-01'), dryDay('2026-01-02'), dryDay('2026-01-03')];
    const result = findConfirmedPeak(entries);
    expect(result.confirmed).toBeNull();
    expect(result.lastCandidateDate).toBeNull();
  });
});
