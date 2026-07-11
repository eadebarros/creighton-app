import { Router } from 'express';
import { z } from 'zod';
import { requireUser } from '../middleware/requireUser.js';
import { getSyncSince } from '../services/syncService.js';

export const syncRouter = Router();

const querySchema = z.object({
  since: z.iso.datetime(),
});

syncRouter.get('/sync', requireUser, async (req, res, next) => {
  try {
    const { since } = querySchema.parse(req.query);
    const response = await getSyncSince(req.internalUser.id, new Date(since));
    res.json(response);
  } catch (err) {
    next(err);
  }
});
