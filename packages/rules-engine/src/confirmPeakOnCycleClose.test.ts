import { describe, expect, it } from 'vitest';
import { confirmPeakOnCycleClose, findAllConfirmedTcs } from './index.js';
import type { PeakTrackerState } from './index.js';
import { addDays, dryDay, entry, peakDay } from './testHelpers.js';

const start = '2026-01-01';

/** A single candidate at day 0, confirmed via 3 non-peak days at +1/+2/+3. */
function singleCandidateEntries() {
  return [
    peakDay(addDays(start, 0)),
    dryDay(addDays(start, 1)),
    dryDay(addDays(start, 2)),
    dryDay(addDays(start, 3)),
  ];
}

describe('findAllConfirmedTcs', () => {
  it('finds a single confirmed Tc', () => {
    expect(findAllConfirmedTcs(singleCandidateEntries())).toEqual([addDays(start, 0)]);
  });

  it('finds multiple confirmed Tcs in the same timeline (unlike findConfirmedPeak, which stops at the first)', () => {
    const entries = [
      peakDay(addDays(start, 0)), // Tc1
      dryDay(addDays(start, 1)),
      dryDay(addDays(start, 2)),
      dryDay(addDays(start, 3)), // Tc1 confirmed
      ...Array.from({ length: 6 }, (_, i) => dryDay(addDays(start, 4 + i))), // gap
      peakDay(addDays(start, 10)), // Tc2
      dryDay(addDays(start, 11)),
      dryDay(addDays(start, 12)),
      dryDay(addDays(start, 13)), // Tc2 confirmed
    ];
    expect(findAllConfirmedTcs(entries)).toEqual([addDays(start, 0), addDays(start, 10)]);
  });
});

describe('confirmPeakOnCycleClose', () => {
  it('criterion a: single candidate, real bleeding 10 days after Tc+4 → CONFIRMED', () => {
    const result = confirmPeakOnCycleClose({
      closingCycle: { variantMode: 'MENOPAUSE', peakTracker: { type: 'NONE' }, entries: singleCandidateEntries() },
      nextCycleStartDate: addDays(start, 4 + 10),
    });
    expect(result).toEqual({ resolution: 'CONFIRMED', peakDay: addDays(start, 0) });
  });

  it('criterion b: bleeding only 5 days after Tc+4 (before the window) → UNCONFIRMED_CLOSED', () => {
    const result = confirmPeakOnCycleClose({
      closingCycle: { variantMode: 'MENOPAUSE', peakTracker: { type: 'NONE' }, entries: singleCandidateEntries() },
      nextCycleStartDate: addDays(start, 4 + 5),
    });
    expect(result).toEqual({ resolution: 'UNCONFIRMED_CLOSED', lastCandidate: addDays(start, 0) });
  });

  it('criterion c: bleeding 20 days after Tc+4 (after the window) → UNCONFIRMED_CLOSED', () => {
    const result = confirmPeakOnCycleClose({
      closingCycle: { variantMode: 'MENOPAUSE', peakTracker: { type: 'NONE' }, entries: singleCandidateEntries() },
      nextCycleStartDate: addDays(start, 4 + 20),
    });
    expect(result).toEqual({ resolution: 'UNCONFIRMED_CLOSED', lastCandidate: addDays(start, 0) });
  });

  it('criterion d: two candidates, only the older satisfies the window → the older is CONFIRMED', () => {
    const entries = [
      peakDay(addDays(start, 0)), // Tc1
      dryDay(addDays(start, 1)),
      dryDay(addDays(start, 2)),
      dryDay(addDays(start, 3)), // Tc1 confirmed
      ...Array.from({ length: 6 }, (_, i) => dryDay(addDays(start, 4 + i))),
      peakDay(addDays(start, 10)), // Tc2
      dryDay(addDays(start, 11)),
      dryDay(addDays(start, 12)),
      dryDay(addDays(start, 13)), // Tc2 confirmed
    ];
    // nextCycleStartDate = day 14: Tc1+4=day4 -> 10 days (within window); Tc2+4=day14 -> 0 days (outside window).
    const result = confirmPeakOnCycleClose({
      closingCycle: { variantMode: 'MENOPAUSE', peakTracker: { type: 'NONE' }, entries },
      nextCycleStartDate: addDays(start, 14),
    });
    expect(result).toEqual({ resolution: 'CONFIRMED', peakDay: addDays(start, 0) });
  });

  it('criterion g: exactly 8 and exactly 16 days both count as CONFIRMED (inclusive boundaries)', () => {
    const lower = confirmPeakOnCycleClose({
      closingCycle: { variantMode: 'MENOPAUSE', peakTracker: { type: 'NONE' }, entries: singleCandidateEntries() },
      nextCycleStartDate: addDays(start, 4 + 8),
    });
    expect(lower).toMatchObject({ resolution: 'CONFIRMED' });

    const upper = confirmPeakOnCycleClose({
      closingCycle: { variantMode: 'MENOPAUSE', peakTracker: { type: 'NONE' }, entries: singleCandidateEntries() },
      nextCycleStartDate: addDays(start, 4 + 16),
    });
    expect(upper).toMatchObject({ resolution: 'CONFIRMED' });

    const justBelow = confirmPeakOnCycleClose({
      closingCycle: { variantMode: 'MENOPAUSE', peakTracker: { type: 'NONE' }, entries: singleCandidateEntries() },
      nextCycleStartDate: addDays(start, 4 + 7),
    });
    expect(justBelow).toMatchObject({ resolution: 'UNCONFIRMED_CLOSED' });

    const justAbove = confirmPeakOnCycleClose({
      closingCycle: { variantMode: 'MENOPAUSE', peakTracker: { type: 'NONE' }, entries: singleCandidateEntries() },
      nextCycleStartDate: addDays(start, 4 + 17),
    });
    expect(justAbove).toMatchObject({ resolution: 'UNCONFIRMED_CLOSED' });
  });

  it('criterion e: REGULAR/LACTATION are a pure passthrough of the tracker, ignoring entries/nextCycleStartDate entirely', () => {
    const dummyEntries = [entry(addDays(start, 0))];
    const confirmedTracker: PeakTrackerState = { type: 'CONFIRMED', date: addDays(start, 5) };
    const candidateTracker: PeakTrackerState = { type: 'CANDIDATE', date: addDays(start, 3) };
    const noneTracker: PeakTrackerState = { type: 'NONE' };

    for (const variantMode of ['REGULAR', 'LACTATION'] as const) {
      expect(
        confirmPeakOnCycleClose({
          closingCycle: { variantMode, peakTracker: confirmedTracker, entries: dummyEntries },
          nextCycleStartDate: addDays(start, 100), // irrelevant for passthrough
        }),
      ).toEqual({ resolution: 'CONFIRMED', peakDay: addDays(start, 5) });

      expect(
        confirmPeakOnCycleClose({
          closingCycle: { variantMode, peakTracker: candidateTracker, entries: dummyEntries },
          nextCycleStartDate: addDays(start, 100),
        }),
      ).toEqual({ resolution: 'UNCONFIRMED_CLOSED', lastCandidate: addDays(start, 3) });

      expect(
        confirmPeakOnCycleClose({
          closingCycle: { variantMode, peakTracker: noneTracker, entries: dummyEntries },
          nextCycleStartDate: addDays(start, 100),
        }),
      ).toEqual({ resolution: 'UNCONFIRMED_CLOSED', lastCandidate: null });
    }
  });
});
