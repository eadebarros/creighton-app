import type { NextFunction, Request, Response } from 'express';

/** Must run after requireUser. Only a redeemed COOP_PARTNER may reach /partner/* routes. */
export function requirePartnerLink(req: Request, res: Response, next: NextFunction): void {
  const user = req.internalUser;
  if (user.role !== 'COOP_PARTNER' || !user.partnerId) {
    res.status(403).json({ error: 'not_a_linked_partner' });
    return;
  }
  next();
}
