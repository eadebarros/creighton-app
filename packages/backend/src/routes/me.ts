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
    instructorCredentialAckAt: user.instructorCredentialAckAt?.toISOString() ?? null,
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
    const data = { ...body, ...(body.instructorCredentialAck === true ? { instructorCredentialAckAt: new Date() } : {}) };
    const updated = await prisma.user.update({ where: { id: req.internalUser.id }, data });
    res.json(await serializeMe(updated));
  } catch (err) {
    next(err);
  }
});

/**
 * Dev/testing affordance — wipes this account's clinical history (cycles,
 * entries, observations, fertility states) and resets onboarding so the app
 * can be re-tested from a clean slate without a manual DB script. Always
 * scoped to the caller's own userId, same as every other /me route.
 */
meRouter.post('/me/reset-test-data', requireUser, async (req, res, next) => {
  try {
    const userId = req.internalUser.id;
    await prisma.$transaction(
      async (tx) => {
        const cycles = await tx.cycle.findMany({ where: { userId }, select: { id: true } });
        const cycleIds = cycles.map((c) => c.id);
        if (cycleIds.length > 0) {
          await tx.dailyFertilityState.deleteMany({ where: { dailyEntry: { cycleId: { in: cycleIds } } } });
          await tx.dailyEntry.deleteMany({ where: { cycleId: { in: cycleIds } } });
          await tx.observation.deleteMany({ where: { cycleId: { in: cycleIds } } });
          await tx.cycle.deleteMany({ where: { id: { in: cycleIds } } });
        }
        await tx.user.update({
          where: { id: userId },
          data: { instructorCredentialAck: false, instructorCredentialAckAt: null, currentVariantMode: 'REGULAR' },
        });
      },
      { timeout: 30_000 },
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
