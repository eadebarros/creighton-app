import type { FertilityColorToken } from '@creighton/rules-engine';

/** Indirect, non-clinical phrasing shown to the partner — never the raw token or entry data. */
export function partnerStatusCopy(colorToken: FertilityColorToken | null): string | null {
  switch (colorToken) {
    case 'RED':
      return 'Hoje é um dia de sangramento.';
    case 'GREEN':
      return 'Hoje é um dia livre.';
    case 'WHITE':
      return 'Hoje é um dia de atenção.';
    case 'YELLOW':
      return 'Hoje segue a rotina de amamentação.';
    default:
      return null;
  }
}
