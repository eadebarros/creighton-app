import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/requireUser.js';
import { consolidateDay } from '../services/dailyConsolidationService.js';
import { recomputeCycleFertilityStates } from '../services/recomputeCycle.js';

export const observationsRouter = Router();

/**
 * Adendo 01 gap fix: voiding was app-local only — the server never learned
 * about it, so cross-device state (partner dashboard, PDF export's voided
 * count) never reflected a void. Mirrors observationRepository.ts's
 * voidObservation on the app side: mark voided, reconsolidate the day, then
 * recompute (in that order).
 */
observationsRouter.post('/observations/:id/void', requireUser, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (typeof id !== 'string') {
      res.status(400).json({ error: 'invalid_id' });
      return;
    }
    const observation = await prisma.observation.findUnique({ where: { id } });
    if (!observation) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const cycle = await prisma.cycle.findUniqueOrThrow({ where: { id: observation.cycleId } });
    if (cycle.userId !== req.internalUser.id) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.observation.update({ where: { id: observation.id }, data: { voided: true, voidedAt: new Date() } });
      const dailyEntry = await tx.dailyEntry.findUnique({
        where: { cycleId_date: { cycleId: observation.cycleId, date: observation.date } },
      });
      await consolidateDay(tx, observation.cycleId, observation.date, dailyEntry?.id ?? observation.id);
      await recomputeCycleFertilityStates(tx, observation.cycleId);
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
