import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
  PORT: z.coerce.number().int().positive().default(3000),
});

/** Fail fast at startup rather than surfacing a confusing error on the first request. */
export const env = envSchema.parse(process.env);
