import { Router } from 'express';
import { requireUser } from '../middleware/requireUser.js';
import { requirePartnerLink } from '../middleware/requirePartnerLink.js';
import { getPartnerStatus } from '../services/partnerStatusService.js';
import { listAcknowledgments, recordAcknowledgment } from '../services/partnerAcknowledgmentService.js';

export const partnerRouter = Router();

partnerRouter.get('/partner/status', requireUser, requirePartnerLink, async (req, res, next) => {
  try {
    const status = await getPartnerStatus(req.internalUser.id, req.internalUser.partnerId!);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

partnerRouter.post('/partner/acknowledge', requireUser, requirePartnerLink, async (req, res, next) => {
  try {
    await recordAcknowledgment(req.internalUser.id, req.internalUser.partnerId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

partnerRouter.get('/partner/acknowledgments', requireUser, requirePartnerLink, async (req, res, next) => {
  try {
    const acknowledgments = await listAcknowledgments(req.internalUser.id, req.internalUser.partnerId!);
    res.json({ acknowledgments });
  } catch (err) {
    next(err);
  }
});
