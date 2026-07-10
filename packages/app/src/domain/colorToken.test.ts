import { describe, expect, it } from 'vitest';
import { stateToToken } from './colorToken';

describe('stateToToken', () => {
  it('bleeding takes precedence over everything else', () => {
    expect(stateToToken({ bleedingType: 'H', computedState: 'INFERTILE_ALTERNATING' })).toBe('RED');
    expect(stateToToken({ bleedingType: 'L', computedState: 'FERTILE' })).toBe('RED');
    expect(stateToToken({ bleedingType: 'B', computedState: 'FERTILE', pibActive: true })).toBe('RED');
  });

  it('PIB active (no bleeding) is yellow, even when computedState is FERTILE', () => {
    expect(stateToToken({ bleedingType: 'NONE', computedState: 'FERTILE', pibActive: true })).toBe('YELLOW');
    expect(stateToToken({ bleedingType: 'NONE', computedState: 'INFERTILE_ALTERNATING', pibActive: true })).toBe(
      'YELLOW',
    );
  });

  it('FERTILE (no bleeding, no PIB) is white', () => {
    expect(stateToToken({ bleedingType: 'NONE', computedState: 'FERTILE' })).toBe('WHITE');
  });

  it('INFERTILE_ALTERNATING / INFERTILE_ABSOLUTE (no bleeding, no PIB) is green', () => {
    expect(stateToToken({ bleedingType: 'NONE', computedState: 'INFERTILE_ALTERNATING' })).toBe('GREEN');
    expect(stateToToken({ bleedingType: 'NONE', computedState: 'INFERTILE_ABSOLUTE' })).toBe('GREEN');
  });
});
