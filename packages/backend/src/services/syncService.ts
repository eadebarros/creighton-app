import { prisma } from '../db/prisma.js';
import { toIsoDate } from '../domain/mapping.js';

export interface SyncResponse {
  serverTime: string;
  cycles: {
    id: string;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    variantModeSnapshot: string;
    confirmedPeakDay: string | null;
    peakDayConfirmedAt: string | null;
  }[];
  fertilityStates: {
    entryId: string;
    cycleId: string;
    date: string;
    computedState: string;
    peakRelation: string;
    computedAt: string;
    ruleEngineVersion: string;
  }[];
}

/** No pagination — single-user Sprint 2 scope has nowhere near enough data volume to justify cursor logic yet. */
const MAX_FERTILITY_STATE_ROWS = 1000;

/**
 * All of the caller's cycles (cheap — a handful per user, no `since` filter
 * needed) plus current (`supersededById IS NULL`) fertility states computed
 * after `since`. The response's own `serverTime` is what the client must use
 * as its next `since` — never the client's own clock.
 */
export async function getSyncSince(userId: string, since: Date): Promise<SyncResponse> {
  const serverTime = new Date();

  const cycles = await prisma.cycle.findMany({
    where: { userId },
    orderBy: { startDate: 'asc' },
  });

  const states = await prisma.dailyFertilityState.findMany({
    where: {
      supersededById: null,
      computedAt: { gt: since },
      dailyEntry: { cycle: { userId } },
    },
    include: { dailyEntry: true },
    orderBy: { computedAt: 'asc' },
    take: MAX_FERTILITY_STATE_ROWS,
  });

  return {
    serverTime: serverTime.toISOString(),
    cycles: cycles.map((cycle) => ({
      id: cycle.id,
      startDate: toIsoDate(cycle.startDate),
      endDate: cycle.endDate ? toIsoDate(cycle.endDate) : null,
      isActive: cycle.isActive,
      variantModeSnapshot: cycle.variantModeSnapshot,
      confirmedPeakDay: cycle.confirmedPeakDay ? toIsoDate(cycle.confirmedPeakDay) : null,
      peakDayConfirmedAt: cycle.peakDayConfirmedAt ? cycle.peakDayConfirmedAt.toISOString() : null,
    })),
    fertilityStates: states.map((state) => ({
      entryId: state.dailyEntryId,
      cycleId: state.dailyEntry.cycleId,
      date: toIsoDate(state.dailyEntry.date),
      computedState: state.computedState,
      peakRelation: state.peakRelation,
      computedAt: state.computedAt.toISOString(),
      ruleEngineVersion: state.ruleEngineVersion,
    })),
  };
}
