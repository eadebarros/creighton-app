import { addDays, daysBetween } from './dateMath.js';
import { isPeakTypeDay } from './peakTracker.js';
import type { DailyEntryInput, VariantMode } from './types.js';

export type PeakTrackerState = { type: 'NONE' } | { type: 'CANDIDATE'; date: string } | { type: 'CONFIRMED'; date: string };

export type PeakClosureResult =
  | { resolution: 'CONFIRMED'; peakDay: string }
  | { resolution: 'UNCONFIRMED_CLOSED'; lastCandidate: string | null };

export interface ConfirmPeakOnCloseInput {
  closingCycle: {
    variantMode: VariantMode;
    peakTracker: PeakTrackerState;
    entries: DailyEntryInput[];
  };
  nextCycleStartDate: string;
}

/**
 * Adendo 01-style state machine, but for MENOPAUSE's multi-candidate case:
 * unlike `findConfirmedPeak` (which `break`s at the first confirmed Tc and
 * never looks further — correct for REGULAR/LACTATION, insufficient here),
 * this walks the WHOLE cycle, resetting to `NONE` after each 3-day
 * confirmation so a later candidate can also be found. Returns every
 * confirmed Tc in chronological order. `findConfirmedPeak` itself is never
 * touched (Adendo 02, Seção 6 — no changes to existing engine signatures).
 */
export function findAllConfirmedTcs(entries: DailyEntryInput[]): string[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let tracker: { type: 'NONE' } | { type: 'CANDIDATE'; date: string; nonPeakOffsets: Set<number> } = { type: 'NONE' };
  const confirmed: string[] = [];

  for (const entry of sorted) {
    const blockedByBleeding = entry.bleedingType === 'H' || entry.bleedingType === 'M';
    const peakType = isPeakTypeDay(entry);

    if (peakType && !blockedByBleeding) {
      tracker = { type: 'CANDIDATE', date: entry.date, nonPeakOffsets: new Set() };
      continue;
    }

    if (tracker.type === 'CANDIDATE') {
      const diff = daysBetween(tracker.date, entry.date);
      if (diff >= 1 && diff <= 3) {
        tracker.nonPeakOffsets.add(diff);
        if (tracker.nonPeakOffsets.has(1) && tracker.nonPeakOffsets.has(2) && tracker.nonPeakOffsets.has(3)) {
          confirmed.push(tracker.date);
          tracker = { type: 'NONE' }; // reset — a later candidate can still be found and confirmed
        }
      }
    }
  }

  return confirmed;
}

/**
 * Adendo 02 — decides a closing cycle's Ápice resolution. The engine stays
 * strictly per-cycle (no signature of any existing function changes to
 * accept multiple cycles); only this new function sees the next cycle's
 * start date, and only for that one cross-cycle check.
 *
 * REGULAR/LACTATION: pure passthrough of the already-known tracker state —
 * neither variant uses the cross-cycle window (their confirmation, if any,
 * already happened intra-cycle via the normal 3-day rule).
 *
 * MENOPAUSE: a candidate's 3-day intra-cycle confirmation (if any) is only
 * ever provisional — it must ADDITIONALLY satisfy 8–16 days (inclusive)
 * between Tc+4 and the real bleeding that opens the next cycle. Multiple
 * candidates can have completed their 3-day test within the same cycle;
 * evaluated most-recent-first, the first to satisfy the window wins.
 * Ambiguity always resolves conservatively: no window satisfied →
 * UNCONFIRMED_CLOSED, never a retroactive INFERTILE_ABSOLUTE.
 */
export function confirmPeakOnCycleClose(input: ConfirmPeakOnCloseInput): PeakClosureResult {
  const { variantMode, peakTracker, entries } = input.closingCycle;

  if (variantMode !== 'MENOPAUSE') {
    if (peakTracker.type === 'CONFIRMED') {
      return { resolution: 'CONFIRMED', peakDay: peakTracker.date };
    }
    return { resolution: 'UNCONFIRMED_CLOSED', lastCandidate: peakTracker.type === 'CANDIDATE' ? peakTracker.date : null };
  }

  const confirmedTcs = findAllConfirmedTcs(entries);
  for (let i = confirmedTcs.length - 1; i >= 0; i--) {
    const tc = confirmedTcs[i]!;
    const windowDays = daysBetween(addDays(tc, 4), input.nextCycleStartDate);
    if (windowDays >= 8 && windowDays <= 16) {
      return { resolution: 'CONFIRMED', peakDay: tc };
    }
  }

  const lastCandidate =
    confirmedTcs.length > 0 ? confirmedTcs[confirmedTcs.length - 1]! : peakTracker.type !== 'NONE' ? peakTracker.date : null;
  return { resolution: 'UNCONFIRMED_CLOSED', lastCandidate };
}
