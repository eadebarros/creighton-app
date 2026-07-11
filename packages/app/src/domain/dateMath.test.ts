import { describe, expect, it } from 'vitest';
import { today } from './dateMath';

describe('dateMath', () => {
  it('today returns an ISO yyyy-mm-dd string', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
