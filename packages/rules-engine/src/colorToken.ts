import type { BleedingType, FertilityState } from './types.js';

export type FertilityColorToken = 'RED' | 'GREEN' | 'WHITE' | 'YELLOW';

export interface ColorTokenInput {
  bleedingType: BleedingType;
  computedState: FertilityState;
  /** Always undefined until LACTATION variant support lands (Sprint 4). */
  pibActive?: boolean;
}

/**
 * Single source of truth for computed_state -> clinical color token (design/README.md
 * Seção 9.1). Never re-derive this ad hoc elsewhere — bleeding takes visual
 * precedence over everything else, including an active PIB seal. Shared
 * between the app (StampBadge, ChartScreen) and the backend (partner
 * dashboard's status endpoint) so both agree on the exact same rule.
 */
export function stateToToken(day: ColorTokenInput): FertilityColorToken {
  if (day.bleedingType !== 'NONE') {
    return 'RED';
  }
  if (day.pibActive) {
    return 'YELLOW';
  }
  if (day.computedState === 'FERTILE') {
    return 'WHITE';
  }
  return 'GREEN';
}
