import type { NextFunction, Request, Response } from 'express';

/**
 * Must run after requireUser. SPEC 02 — exporting raw clinical data is the
 * prerogative of whoever produces it. A COOP_PARTNER gets 403 regardless of
 * the partner-privacy configuration; there is no setting that overrides this.
 */
export function requirePrimaryObserver(req: Request, res: Response, next: NextFunction): void {
  const user = req.internalUser;
  if (user.role !== 'PRIMARY_OBSERVER') {
    res.status(403).json({ error: 'not_primary_observer' });
    return;
  }
  next();
}
