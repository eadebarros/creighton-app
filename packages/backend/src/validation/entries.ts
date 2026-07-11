import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected yyyy-mm-dd');

export const bleedingTypeSchema = z.enum(['H', 'M', 'L', 'VL', 'B', 'NONE']);
export const mucusSensationSchema = z.enum(['DRY', 'DAMP', 'WET', 'LUBRICATIVE']);
export const mucusStretchSchema = z.enum(['NONE', 'STICKY', 'TACKY', 'ELASTIC']);
export const mucusColorSchema = z.enum(['CLEAR', 'CLOUDY', 'CLOUDY_CLEAR', 'YELLOW', 'BROWN', 'RED']);
export const variantModeSchema = z.enum(['REGULAR', 'LACTATION', 'MENOPAUSE', 'BIP']);
export const entrySourceSchema = z.enum(['USER', 'INSTRUCTOR_CORRECTION']);

const cycleSchema = z.object({
  id: z.uuid(),
  startDate: isoDate,
  endDate: isoDate.nullable().optional(),
  isActive: z.boolean(),
  variantModeSnapshot: variantModeSchema,
});

/**
 * `rawCode` is intentionally NOT accepted here — the server always re-derives
 * it (see services/entryService.ts). `id` is this OBSERVATION's own id
 * (Adendo 01) — `dailyEntryId` is the separate, stable id of the derived
 * "peak of the day" row this observation may consolidate into, proposed by
 * the client once per (cycle, date) and reused across every same-day
 * observation, same trust model already used for `cycle.id`.
 */
const entrySchema = z.object({
  id: z.uuid(),
  dailyEntryId: z.uuid(),
  cycle: cycleSchema,
  date: isoDate,
  bleedingType: bleedingTypeSchema,
  mucusSensation: mucusSensationSchema,
  mucusStretch: mucusStretchSchema.default('NONE'),
  mucusColor: mucusColorSchema.nullable().optional(),
  shinyReflex: z.boolean().nullable().optional(),
  intercourse: z.boolean(),
  enteredAt: z.iso.datetime(),
  entrySource: entrySourceSchema.default('USER'),
});

export const postEntriesBodySchema = z.object({
  entries: z.array(entrySchema).min(1),
});

export type PostEntriesBody = z.infer<typeof postEntriesBodySchema>;
export type EntryPayload = z.infer<typeof entrySchema>;
