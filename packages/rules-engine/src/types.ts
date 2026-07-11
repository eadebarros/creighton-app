export type BleedingType = 'H' | 'M' | 'L' | 'VL' | 'B' | 'NONE';

export type MucusSensation = 'DRY' | 'DAMP' | 'WET' | 'LUBRICATIVE';

export type MucusStretch = 'NONE' | 'STICKY' | 'TACKY' | 'ELASTIC';

export type MucusColor = 'CLEAR' | 'CLOUDY' | 'CLOUDY_CLEAR' | 'YELLOW' | 'BROWN' | 'RED';

export type VariantMode = 'REGULAR' | 'LACTATION' | 'MENOPAUSE' | 'BIP';

export type FertilityState = 'FERTILE' | 'INFERTILE_ALTERNATING' | 'INFERTILE_ABSOLUTE';

export type LactationPhase = 'OBSERVATION' | 'ESTABLISHING_PIB' | 'PIB_ACTIVE' | 'PIB_BROKEN';

export type PeakRelation =
  | 'PRE_PEAK'
  | 'CANDIDATE'
  | 'P'
  | 'P1'
  | 'P2'
  | 'P3'
  | 'P4_PLUS'
  | 'NOT_APPLICABLE';

export type FertilityTier =
  | 'INFERTILE_POTENTIAL'
  | 'FERTILE'
  | 'FERTILE_ALERT'
  | 'HIGHLY_FERTILE'
  | 'UNMAPPED';

export interface DailyEntryInput {
  date: string;
  bleedingType: BleedingType;
  mucusSensation: MucusSensation;
  mucusStretch: MucusStretch;
  mucusColor?: MucusColor;
  /** Only meaningful when mucusSensation is DRY or DAMP — that's the only time the capture flow asks for it. */
  shinyReflex?: boolean;
  intercourse: boolean;
}

export interface DailyFertilityState {
  date: string;
  rawCode: string;
  computedState: FertilityState;
  peakRelation: PeakRelation;
  /** Only meaningful for LACTATION — true exactly when computedState is INFERTILE_ALTERNATING under an established PIB. */
  pibActive?: boolean;
  /** Only set for LACTATION. */
  lactationPhase?: LactationPhase;
}

export interface RawCodeResult {
  rawCode: string;
  tier: FertilityTier;
}

export interface ConfirmedPeak {
  date: string;
}

export class VariantNotImplementedError extends Error {
  constructor(variantMode: VariantMode) {
    super(
      `VariantMode "${variantMode}" is not implemented yet. Only REGULAR is supported by @creighton/rules-engine at this stage (Sprint 0). See Section 5/3.5 of the architecture doc.`,
    );
    this.name = 'VariantNotImplementedError';
  }
}
