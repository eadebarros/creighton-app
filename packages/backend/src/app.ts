import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { healthRouter } from './routes/health.js';
import { entriesRouter } from './routes/entries.js';
import { syncRouter } from './routes/sync.js';
import { meRouter } from './routes/me.js';
import { partnerInvitesRouter } from './routes/partnerInvites.js';
import { partnerRouter } from './routes/partner.js';
import { exportsRouter } from './routes/exports.js';
import { observationsRouter } from './routes/observations.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(clerkMiddleware());
  app.use(healthRouter);
  app.use(entriesRouter);
  app.use(syncRouter);
  app.use(meRouter);
  app.use(partnerInvitesRouter);
  app.use(partnerRouter);
  app.use(exportsRouter);
  app.use(observationsRouter);
  app.use(errorHandler);
  return app;
}
