import { z } from 'zod';

export const redeemInviteBodySchema = z.object({
  code: z.string().min(1),
});
