import { describe, expect, it } from 'vitest';
import { shouldShowRoleChoice } from './roleChoiceGate';

describe('shouldShowRoleChoice', () => {
  it('shows for a fresh PRIMARY_OBSERVER with no partner and no local cycles', () => {
    expect(shouldShowRoleChoice({ role: 'PRIMARY_OBSERVER', partner: null }, 0)).toBe(true);
  });

  it('never shows for an existing user who already has local cycle data', () => {
    expect(shouldShowRoleChoice({ role: 'PRIMARY_OBSERVER', partner: null }, 1)).toBe(false);
  });

  it('never shows once a partner is linked', () => {
    expect(shouldShowRoleChoice({ role: 'PRIMARY_OBSERVER', partner: { email: 'a@b.com' } }, 0)).toBe(false);
  });

  it('never shows for a COOP_PARTNER', () => {
    expect(shouldShowRoleChoice({ role: 'COOP_PARTNER', partner: { email: 'a@b.com' } }, 0)).toBe(false);
  });
});
