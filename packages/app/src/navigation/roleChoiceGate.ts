import type { MeResponse } from '../api/client';

/**
 * Whether to show the one-time "are you tracking your own cycle, or were you
 * invited by a partner?" screen — only for a genuinely fresh account: no
 * partner linked yet AND no local cycle data at all. Any existing Sprint 1/2
 * user (who already has cycles on-device) always skips this, unchanged.
 */
export function shouldShowRoleChoice(me: MeResponse, localCycleCount: number): boolean {
  return me.role === 'PRIMARY_OBSERVER' && me.partner === null && localCycleCount === 0;
}
