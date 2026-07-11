import type { BleedingType } from './types.js';
import { addDays } from './dateMath.js';

export interface ActiveCycleSummary {
  id: string;
  startDate: string;
  /** Whether this cycle already has at least one daily_entries row. */
  hasEntries: boolean;
}

export type CycleAction =
  | { type: 'USE_EXISTING'; cycleId: string }
  | {
      type: 'OPEN_NEW';
      startDate: string;
      /** Present only when a previous active cycle must be closed first. */
      closePreviousCycle?: { id: string; endDate: string };
    };

/** The most recent entry in the active cycle, if any — used to tell a fresh period apart from its continuation. */
export interface LastEntrySummary {
  date: string;
  bleedingType: BleedingType;
}

/**
 * Decides which cycle a new entry belongs to (briefing Seção 2/3.5's CYCLE
 * concept). Pure — the caller (entryRepository, or the backend's entry
 * service) is responsible for actually creating/closing rows and generating
 * IDs. Shared between packages/app and packages/backend so both run the
 * identical cycle-boundary logic instead of two independently maintained
 * copies.
 *
 * Only real menstrual flow (H/M) opens/closes cycle boundaries — spotting
 * (L/VL/B) never does, mirroring the same distinction already encoded in
 * rules-engine's fertilityState.ts (breakthrough bleeding vs. cycle-opening flow).
 *
 * A new boundary only opens on the FIRST H/M day of a fresh flow — the very
 * next calendar day continuing an H/M day still belongs to the same cycle,
 * otherwise a multi-day period would fragment into one cycle per day.
 */
export function resolveCycleForNewEntry(
  activeCycle: ActiveCycleSummary | null,
  entryDate: string,
  bleedingType: BleedingType,
  lastEntry: LastEntrySummary | null,
): CycleAction {
  if (!activeCycle) {
    // First-ever entry (fresh install) or no cycle currently open — start one
    // regardless of bleeding type; a first-time user can't be forced to
    // begin exactly on a bleeding day.
    return { type: 'OPEN_NEW', startDate: entryDate };
  }

  const isRealFlow = bleedingType === 'H' || bleedingType === 'M';
  const continuesPriorFlow =
    lastEntry !== null &&
    (lastEntry.bleedingType === 'H' || lastEntry.bleedingType === 'M') &&
    addDays(lastEntry.date, 1) === entryDate;

  if (isRealFlow && activeCycle.hasEntries && !continuesPriorFlow) {
    return {
      type: 'OPEN_NEW',
      startDate: entryDate,
      closePreviousCycle: { id: activeCycle.id, endDate: addDays(entryDate, -1) },
    };
  }

  // Spotting/no bleeding, H/M on the still-empty cycle that was just created
  // for it, or H/M continuing yesterday's flow — all belong to the current
  // active cycle.
  return { type: 'USE_EXISTING', cycleId: activeCycle.id };
}
