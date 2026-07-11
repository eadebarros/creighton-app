import { assignStates } from './fertilityState.js';
import { findConfirmedPeak } from './peakTracker.js';
import { assignLactationStates } from './variantLactation.js';
import type { DailyEntryInput, DailyFertilityState, VariantMode } from './types.js';
import { VariantNotImplementedError } from './types.js';

/**
 * The Creighton Rules Engine's single entry point. Pure function, no I/O:
 * (cycle history, variant mode) -> fertility state per day.
 *
 * `entries` must already be scoped to a single cycle by the caller. Because
 * the function always sees the whole cycle at once, "retroactive recalculation"
 * (Section 3.3 of the architecture doc) falls out for free — every call just
 * recomputes every day correctly from scratch. Persisting that as versioned
 * DAILY_FERTILITY_STATE rows (superseded_by, etc.) is the caller's job.
 */
export function computeFertilityStates(
  entries: DailyEntryInput[],
  variantMode: VariantMode,
): DailyFertilityState[] {
  if (variantMode === 'LACTATION') {
    return assignLactationStates(entries);
  }
  if (variantMode !== 'REGULAR') {
    throw new VariantNotImplementedError(variantMode);
  }
  const peakResult = findConfirmedPeak(entries);
  return assignStates(entries, peakResult);
}

export { deriveRawCode } from './vdrsLookup.js';
export { findConfirmedPeak } from './peakTracker.js';
export { assignStates } from './fertilityState.js';
export { assignLactationStates } from './variantLactation.js';
export * from './types.js';
export * from './cycleBoundary.js';
export * from './colorToken.js';
export { addDays, daysBetween } from './dateMath.js';

/**
 * Hand-maintained — bump on any clinically-meaningful change to the VDRS
 * lookup table or the Peak/fertility state machine. Stored on each
 * DAILY_FERTILITY_STATE row server-side (Section 2 of the architecture doc)
 * for traceability of which engine version produced a given computed state.
 */
export const RULES_ENGINE_VERSION = '0.1.0';

