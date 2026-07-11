import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { healthRouter } from './routes/health.js';
import { entriesRouter } from './routes/entries.js';
import { syncRouter } from './routes/sync.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(clerkMiddleware());
  app.use(healthRouter);
  app.use(entriesRouter);
  app.use(syncRouter);
  app.use(errorHandler);
  return app;
}
