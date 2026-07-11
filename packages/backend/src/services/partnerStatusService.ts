import { daysBetween, stateToToken } from '@creighton/rules-engine';
import type { FertilityColorToken, PeakRelation } from '@creighton/rules-engine';
import { prisma } from '../db/prisma.js';
import { toIsoDate } from '../domain/mapping.js';

export interface PartnerStatus {
  hasActiveCycle: boolean;
  /** Server-authoritative "today" — the app should never substitute its own clock. */
  today: string;
  /** The date the token/peakRelation below actually reflect — may lag `today` if she hasn't logged yet. */
  asOfDate: string | null;
  cycleDay: number | null;
  colorToken: FertilityColorToken | null;
  peakRelation: PeakRelation | null;
  acknowledgedToday: boolean;
}

async function hasAcknowledgedToday(
  partnerUserId: string,
  primaryUserId: string,
  todayIso: string,
): Promise<boolean> {
  const row = await prisma.partnerAcknowledgment.findUnique({
    where: {
      partnerUserId_primaryUserId_date: {
        partnerUserId,
        primaryUserId,
        date: new Date(`${todayIso}T00:00:00Z`),
      },
    },
  });
  return row !== null;
}

/**
 * Reads what's already persisted (recomputeCycleFertilityStates writes these
 * whenever the primary's entries change) — never re-runs the rules engine
 * for this read path. Deliberately narrow: only today's summary, never raw
 * entries or history (briefing Seção 6/9.3 — LGPD minimization + "discreet"
 * dashboard). If she hasn't logged today yet, `asOfDate` lags `today` rather
 * than fabricating a token for a day with no data.
 */
export async function getPartnerStatus(partnerUserId: string, primaryUserId: string): Promise<PartnerStatus> {
  const todayIso = toIsoDate(new Date());
  const acknowledgedToday = await hasAcknowledgedToday(partnerUserId, primaryUserId, todayIso);

  const cycle = await prisma.cycle.findFirst({ where: { userId: primaryUserId, isActive: true } });
  if (!cycle) {
    return {
      hasActiveCycle: false,
      today: todayIso,
      asOfDate: null,
      cycleDay: null,
      colorToken: null,
      peakRelation: null,
      acknowledgedToday,
    };
  }

  const cycleDay = daysBetween(toIsoDate(cycle.startDate), todayIso) + 1;
  const latest = await prisma.dailyFertilityState.findFirst({
    where: { supersededById: null, dailyEntry: { cycleId: cycle.id } },
    include: { dailyEntry: true },
    orderBy: { dailyEntry: { date: 'desc' } },
  });
  if (!latest) {
    return {
      hasActiveCycle: true,
      today: todayIso,
      asOfDate: null,
      cycleDay,
      colorToken: null,
      peakRelation: null,
      acknowledgedToday,
    };
  }

  return {
    hasActiveCycle: true,
    today: todayIso,
    asOfDate: toIsoDate(latest.dailyEntry.date),
    cycleDay,
    colorToken: stateToToken({
      bleedingType: latest.dailyEntry.bleedingType,
      computedState: latest.computedState,
      pibActive: latest.pibActive,
    }),
    peakRelation: latest.peakRelation,
    acknowledgedToday,
  };
}
