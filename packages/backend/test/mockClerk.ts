import type { NextFunction, Request, Response } from 'express';

/**
 * Stand-in for @clerk/express in tests — Sprint 2's tests exercise our own
 * entries/recompute/sync logic, not Clerk's already-battle-tested auth
 * internals. Defaults to one fixed test user; Sprint 3's partner tests need
 * a second, distinct identity, selected via the `x-test-user-id` header (see
 * factories.ts's `asUser` helper) — existing tests never set that header, so
 * they're unaffected.
 */
export const TEST_CLERK_USER_ID = 'user_test_fixed';
export const TEST_CLERK_EMAIL = 'creighton-test@example.com';

export function getAuth(req: Request): { userId: string; isAuthenticated: boolean } {
  const userId = req.header('x-test-user-id') ?? TEST_CLERK_USER_ID;
  return { userId, isAuthenticated: true };
}

export function clerkMiddleware() {
  return (_req: Request, _res: Response, next: NextFunction) => next();
}

export const clerkClient = {
  users: {
    async getUser(id: string) {
      const email = id === TEST_CLERK_USER_ID ? TEST_CLERK_EMAIL : `${id}@example.com`;
      return { emailAddresses: [{ emailAddress: email }] };
    },
  },
};
