import type { BleedingType, FertilityState, LactationPhase, PeakRelation } from '@creighton/rules-engine';

export interface ChartDay {
  date: string;
  rawCode: string;
  bleedingType: BleedingType;
  intercourse: boolean;
  computedState: FertilityState;
  peakRelation: PeakRelation;
  pibActive?: boolean;
  lactationPhase?: LactationPhase;
}

export type PhaseLabel = 'Menstruação' | 'Infértil' | 'Fértil' | 'Pós-Ápice';

const POST_PEAK_RELATIONS = new Set<PeakRelation>(['P', 'P1', 'P2', 'P3']);

/**
 * Bleeding takes grouping precedence over the peak window, mirroring the
 * same precedence rule @creighton/rules-engine's stateToToken uses for the
 * stamp color — a P+2 day with breakthrough spotting still reads as "Menstruação".
 */
export function derivePhaseLabel(
  day: Pick<ChartDay, 'bleedingType' | 'computedState' | 'peakRelation'>,
): PhaseLabel {
  if (day.bleedingType !== 'NONE') {
    return 'Menstruação';
  }
  if (POST_PEAK_RELATIONS.has(day.peakRelation)) {
    return 'Pós-Ápice';
  }
  if (day.computedState === 'FERTILE') {
    return 'Fértil';
  }
  return 'Infértil';
}

export interface PhaseGroup {
  label: PhaseLabel;
  days: ChartDay[];
}

/** Groups days into contiguous same-label runs, in the order given (expects date-ascending input). */
export function groupByContiguousPhase(days: ChartDay[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (const day of days) {
    const label = derivePhaseLabel(day);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.days.push(day);
    } else {
      groups.push({ label, days: [day] });
    }
  }
  return groups;
}

/** "P" / "P+1" / "P+2" / "P+3" display label, or null for days with no Peak-window relation. */
export function peakRelationLabel(peakRelation: PeakRelation): string | null {
  switch (peakRelation) {
    case 'P':
      return 'P';
    case 'P1':
      return 'P+1';
    case 'P2':
      return 'P+2';
    case 'P3':
      return 'P+3';
    default:
      return null;
  }
}
