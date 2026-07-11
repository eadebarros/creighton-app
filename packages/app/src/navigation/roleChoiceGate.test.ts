import { describe, expect, it } from 'vitest';
import { shouldShowRoleChoice } from './roleChoiceGate';

function me(overrides: Partial<Parameters<typeof shouldShowRoleChoice>[0]>) {
  return {
    role: 'PRIMARY_OBSERVER' as const,
    partner: null,
    instructorCredentialAck: true,
    currentVariantMode: 'REGULAR' as const,
    ...overrides,
  };
}

describe('shouldShowRoleChoice', () => {
  it('shows for a fresh PRIMARY_OBSERVER with no partner and no local cycles', () => {
    expect(shouldShowRoleChoice(me({}), 0)).toBe(true);
  });

  it('never shows for an existing user who already has local cycle data', () => {
    expect(shouldShowRoleChoice(me({}), 1)).toBe(false);
  });

  it('never shows once a partner is linked', () => {
    expect(shouldShowRoleChoice(me({ partner: { email: 'a@b.com' } }), 0)).toBe(false);
  });

  it('never shows for a COOP_PARTNER', () => {
    expect(shouldShowRoleChoice(me({ role: 'COOP_PARTNER', partner: { email: 'a@b.com' } }), 0)).toBe(false);
  });
});
