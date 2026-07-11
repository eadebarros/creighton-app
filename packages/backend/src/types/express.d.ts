import type { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Set by middleware/requireUser.ts after Clerk auth succeeds. */
      internalUser: User;
    }
  }
}

export {};
