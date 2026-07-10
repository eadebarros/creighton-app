import type { MucusColor, MucusSensation, MucusStretch, RawCodeResult } from './types.js';

const UNMAPPED: RawCodeResult = { rawCode: '', tier: 'UNMAPPED' };

const COLOR_SUFFIX: Record<MucusColor, string> = {
  CLEAR: 'C',
  CLOUDY: 'K',
  CLOUDY_CLEAR: 'CK',
  YELLOW: 'Y',
  BROWN: 'B',
  RED: 'R',
};

function colorSuffix(color: MucusColor | undefined): string | null {
  if (color === undefined) return null;
  return COLOR_SUFFIX[color] ?? null;
}

/**
 * Closed lookup, Section 3.1 of the architecture doc. Any combination not
 * explicitly covered here (including malformed runtime data that bypasses
 * TS types) returns UNMAPPED — never throws, never guesses. Callers must
 * treat UNMAPPED as fertile-safe, per the project's non-negotiable
 * "ambiguity resolves to FERTILE" principle.
 */
export function deriveRawCode(
  sensation: MucusSensation,
  stretch: MucusStretch,
  color?: MucusColor,
  shinyReflex?: boolean,
): RawCodeResult {
  switch (stretch) {
    case 'STICKY': {
      const suffix = colorSuffix(color);
      return suffix === null ? UNMAPPED : { rawCode: `6${suffix}`, tier: 'FERTILE' };
    }
    case 'TACKY': {
      const suffix = colorSuffix(color);
      return suffix === null ? UNMAPPED : { rawCode: `8${suffix}`, tier: 'FERTILE' };
    }
    case 'ELASTIC': {
      const suffix = colorSuffix(color);
      return suffix === null ? UNMAPPED : { rawCode: `10${suffix}`, tier: 'HIGHLY_FERTILE' };
    }
    case 'NONE':
      switch (sensation) {
        case 'DRY':
          return shinyReflex
            ? { rawCode: '4', tier: 'FERTILE_ALERT' }
            : { rawCode: '0', tier: 'INFERTILE_POTENTIAL' };
        case 'DAMP':
          return shinyReflex
            ? { rawCode: '4', tier: 'FERTILE_ALERT' }
            : { rawCode: '2', tier: 'INFERTILE_POTENTIAL' };
        case 'WET':
          return { rawCode: '2W', tier: 'FERTILE_ALERT' };
        case 'LUBRICATIVE':
          return { rawCode: '10DL', tier: 'HIGHLY_FERTILE' };
        default:
          return UNMAPPED;
      }
    default:
      return UNMAPPED;
  }
}
