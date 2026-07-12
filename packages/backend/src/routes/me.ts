import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/requireUser.js';
import { requirePrimaryObserver } from '../middleware/requirePrimaryObserver.js';
import { deleteAccount } from '../services/accountDeletionService.js';
import { resolveFullDataExport } from '../services/dataExportService.js';
import { patchMeBodySchema } from '../validation/me.js';
import type { User } from '@prisma/client';

export const meRouter = Router();

/** LGPD portabilidade (SPEC 03 §3.4) — mesmo padrão do pdfExportLimiter (exports.ts), instância própria. */
const dataExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.internalUser.id,
});

/** The invite that created the current link, whichever side created it — used only to show "linked since" in Configurações. */
async function findLinkedAt(userId: string, partnerId: string): Promise<Date | null> {
  const invite = await prisma.partnerInvite.findFirst({
    where: {
      OR: [
        { createdById: userId, usedById: partnerId },
        { createdById: partnerId, usedById: userId },
      ],
    },
    orderBy: { usedAt: 'desc' },
  });
  return invite?.usedAt ?? null;
}

async function serializeMe(user: User) {
  const partner = user.partnerId
    ? await prisma.user.findUnique({ where: { id: user.partnerId }, select: { email: true } })
    : null;
  const linkedAt = user.partnerId ? await findLinkedAt(user.id, user.partnerId) : null;
  return {
    role: user.role,
    partner: partner ? { email: partner.email, linkedAt: linkedAt?.toISOString() ?? null } : null,
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

/** LGPD portabilidade — JSON completo (observações anuladas incluídas, histórico de versões incluído). Nunca pede senha: é a titular pedindo o próprio dado. */
meRouter.get('/me/export-data', requireUser, dataExportLimiter, requirePrimaryObserver, async (req, res, next) => {
  try {
    const data = await resolveFullDataExport(req.internalUser.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="creighton-dados.json"');
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * LGPD — direito de exclusão. A reautenticação de senha acontece no app,
 * client-side, via Clerk (session.attemptFirstFactorVerification) antes
 * deste endpoint ser chamado; aqui só exige uma sessão válida (requireUser),
 * já que não há senha própria neste backend para checar novamente.
 */
meRouter.post('/me/delete-account', requireUser, async (req, res, next) => {
  try {
    await deleteAccount(req.internalUser.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
