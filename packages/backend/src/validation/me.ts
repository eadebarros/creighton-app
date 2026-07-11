import { z } from 'zod';

export const patchMeBodySchema = z.object({
  instructorCredentialAck: z.boolean().optional(),
  currentVariantMode: z.enum(['REGULAR', 'LACTATION', 'MENOPAUSE', 'BIP']).optional(),
});
