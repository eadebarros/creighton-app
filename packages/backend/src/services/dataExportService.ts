import type { Cycle, DailyEntry, DailyFertilityState, Observation } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { toIsoDate } from '../domain/mapping.js';

/**
 * LGPD portabilidade (SPEC 03 §3.4) — a raw, complete dump, distinct from
 * exportDataService.ts's PDF summary. Every Observation (voided included),
 * every DailyEntry, and every DailyFertilityState version (not just the
 * current one — supersededById rows are the audit trail of what the couple
 * was told and when it changed) for this user's cycles.
 */
export interface FullDataExport {
  generatedAt: string;
  cycles: ReturnType<typeof serializeCycle>[];
  observations: ReturnType<typeof serializeObservation>[];
  dailyEntries: ReturnType<typeof serializeDailyEntry>[];
  dailyFertilityStates: ReturnType<typeof serializeState>[];
}

function serializeCycle(cycle: Cycle) {
  return {
    id: cycle.id,
    startDate: toIsoDate(cycle.startDate),
    endDate: cycle.endDate ? toIsoDate(cycle.endDate) : null,
    isActive: cycle.isActive,
    variantModeSnapshot: cycle.variantModeSnapshot,
    confirmedPeakDay: cycle.confirmedPeakDay ? toIsoDate(cycle.confirmedPeakDay) : null,
    peakDayConfirmedAt: cycle.peakDayConfirmedAt?.toISOString() ?? null,
    peakResolution: cycle.peakResolution,
    peakCandidateDate: cycle.peakCandidateDate ? toIsoDate(cycle.peakCandidateDate) : null,
  };
}

function serializeObservation(observation: Observation) {
  return {
    id: observation.id,
    cycleId: observation.cycleId,
    date: toIsoDate(observation.date),
    observedAt: observation.observedAt.toISOString(),
    bleedingType: observation.bleedingType,
    mucusSensation: observation.mucusSensation,
    mucusStretch: observation.mucusStretch,
    mucusColor: observation.mucusColor,
    shinyReflex: observation.shinyReflex,
    rawCode: observation.rawCode,
    intercourse: observation.intercourse,
    entrySource: observation.entrySource,
    voided: observation.voided,
    voidedAt: observation.voidedAt?.toISOString() ?? null,
  };
}

function serializeDailyEntry(entry: DailyEntry) {
  return {
    id: entry.id,
    cycleId: entry.cycleId,
    date: toIsoDate(entry.date),
    bleedingType: entry.bleedingType,
    mucusSensation: entry.mucusSensation,
    mucusStretch: entry.mucusStretch,
    mucusColor: entry.mucusColor,
    shinyReflex: entry.shinyReflex,
    rawCode: entry.rawCode,
    intercourse: entry.intercourse,
    peakOverrideByInstructor: entry.peakOverrideByInstructor,
    enteredAt: entry.enteredAt.toISOString(),
    entrySource: entry.entrySource,
    peakObservationId: entry.peakObservationId,
    consolidatedAt: entry.consolidatedAt?.toISOString() ?? null,
  };
}

function serializeState(state: DailyFertilityState) {
  return {
    id: state.id,
    dailyEntryId: state.dailyEntryId,
    computedState: state.computedState,
    peakRelation: state.peakRelation,
    pibActive: state.pibActive,
    computedAt: state.computedAt.toISOString(),
    ruleEngineVersion: state.ruleEngineVersion,
    supersededById: state.supersededById,
  };
}

export async function resolveFullDataExport(userId: string): Promise<FullDataExport> {
  const cycles = await prisma.cycle.findMany({ where: { userId }, orderBy: { startDate: 'asc' } });
  const cycleIds = cycles.map((c) => c.id);

  const [observations, dailyEntries] = await Promise.all([
    prisma.observation.findMany({ where: { cycleId: { in: cycleIds } }, orderBy: [{ date: 'asc' }, { observedAt: 'asc' }] }),
    prisma.dailyEntry.findMany({ where: { cycleId: { in: cycleIds } }, orderBy: { date: 'asc' } }),
  ]);
  const entryIds = dailyEntries.map((e) => e.id);
  const dailyFertilityStates = entryIds.length
    ? await prisma.dailyFertilityState.findMany({
        where: { dailyEntryId: { in: entryIds } },
        orderBy: { computedAt: 'asc' },
      })
    : [];

  return {
    generatedAt: new Date().toISOString(),
    cycles: cycles.map(serializeCycle),
    observations: observations.map(serializeObservation),
    dailyEntries: dailyEntries.map(serializeDailyEntry),
    dailyFertilityStates: dailyFertilityStates.map(serializeState),
  };
}
