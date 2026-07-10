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
 */
export function assignStates(
  entries: DailyEntryInput[],
  peakResult: PeakTrackerResult,
): DailyFertilityState[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const { confirmed, lastCandidateDate } = peakResult;

  let mucusPhaseStarted = false;
  let breakthroughDryCountdown = 0;
  let prevState: FertilityState | null = null;
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
      const isBreakthrough =
        mucusPhaseStarted || (confirmed !== null && entry.date > confirmed.date);
      state = 'FERTILE';
      peakRelation = 'NOT_APPLICABLE';
      if (isBreakthrough && (entry.bleedingType === 'L' || entry.bleedingType === 'VL' || entry.bleedingType === 'B')) {
        breakthroughDryCountdown = 3;
      }
      // H/M bleeding that's part of the cycle-opening flow (not yet in the
      // mucus phase) does not start a dry-day tail — it's ordinary menstruation.
    } else if (breakthroughDryCountdown > 0 && isDry) {
      state = 'FERTILE';
      peakRelation = 'NOT_APPLICABLE';
      breakthroughDryCountdown -= 1;
    } else {
      breakthroughDryCountdown = 0;

      // Only days on/after Tc fall in the confirmed post-peak window — days
      // before Tc (even though a peak eventually gets confirmed later in the
      // cycle) must still go through the mucus-phase/alternating-day logic
      // below, exactly as they would have before confirmation happened.
      if (confirmed !== null && entry.date >= confirmed.date) {
        const diff = daysBetween(confirmed.date, entry.date);
        if (diff <= 3) {
          state = 'FERTILE';
          peakRelation = P_LABELS[diff]!;
        } else {
          state = 'INFERTILE_ABSOLUTE';
          peakRelation = 'P4_PLUS';
        }
      } else if (isMucusSignal) {
        mucusPhaseStarted = true;
        state = 'FERTILE';
        peakRelation = entry.date === lastCandidateDate ? 'CANDIDATE' : 'PRE_PEAK';
      } else if (mucusPhaseStarted) {
        state = 'FERTILE';
        peakRelation = 'PRE_PEAK';
      } else if (!isDry) {
        // UNMAPPED/unknown data in the pre-mucus dry phase — ambiguous, safe default.
        state = 'FERTILE';
        peakRelation = 'NOT_APPLICABLE';
      } else {
        // Pre-mucus dry phase: the alternating-day rule.
        if (prevIntercourse) {
          state = 'FERTILE';
        } else if (prevState === 'FERTILE') {
          state = 'FERTILE';
        } else if (isDry) {
          state = 'INFERTILE_ALTERNATING';
        } else {
          state = 'FERTILE';
        }
        peakRelation = 'NOT_APPLICABLE';
      }
    }

    results.push({ date: entry.date, rawCode, computedState: state, peakRelation });
    prevState = state;
    prevIntercourse = entry.intercourse;
  }

  return results;
}
