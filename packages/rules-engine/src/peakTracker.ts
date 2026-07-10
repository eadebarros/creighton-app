import { daysBetween } from './dateMath.js';
import { deriveRawCode } from './vdrsLookup.js';
import type { ConfirmedPeak, DailyEntryInput } from './types.js';

type Tracker =
  | { type: 'NONE' }
  | { type: 'CANDIDATE'; date: string; nonPeakOffsets: Set<number> }
  | { type: 'CONFIRMED'; date: string };

export interface PeakTrackerResult {
  confirmed: ConfirmedPeak | null;
  /**
   * The last CANDIDATE date ever opened, whether it went on to confirm or
   * the cycle simply ended with it still pending. Used by fertilityState.ts
   * to label the "CANDIDATE" peak_relation while a cycle awaits confirmation.
   */
  lastCandidateDate: string | null;
}

function isPeakTypeDay(entry: DailyEntryInput): boolean {
  const { tier } = deriveRawCode(
    entry.mucusSensation,
    entry.mucusStretch,
    entry.mucusColor,
    entry.shinyReflex,
  );
  return tier === 'HIGHLY_FERTILE';
}

/**
 * Section 3.2 — walks a cycle's entries in chronological order and runs the
 * Peak Day state machine. Confirmation requires exactly Tc+1, Tc+2, Tc+3 to
 * all be present and "non-peak" (Section 3.2's 3-day rule, locked per the
 * architecture doc's V2 update — 24h is not a valid alternative reading).
 */
export function findConfirmedPeak(entries: DailyEntryInput[]): PeakTrackerResult {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let tracker: Tracker = { type: 'NONE' };
  let lastCandidateDate: string | null = null;

  for (const entry of sorted) {
    if (tracker.type === 'CONFIRMED') break;

    const blockedByBleeding = entry.bleedingType === 'H' || entry.bleedingType === 'M';
    const peakType = isPeakTypeDay(entry);

    if (peakType && !blockedByBleeding) {
      tracker = { type: 'CANDIDATE', date: entry.date, nonPeakOffsets: new Set() };
      lastCandidateDate = entry.date;
      continue;
    }

    if (tracker.type === 'CANDIDATE') {
      const diff = daysBetween(tracker.date, entry.date);
      if (diff >= 1 && diff <= 3) {
        tracker.nonPeakOffsets.add(diff);
        if (tracker.nonPeakOffsets.has(1) && tracker.nonPeakOffsets.has(2) && tracker.nonPeakOffsets.has(3)) {
          tracker = { type: 'CONFIRMED', date: tracker.date };
        }
      }
      // diff <= 0 shouldn't happen given sorted order; diff > 3 means the
      // confirmation window already closed without all three offsets
      // present (e.g. a missing entry) — the candidate stays pending
      // rather than auto-confirming or auto-discarding.
    }
  }

  return {
    confirmed: tracker.type === 'CONFIRMED' ? { date: tracker.date } : null,
    lastCandidateDate,
  };
}
