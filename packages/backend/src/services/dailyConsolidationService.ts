import type { Observation as ObservationRow, Prisma } from '@prisma/client';
import { pickDailyPeak } from '@creighton/rules-engine';
import type { Observation as EngineObservation } from '@creighton/rules-engine';
import { toIsoDate } from '../domain/mapping.js';

function toEngineObservation(o: ObservationRow): EngineObservation {
  return {
    id: o.id,
    date: toIsoDate(o.date),
    observedAt: o.observedAt.toISOString(),
    bleedingType: o.bleedingType,
    mucusSensation: o.mucusSensation,
    mucusStretch: o.mucusStretch,
    mucusColor: o.mucusColor ?? undefined,
    shinyReflex: o.shinyReflex ?? undefined,
    intercourse: o.intercourse,
  };
}

/**
 * Adendo 01 — recomputes the day's DailyEntry (the "peak of the day") from
 * every non-voided Observation for (cycleId, date) and upserts it. Called
 * after every new Observation and after every void.
 *
 * `dailyEntryId` is the client-proposed id — same trust model already used
 * for Cycle.id: honored only when this (cycleId, date) has no DailyEntry
 * yet; an existing row keeps its own id (the composite unique constraint,
 * not the id, is the upsert key).
 *
 * If voiding leaves zero observations for the day, there's no peak left —
 * the derived row (and any DailyFertilityState versions hanging off it) is
 * deleted rather than left stale.
 */
export async function consolidateDay(
  tx: Prisma.TransactionClient,
  cycleId: string,
  date: Date,
  dailyEntryId: string,
): Promise<void> {
  const observations = await tx.observation.findMany({ where: { cycleId, date, voided: false } });

  if (observations.length === 0) {
    const existing = await tx.dailyEntry.findUnique({ where: { cycleId_date: { cycleId, date } } });
    if (existing) {
      await tx.dailyFertilityState.deleteMany({ where: { dailyEntryId: existing.id } });
      await tx.dailyEntry.delete({ where: { id: existing.id } });
    }
    return;
  }

  const consolidation = pickDailyPeak(observations.map(toEngineObservation));
  const peak = observations.find((o) => o.id === consolidation.peakObservationId)!;

  const sharedFields = {
    bleedingType: consolidation.bleedingType,
    mucusSensation: peak.mucusSensation,
    mucusStretch: peak.mucusStretch,
    mucusColor: peak.mucusColor,
    shinyReflex: peak.shinyReflex,
    rawCode: peak.rawCode,
    intercourse: consolidation.intercourse,
    peakObservationId: peak.id,
    consolidatedAt: new Date(),
  };

  await tx.dailyEntry.upsert({
    where: { cycleId_date: { cycleId, date } },
    create: {
      id: dailyEntryId,
      cycleId,
      date,
      enteredAt: peak.observedAt,
      entrySource: peak.entrySource,
      ...sharedFields,
    },
    update: sharedFields,
  });
}
