import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/requireUser.js';
import { patchMeBodySchema } from '../validation/me.js';
import type { User } from '@prisma/client';

export const meRouter = Router();

async function serializeMe(user: User) {
  const partner = user.partnerId
    ? await prisma.user.findUnique({ where: { id: user.partnerId }, select: { email: true } })
    : null;
  return {
    role: user.role,
    partner: partner ? { email: partner.email } : null,
    instructorCredentialAck: user.instructorCredentialAck,
    currentVariantMode: user.currentVariantMode,
  };
}

meRouter.get('/me', requireUser, async (req, res, next) => {
  try {
    res.json(await serializeMe(req.internalUser));
  } catch (err) {
    next(err);
  }
});

meRouter.patch('/me', requireUser, async (req, res, next) => {
  try {
    const body = patchMeBodySchema.parse(req.body);
    const updated = await prisma.user.update({ where: { id: req.internalUser.id }, data: body });
    res.json(await serializeMe(updated));
  } catch (err) {
    next(err);
  }
});
