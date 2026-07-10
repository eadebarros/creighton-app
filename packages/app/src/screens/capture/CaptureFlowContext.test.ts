import { describe, expect, it } from 'vitest';
import { backStepFor, dotIndexForStep, totalDots } from './CaptureFlowContext';

describe('totalDots', () => {
  it('is 3 when sensation is unset or Seco (DRY)', () => {
    expect(totalDots(undefined)).toBe(3);
    expect(totalDots('DRY')).toBe(3);
  });

  it('is 4 once a non-Seco sensation is answered', () => {
    expect(totalDots('DAMP')).toBe(4);
    expect(totalDots('WET')).toBe(4);
    expect(totalDots('LUBRICATIVE')).toBe(4);
  });
});

describe('dotIndexForStep', () => {
  it('maps bleeding/sensation to fixed dots 0/1', () => {
    expect(dotIndexForStep('bleeding', undefined)).toBe(0);
    expect(dotIndexForStep('sensation', undefined)).toBe(1);
  });

  it('mucusColor and mucusStretch share dot 2', () => {
    expect(dotIndexForStep('mucusColor', 'WET')).toBe(2);
    expect(dotIndexForStep('mucusStretch', 'WET')).toBe(2);
  });

  it('intercourse is dot 2 when Seco (mucus branch skipped), else dot 3', () => {
    expect(dotIndexForStep('intercourse', 'DRY')).toBe(2);
    expect(dotIndexForStep('intercourse', 'WET')).toBe(3);
  });

  it('done has no active dot', () => {
    expect(dotIndexForStep('done', 'WET')).toBe(-1);
  });
});

describe('backStepFor', () => {
  it('bleeding has no back step', () => {
    expect(backStepFor('bleeding', undefined)).toBeNull();
  });

  it('sensation goes back to bleeding', () => {
    expect(backStepFor('sensation', undefined)).toBe('bleeding');
  });

  it('mucusColor -> sensation, mucusStretch -> mucusColor', () => {
    expect(backStepFor('mucusColor', 'WET')).toBe('sensation');
    expect(backStepFor('mucusStretch', 'WET')).toBe('mucusColor');
  });

  it('intercourse goes back to sensation when Seco, else mucusStretch', () => {
    expect(backStepFor('intercourse', 'DRY')).toBe('sensation');
    expect(backStepFor('intercourse', 'WET')).toBe('mucusStretch');
  });

  it('done has no back step', () => {
    expect(backStepFor('done', 'WET')).toBeNull();
  });
});
