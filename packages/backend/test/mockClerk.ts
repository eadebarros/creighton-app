import type { NextFunction, Request, Response } from 'express';

/**
 * Stand-in for @clerk/express in tests — Sprint 2's tests exercise our own
 * entries/recompute/sync logic, not Clerk's already-battle-tested auth
 * internals. Every request is treated as authenticated as one fixed test user.
 */
export const TEST_CLERK_USER_ID = 'user_test_fixed';
export const TEST_CLERK_EMAIL = 'creighton-test@example.com';

export function getAuth(_req: Request): { userId: string; isAuthenticated: boolean } {
  return { userId: TEST_CLERK_USER_ID, isAuthenticated: true };
}

export function clerkMiddleware() {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}

export const clerkClient = {
  users: {
    async getUser(_id: string) {
      return { emailAddresses: [{ emailAddress: TEST_CLERK_EMAIL }] };
    },
  },
};
