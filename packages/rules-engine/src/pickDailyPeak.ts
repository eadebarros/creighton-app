import { deriveRawCode } from './vdrsLookup.js';
import type { BleedingType, MucusColor, MucusSensation, MucusStretch } from './types.js';

export interface Observation {
  id: string;
  date: string;
  observedAt: string;
  bleedingType: BleedingType;
  mucusSensation: MucusSensation;
  mucusStretch: MucusStretch;
  mucusColor?: MucusColor;
  shinyReflex?: boolean;
  intercourse: boolean;
}

export interface DailyConsolidation {
  peakObservationId: string;
  bleedingType: BleedingType;
  intercourse: boolean;
}

const BLEEDING_INTENSITY: Record<BleedingType, number> = { H: 5, M: 4, L: 3, VL: 2, B: 1, NONE: 0 };

/** Fertility ranking of a day's raw_code, least to most fertile (Adendo 01, Seção 2.2). Anything unmapped ranks as the max tier. */
function rankRawCode(rawCode: string): number {
  if (rawCode === '0') return 0;
  if (rawCode === '2') return 1;
  if (rawCode === '2W') return 2;
  if (rawCode === '4') return 3;
  if (rawCode.startsWith('6')) return 4;
  if (rawCode.startsWith('8')) return 5;
  if (rawCode.startsWith('10')) return 6;
  return 6;
}

function isPeakType(obs: Observation): boolean {
  return obs.mucusColor === 'CLEAR' || obs.mucusSensation === 'LUBRICATIVE' || obs.mucusStretch === 'ELASTIC';
}

/**
 * Adendo 01 — a woman observes multiple times a day, but the chart records
 * only the day's peak (most fertile) observation, not the last one and not
 * an average. Pure function: receives every non-voided observation of a
 * single (cycle, date), returns which one wins plus the day's consolidated
 * bleeding/intercourse.
 *
 * Never infer clinical ordering anywhere else — this is the only place
 * fertility ranking of a raw_code is decided.
 */
export function pickDailyPeak(observations: Observation[]): DailyConsolidation {
  if (observations.length === 0) {
    throw new Error('pickDailyPeak requires at least one observation');
  }
  const date = observations[0]!.date;
  if (observations.some((o) => o.date !== date)) {
    throw new Error('pickDailyPeak requires all observations to share the same date');
  }

  let winner = observations[0]!;
  let winnerRank = rankRawCode(deriveRawCode(winner.mucusSensation, winner.mucusStretch, winner.mucusColor, winner.shinyReflex).rawCode);
  let winnerIsPeakType = isPeakType(winner);

  for (const obs of observations.slice(1)) {
    const rank = rankRawCode(deriveRawCode(obs.mucusSensation, obs.mucusStretch, obs.mucusColor, obs.shinyReflex).rawCode);
    const peakType = isPeakType(obs);

    const beatsOnRank = rank > winnerRank;
    const tiesOnRank = rank === winnerRank;
    const beatsOnPeakType = tiesOnRank && peakType && !winnerIsPeakType;
    const tiesOnPeakType = tiesOnRank && peakType === winnerIsPeakType;
    const beatsOnRecency = tiesOnPeakType && obs.observedAt >= winner.observedAt;

    if (beatsOnRank || beatsOnPeakType || beatsOnRecency) {
      winner = obs;
      winnerRank = rank;
      winnerIsPeakType = peakType;
    }
  }

  const bleedingType = observations.reduce<BleedingType>(
    (most, o) => (BLEEDING_INTENSITY[o.bleedingType] > BLEEDING_INTENSITY[most] ? o.bleedingType : most),
    'NONE',
  );
  const intercourse = observations.some((o) => o.intercourse);

  return { peakObservationId: winner.id, bleedingType, intercourse };
}
