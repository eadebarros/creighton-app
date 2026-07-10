import { daysBetween } from './dateMath.js';
import { deriveRawCode } from './vdrsLookup.js';
import type { PeakTrackerResult } from './peakTracker.js';
import type { DailyEntryInput, DailyFertilityState, FertilityState, PeakRelation } from './types.js';

const P_LABELS: Record<number, PeakRelation> = { 0: 'P', 1: 'P1', 2: 'P2', 3: 'P3' };

/**
 * Section 3.4 — second pass. Assumes the cycle's confirmed peak (if any) is
 * already known (from peakTracker.ts), since this pure function always
 * receives the whole cycle's history at once. That's what makes "retroactive
 * recalculation" a non-issue here: there's nothing to retroactively patch,
 * every call just computes the correct state for every day from scratch.
 *
 * Pre-Peak dry days pass two independent tests before they can be
 * INFERTILE_ALTERNATING (clinically confirmed 2026-07-10):
 *  - Semen clearing: D-1 intercourse forces exactly D FERTILE (not beyond —
 *    it does not cascade to D+1 just because D was FERTILE).
 *  - Wait and see: any real change day (mucus signal, or L/VL/B spotting,
 *    in any phase) opens a 3-dry-day countdown (`changeCountdown`) during
 *    which days stay FERTILE; a 4th consecutive dry day resumes alternating.
 *    A genuine build-up to Peak keeps re-arming this countdown every day
 *    (each mucus day resets it to 3), which is what keeps the whole real
 *    mucus phase FERTILE without needing a separate sticky flag.
 */
export function assignStates(
  entries: DailyEntryInput[],
  peakResult: PeakTrackerResult,
): DailyFertilityState[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const { confirmed, lastCandidateDate } = peakResult;

  let changeCountdown = 0;
  let prevIntercourse = false;

  const results: DailyFertilityState[] = [];

  for (const entry of sorted) {
    const { rawCode, tier } = deriveRawCode(
      entry.mucusSensation,
      entry.mucusStretch,
      entry.mucusColor,
      entry.shinyReflex,
    );
    const isDry = tier === 'INFERTILE_POTENTIAL';
    const isMucusSignal = tier === 'FERTILE' || tier === 'FERTILE_ALERT' || tier === 'HIGHLY_FERTILE';

    let state: FertilityState;
    let peakRelation: PeakRelation;

    if (entry.bleedingType !== 'NONE') {
      state = 'FERTILE';
      peakRelation = 'NOT_APPLICABLE';
      if (entry.bleedingType === 'L' || entry.bleedingType === 'VL' || entry.bleedingType === 'B') {
        changeCountdown = 3;
      }
      // H/M is the main menstrual flow (cycle-opening, or a real new cycle)
      // — it never itself opens a wait-and-see tail; only spotting does.
    } else if (confirmed !== null && entry.date >= confirmed.date) {
      // Only days on/after Tc fall in the confirmed post-peak window — days
      // before Tc (even though a peak eventually gets confirmed later in the
      // cycle) must still go through the mucus-phase/alternating-day logic
      // below, exactly as they would have before confirmation happened.
      const diff = daysBetween(confirmed.date, entry.date);
      if (diff <= 3) {
        state = 'FERTILE';
        peakRelation = P_LABELS[diff]!;
        // P0-P3 is fertile unconditionally; clear any countdown armed by the
        // pre-peak mucus build-up so it can't leak a stale "breakthrough
        // tail" into P4_PLUS once this fixed window ends.
        changeCountdown = 0;
      } else if (changeCountdown > 0 && isDry) {
        state = 'FERTILE';
        peakRelation = 'P4_PLUS';
        changeCountdown -= 1;
      } else {
        state = 'INFERTILE_ABSOLUTE';
        peakRelation = 'P4_PLUS';
      }
    } else if (changeCountdown > 0 && isDry) {
      state = 'FERTILE';
      peakRelation = 'NOT_APPLICABLE';
      changeCountdown -= 1;
    } else if (isMucusSignal) {
      changeCountdown = 3;
      state = 'FERTILE';
      peakRelation = entry.date === lastCandidateDate ? 'CANDIDATE' : 'PRE_PEAK';
    } else if (!isDry) {
      // UNMAPPED/unknown data in the pre-mucus dry phase — ambiguous, safe default.
      state = 'FERTILE';
      peakRelation = 'NOT_APPLICABLE';
    } else {
      // Genuinely dry, no active wait-and-see tail: only semen clearing left to check.
      state = prevIntercourse ? 'FERTILE' : 'INFERTILE_ALTERNATING';
      peakRelation = 'NOT_APPLICABLE';
    }

    results.push({ date: entry.date, rawCode, computedState: state, peakRelation });
    prevIntercourse = entry.intercourse;
  }

  return results;
}
