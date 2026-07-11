import { describe, expect, it } from 'vitest';
import { partnerStatusCopy } from './partnerStatusCopy';

describe('partnerStatusCopy', () => {
  it('maps each clinical token to indirect copy', () => {
    expect(partnerStatusCopy('RED')).toBe('Hoje é um dia de sangramento.');
    expect(partnerStatusCopy('GREEN')).toBe('Hoje é um dia livre.');
    expect(partnerStatusCopy('WHITE')).toBe('Hoje é um dia de atenção.');
    expect(partnerStatusCopy('YELLOW')).toBe('Hoje segue a rotina de amamentação.');
  });

  it('returns null when there is no token yet', () => {
    expect(partnerStatusCopy(null)).toBeNull();
  });
});
