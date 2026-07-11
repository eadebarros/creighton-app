import { Router } from 'express';
import { requireUser } from '../middleware/requireUser.js';
import { getOrCreateActiveInvite, redeemInvite } from '../services/partnerInviteService.js';
import { redeemInviteBodySchema } from '../validation/partner.js';

export const partnerInvitesRouter = Router();

partnerInvitesRouter.post('/partner-invites', requireUser, async (req, res, next) => {
  try {
    const invite = await getOrCreateActiveInvite(req.internalUser.id);
    res.json(invite);
  } catch (err) {
    next(err);
  }
});

partnerInvitesRouter.post('/partner-invites/redeem', requireUser, async (req, res, next) => {
  try {
    const { code } = redeemInviteBodySchema.parse(req.body);
    const result = await redeemInvite(code, req.internalUser.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
