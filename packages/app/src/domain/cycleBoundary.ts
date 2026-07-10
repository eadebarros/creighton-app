import type { BleedingType } from '@creighton/rules-engine';
import { addDays } from './dateMath';

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

/**
 * Decides which cycle a new entry belongs to (briefing Seção 2/3.5's CYCLE
 * concept). Pure — the caller (entryRepository) is responsible for actually
 * creating/closing rows and generating IDs.
 *
 * Only real menstrual flow (H/M) opens/closes cycle boundaries — spotting
 * (L/VL/B) never does, mirroring the same distinction already encoded in
 * rules-engine's fertilityState.ts (breakthrough bleeding vs. cycle-opening flow).
 */
export function resolveCycleForNewEntry(
  activeCycle: ActiveCycleSummary | null,
  entryDate: string,
  bleedingType: BleedingType,
): CycleAction {
  if (!activeCycle) {
    // First-ever entry (fresh install) or no cycle currently open — start one
    // regardless of bleeding type; a first-time user can't be forced to
    // begin exactly on a bleeding day.
    return { type: 'OPEN_NEW', startDate: entryDate };
  }

  const isRealFlow = bleedingType === 'H' || bleedingType === 'M';

  if (isRealFlow && activeCycle.hasEntries) {
    return {
      type: 'OPEN_NEW',
      startDate: entryDate,
      closePreviousCycle: { id: activeCycle.id, endDate: addDays(entryDate, -1) },
    };
  }

  // Spotting/no bleeding, or H/M on the still-empty cycle that was just
  // created for it — both simply belong to the current active cycle.
  return { type: 'USE_EXISTING', cycleId: activeCycle.id };
}
