import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/requireUser.js';

export const meRouter = Router();

meRouter.get('/me', requireUser, async (req, res, next) => {
  try {
    const user = req.internalUser;
    const partner = user.partnerId
      ? await prisma.user.findUnique({ where: { id: user.partnerId }, select: { email: true } })
      : null;
    res.json({ role: user.role, partner: partner ? { email: partner.email } : null });
  } catch (err) {
    next(err);
  }
});
