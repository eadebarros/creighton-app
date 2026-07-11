import type { NextFunction, Request, Response } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import { prisma } from '../db/prisma.js';

/**
 * Requires a valid Clerk session (via the global clerkMiddleware()) and maps
 * it to our own `User` row, creating one just-in-time on a caller's first
 * authenticated request — Sprint 2 has no signup form of our own, Clerk's
 * client-side hooks handle signup/login. Attaches the row as `req.internalUser`.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId, isAuthenticated } = getAuth(req);
  if (!isAuthenticated || !userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    let user = await prisma.user.findUnique({ where: { clerkUserId: userId } });
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) {
        res.status(400).json({ error: 'Clerk user has no email address on file' });
        return;
      }
      user = await prisma.user.create({
        data: {
          clerkUserId: userId,
          email,
          role: 'PRIMARY_OBSERVER',
          currentVariantMode: 'REGULAR',
          instructorCredentialAck: false,
        },
      });
    }
    req.internalUser = user;
    next();
  } catch (err) {
    next(err);
  }
}
