import { RULES_ENGINE_VERSION } from '@creighton/rules-engine';
import { prisma } from '../db/prisma.js';
import { toIsoDate } from '../domain/mapping.js';
import type { ExportPdfBody } from '../validation/exports.js';
import type { ExportCycle, ExportData, ExportDay, RuleEngineVersionPeriod } from './pdfRenderer.js';

export class InsufficientDataError extends Error {}

async function resolveCyclesInScope(userId: string, body: ExportPdfBody) {
  if (body.period === 'current') {
    const cycle = await prisma.cycle.findFirst({ where: { userId, isActive: true } });
    return cycle ? [cycle] : [];
  }
  if (body.period === 'last3') {
    const cycles = await prisma.cycle.findMany({ where: { userId }, orderBy: { startDate: 'desc' }, take: 3 });
    return cycles.reverse();
  }
  // custom — overlap with [customStart, customEnd]
  const start = new Date(`${body.customStart}T00:00:00Z`);
  const end = new Date(`${body.customEnd}T23:59:59Z`);
  return prisma.cycle.findMany({
    where: {
      userId,
      startDate: { lte: end },
      OR: [{ endDate: null }, { endDate: { gte: start } }],
    },
    orderBy: { startDate: 'asc' },
  });
}

async function buildExportCycle(
  cycle: Awaited<ReturnType<typeof resolveCyclesInScope>>[number],
  cycleNumber: number,
): Promise<ExportCycle> {
  const entries = await prisma.dailyEntry.findMany({ where: { cycleId: cycle.id }, orderBy: { date: 'asc' } });
  const entryIds = entries.map((e) => e.id);
  const states = await prisma.dailyFertilityState.findMany({
    where: { dailyEntryId: { in: entryIds }, supersededById: null },
  });
  const stateByEntryId = new Map(states.map((s) => [s.dailyEntryId, s]));

  const observationCounts = await prisma.observation.groupBy({
    by: ['date'],
    where: { cycleId: cycle.id, voided: false },
    _count: { _all: true },
  });
  const countByDate = new Map(observationCounts.map((o) => [toIsoDate(o.date), o._count._all]));

  const days: ExportDay[] = entries.map((entry, i) => {
    const state = stateByEntryId.get(entry.id);
    const date = toIsoDate(entry.date);
    return {
      date,
      dayNumber: i + 1,
      rawCode: entry.rawCode,
      bleedingType: entry.bleedingType,
      computedState: state?.computedState ?? 'FERTILE',
      peakRelation: state?.peakRelation ?? 'NOT_APPLICABLE',
      pibActive: state?.pibActive ?? false,
      intercourse: entry.intercourse,
      observationCount: countByDate.get(date) ?? 1,
    };
  });

  return {
    cycleNumber,
    startDate: toIsoDate(cycle.startDate),
    endDate: cycle.endDate ? toIsoDate(cycle.endDate) : null,
    isActive: cycle.isActive,
    variantMode: cycle.variantModeSnapshot,
    confirmedPeakDay: cycle.confirmedPeakDay ? toIsoDate(cycle.confirmedPeakDay) : null,
    peakResolution: cycle.peakResolution,
    days,
  };
}

async function resolveRuleEngineVersions(cycleIds: string[]): Promise<RuleEngineVersionPeriod[]> {
  const states = await prisma.dailyFertilityState.findMany({
    where: { supersededById: null, dailyEntry: { cycleId: { in: cycleIds } } },
    select: { ruleEngineVersion: true, dailyEntry: { select: { date: true } } },
  });
  if (states.length === 0) {
    return [];
  }
  const byVersion = new Map<string, { from: string; to: string }>();
  for (const s of states) {
    const date = toIsoDate(s.dailyEntry.date);
    const existing = byVersion.get(s.ruleEngineVersion);
    if (!existing) {
      byVersion.set(s.ruleEngineVersion, { from: date, to: date });
    } else {
      if (date < existing.from) existing.from = date;
      if (date > existing.to) existing.to = date;
    }
  }
  return [...byVersion.entries()]
    .map(([version, range]) => ({
      version,
      from: range.from,
      // Only the version still actually in effect today has an open-ended "to" — anything else was fully superseded.
      to: version === RULES_ENGINE_VERSION ? null : range.to,
    }))
    .sort((a, b) => a.from.localeCompare(b.from));
}

function periodLabelFor(body: ExportPdfBody): string {
  if (body.period === 'current') return 'Ciclo atual';
  if (body.period === 'last3') return 'Últimos 3 ciclos';
  return `${body.customStart} — ${body.customEnd}`;
}

/** SPEC 02 — resolves everything `renderCreightonPdf` needs, straight from the server-authoritative tables. */
export async function resolveExportData(userId: string, body: ExportPdfBody): Promise<ExportData> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const cycles = await resolveCyclesInScope(userId, body);
  if (cycles.length === 0) {
    throw new InsufficientDataError('no cycles in the selected period');
  }

  const exportCycles = await Promise.all(cycles.map((c, i) => buildExportCycle(c, i + 1)));
  if (!exportCycles.some((c) => c.days.length > 0)) {
    throw new InsufficientDataError('no entries in the selected period');
  }

  const cycleIds = cycles.map((c) => c.id);
  const [ruleEngineVersions, voidedObservationCount] = await Promise.all([
    resolveRuleEngineVersions(cycleIds),
    prisma.observation.count({ where: { cycleId: { in: cycleIds }, voided: true } }),
  ]);

  return {
    cycles: exportCycles,
    summary: {
      userEmail: user.email,
      generatedAt: toIsoDate(new Date()),
      periodLabel: periodLabelFor(body),
      ruleEngineVersions,
      voidedObservationCount,
    },
  };
}
