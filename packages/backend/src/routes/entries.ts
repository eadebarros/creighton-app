import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireUser } from '../middleware/requireUser.js';
import { processEntryBatch } from '../services/entryService.js';
import { postEntriesBodySchema } from '../validation/entries.js';

export const entriesRouter = Router();

entriesRouter.post('/entries', requireUser, async (req, res, next) => {
  try {
    const body = postEntriesBodySchema.parse(req.body);
    // Default Prisma transaction timeout (5s) is too short for a multi-day
    // offline-queue batch, each entry needing several sequential round trips —
    // bounded well above worst-case (a few dozen queued days), not unbounded.
    const results = await prisma.$transaction(
      (tx) => processEntryBatch(tx, req.internalUser.id, body.entries),
      { timeout: 30_000 },
    );
    res.json({ results });
  } catch (err) {
    next(err);
  }
});
