import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected yyyy-mm-dd');

export const exportPdfBodySchema = z
  .object({
    period: z.enum(['current', 'last3', 'custom']),
    customStart: isoDate.optional(),
    customEnd: isoDate.optional(),
  })
  .refine((body) => body.period !== 'custom' || (body.customStart && body.customEnd), {
    message: 'customStart/customEnd são obrigatórios quando period = custom',
  });

export type ExportPdfBody = z.infer<typeof exportPdfBodySchema>;
