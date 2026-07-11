import { daysBetween } from './dateMath.js';
import { deriveRawCode } from './vdrsLookup.js';
import type { DailyEntryInput, DailyFertilityState, FertilityState, LactationPhase } from './types.js';

/**
 * Section 3.5 (Lactação). Not clinically reviewed — same caveat as
 * fullCycle.test.ts's REGULAR fixture; treat as a modeled interpretation of
 * the written spec pending instructor validation (Seção 7).
 *
 * Invariant callers depend on: `pibActive` is only ever true when
 * `computedState === 'INFERTILE_ALTERNATING'` under the established PIB.
 * colorToken.ts's stateToToken checks pibActive *before* computedState, so a
 * stray true on a FERTILE day would paint it YELLOW instead of WHITE,
 * hiding a real fertile/caution signal.
 *
 * "First 15 days" is measured from this cycle's own first entry date, not a
 * cross-cycle "since the mode was selected" count — keeps this variant
 * self-contained within the engine's one-cycle-at-a-time architecture.
 */
export function assignLactationStates(entries: DailyEntryInput[]): DailyFertilityState[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sorted[0]?.date;

  let pibCode: string | null = null;
  let streakCode: string | null = null;
  let streakCount = 0;
  let prevIntercourse = false;

  const results: DailyFertilityState[] = [];

  for (const entry of sorted) {
    const { rawCode } = deriveRawCode(entry.mucusSensation, entry.mucusStretch, entry.mucusColor, entry.shinyReflex);
    const dayNumber = daysBetween(startDate!, entry.date) + 1;

    let computedState: FertilityState;
    let lactationPhase: LactationPhase | undefined;
    let pibActive = false;

    if (dayNumber <= 15) {
      computedState = 'FERTILE';
      lactationPhase = 'OBSERVATION';
      pibCode = null;
      streakCode = null;
      streakCount = 0;
    } else if (entry.bleedingType !== 'NONE') {
      computedState = 'FERTILE';
      lactationPhase = pibCode !== null ? 'PIB_BROKEN' : undefined;
      pibCode = null;
      streakCode = null;
      streakCount = 0;
    } else if (pibCode !== null && rawCode === pibCode) {
      lactationPhase = 'PIB_ACTIVE';
      if (prevIntercourse) {
        // Semen clearing — masks today's reading, but the established
        // pattern itself isn't disturbed (Section 3.5 "deviation" only means
        // a raw_code mismatch, not this).
        computedState = 'FERTILE';
        pibActive = false;
      } else {
        computedState = 'INFERTILE_ALTERNATING';
        pibActive = true;
      }
    } else if (pibCode !== null && rawCode !== pibCode) {
      // Deviation breaks the seal — restart the 3-day count from scratch.
      computedState = 'FERTILE';
      lactationPhase = 'PIB_BROKEN';
      pibCode = null;
      streakCode = null;
      streakCount = 0;
    } else {
      // Day >= 16, no PIB established yet — accumulate matches.
      computedState = 'FERTILE';
      lactationPhase = 'ESTABLISHING_PIB';
      if (streakCode === rawCode) {
        streakCount += 1;
      } else {
        streakCode = rawCode;
        streakCount = 1;
      }
      if (streakCount >= 3) {
        // Established as of this day, but this day itself stays FERTILE —
        // Creighton practice doesn't retroactively downgrade risk once a
        // pattern is noticed in hindsight. Only days after this one benefit.
        pibCode = rawCode;
      }
    }

    results.push({
      date: entry.date,
      rawCode,
      computedState,
      peakRelation: 'NOT_APPLICABLE',
      pibActive,
      lactationPhase,
    });
    prevIntercourse = entry.intercourse;
  }

  return results;
}
