import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requirePrimaryObserver } from '../middleware/requirePrimaryObserver.js';
import { requireUser } from '../middleware/requireUser.js';
import { InsufficientDataError, resolveExportData } from '../services/exportDataService.js';
import { renderCreightonPdf } from '../services/pdfRenderer.js';
import { exportPdfBodySchema } from '../validation/exports.js';

export const exportsRouter = Router();

/** SPEC 02, Seção 4.4 — cheap abuse protection, keyed by account (must run after requireUser). */
const pdfExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.internalUser.id,
});

exportsRouter.post(
  '/exports/pdf',
  requireUser,
  pdfExportLimiter,
  requirePrimaryObserver,
  async (req, res, next) => {
    try {
      const body = exportPdfBodySchema.parse(req.body);
      const data = await resolveExportData(req.internalUser.id, body);
      const pdf = await renderCreightonPdf(data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="creighton-export.pdf"');
      res.send(pdf);
    } catch (err) {
      if (err instanceof InsufficientDataError) {
        res.status(422).json({ error: 'insufficient_data' });
        return;
      }
      next(err);
    }
  },
);
