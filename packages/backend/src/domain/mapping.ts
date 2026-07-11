import type { DailyEntry } from '@prisma/client';
import type { DailyEntryInput } from '@creighton/rules-engine';

/** ISO yyyy-mm-dd from a Postgres DATE column (Prisma returns a UTC-midnight Date). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Prisma row -> the rules-engine's input shape. */
export function entryToInput(entry: DailyEntry): DailyEntryInput {
  return {
    date: toIsoDate(entry.date),
    bleedingType: entry.bleedingType,
    mucusSensation: entry.mucusSensation,
    mucusStretch: entry.mucusStretch,
    mucusColor: entry.mucusColor ?? undefined,
    shinyReflex: entry.shinyReflex ?? undefined,
    intercourse: entry.intercourse,
  };
}
