import { describe, expect, it } from 'vitest';
import { deriveRawCode } from './vdrsLookup.js';

describe('deriveRawCode — Section 3.1 lookup table', () => {
  it('DRY + NONE -> 0, infertile potential', () => {
    expect(deriveRawCode('DRY', 'NONE')).toEqual({ rawCode: '0', tier: 'INFERTILE_POTENTIAL' });
  });

  it('DAMP + NONE -> 2, infertile potential', () => {
    expect(deriveRawCode('DAMP', 'NONE')).toEqual({ rawCode: '2', tier: 'INFERTILE_POTENTIAL' });
  });

  it('WET + NONE -> 2W, fertile alert', () => {
    expect(deriveRawCode('WET', 'NONE')).toEqual({ rawCode: '2W', tier: 'FERTILE_ALERT' });
  });

  it('LUBRICATIVE + NONE -> 10DL, highly fertile', () => {
    expect(deriveRawCode('LUBRICATIVE', 'NONE')).toEqual({ rawCode: '10DL', tier: 'HIGHLY_FERTILE' });
  });

  it('DRY + NONE + shinyReflex -> 4, fertile alert', () => {
    expect(deriveRawCode('DRY', 'NONE', undefined, true)).toEqual({ rawCode: '4', tier: 'FERTILE_ALERT' });
  });

  it('DAMP + NONE + shinyReflex -> 4, fertile alert', () => {
    expect(deriveRawCode('DAMP', 'NONE', undefined, true)).toEqual({ rawCode: '4', tier: 'FERTILE_ALERT' });
  });

  it('WET + NONE + shinyReflex ignores the flag (not asked for this sensation)', () => {
    expect(deriveRawCode('WET', 'NONE', undefined, true)).toEqual({ rawCode: '2W', tier: 'FERTILE_ALERT' });
  });

  it('LUBRICATIVE + NONE + shinyReflex ignores the flag', () => {
    expect(deriveRawCode('LUBRICATIVE', 'NONE', undefined, true)).toEqual({ rawCode: '10DL', tier: 'HIGHLY_FERTILE' });
  });

  const colors = [
    ['CLEAR', 'C'],
    ['CLOUDY', 'K'],
    ['CLOUDY_CLEAR', 'CK'],
    ['YELLOW', 'Y'],
    ['BROWN', 'B'],
    ['RED', 'R'],
  ] as const;

  it.each(colors)('STICKY + %s -> 6%s, fertile', (color, suffix) => {
    expect(deriveRawCode('DRY', 'STICKY', color)).toEqual({ rawCode: `6${suffix}`, tier: 'FERTILE' });
  });

  it.each(colors)('TACKY + %s -> 8%s, fertile', (color, suffix) => {
    expect(deriveRawCode('DAMP', 'TACKY', color)).toEqual({ rawCode: `8${suffix}`, tier: 'FERTILE' });
  });

  it.each(colors)('ELASTIC + %s -> 10%s, highly fertile', (color, suffix) => {
    expect(deriveRawCode('WET', 'ELASTIC', color)).toEqual({ rawCode: `10${suffix}`, tier: 'HIGHLY_FERTILE' });
  });

  it('sensation is irrelevant once stretch is non-NONE (per "(qualquer)" rows)', () => {
    expect(deriveRawCode('DRY', 'STICKY', 'CLEAR')).toEqual(deriveRawCode('LUBRICATIVE', 'STICKY', 'CLEAR'));
  });

  it('STICKY/TACKY/ELASTIC without a color -> UNMAPPED, never throws', () => {
    expect(deriveRawCode('DRY', 'STICKY')).toEqual({ rawCode: '', tier: 'UNMAPPED' });
    expect(deriveRawCode('DRY', 'TACKY')).toEqual({ rawCode: '', tier: 'UNMAPPED' });
    expect(deriveRawCode('DRY', 'ELASTIC')).toEqual({ rawCode: '', tier: 'UNMAPPED' });
  });

  it('unrecognized/malformed runtime values -> UNMAPPED, never throws', () => {
    // @ts-expect-error deliberately malformed to exercise the runtime guard
    expect(deriveRawCode('NOT_A_SENSATION', 'NONE')).toEqual({ rawCode: '', tier: 'UNMAPPED' });
    // @ts-expect-error deliberately malformed to exercise the runtime guard
    expect(deriveRawCode('DRY', 'NOT_A_STRETCH')).toEqual({ rawCode: '', tier: 'UNMAPPED' });
    // @ts-expect-error deliberately malformed to exercise the runtime guard
    expect(deriveRawCode(undefined, undefined)).toEqual({ rawCode: '', tier: 'UNMAPPED' });
  });
});
