import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/express', async () => {
  const mock = await import('./mockClerk.js');
  return { getAuth: mock.getAuth, clerkMiddleware: mock.clerkMiddleware, clerkClient: mock.clerkClient };
});

import request from 'supertest';
import { createApp } from '../src/app.js';
import { buildEntry } from './factories.js';
import { prisma, resetDb } from './setup.js';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Mirrors rules-engine's fullCycle.test.ts fixture — a self-consistent synthetic REGULAR cycle. */
function buildFullCycleEntries(cycleId: string, start: string) {
  return [
    buildEntry(cycleId, addDays(start, 0), { bleedingType: 'H' }),
    buildEntry(cycleId, addDays(start, 1), { bleedingType: 'H' }),
    buildEntry(cycleId, addDays(start, 2), { bleedingType: 'M' }),
    buildEntry(cycleId, addDays(start, 3)),
    buildEntry(cycleId, addDays(start, 4)),
    buildEntry(cycleId, addDays(start, 5)),
    buildEntry(cycleId, addDays(start, 6)),
    buildEntry(cycleId, addDays(start, 7)),
    buildEntry(cycleId, addDays(start, 8), { mucusSensation: 'WET' }),
    buildEntry(cycleId, addDays(start, 9), { mucusSensation: 'WET', mucusStretch: 'TACKY', mucusColor: 'CLOUDY' }),
    buildEntry(cycleId, addDays(start, 10), { mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR' }),
    buildEntry(cycleId, addDays(start, 11)),
    buildEntry(cycleId, addDays(start, 12)),
    buildEntry(cycleId, addDays(start, 13)),
    ...Array.from({ length: 6 }, (_, i) => buildEntry(cycleId, addDays(start, 14 + i))),
  ];
}

async function currentStateByDate(cycleId: string) {
  const states = await prisma.dailyFertilityState.findMany({
    where: { dailyEntry: { cycleId }, supersededById: null },
    include: { dailyEntry: true },
  });
  return new Map(states.map((s) => [s.dailyEntry.date.toISOString().slice(0, 10), s]));
}

/** A LACTATION cycle: observation (days 1-15), PIB established on day 18, then a deviation on day 20. */
function buildLactationEntries(cycleId: string, start: string) {
  const cycle = { id: cycleId, startDate: start, endDate: null, isActive: true, variantModeSnapshot: 'LACTATION' as const };
  const dry = (date: string) => buildEntry(cycleId, date, { cycle });
  return [
    ...Array.from({ length: 15 }, (_, i) => dry(addDays(start, i))), // days 1-15: observation
    dry(addDays(start, 15)), // day 16
    dry(addDays(start, 16)), // day 17
    dry(addDays(start, 17)), // day 18 — established, still FERTILE
    dry(addDays(start, 18)), // day 19 — first PIB_ACTIVE day
    buildEntry(cycleId, addDays(start, 19), { cycle, mucusSensation: 'WET' }), // day 20 — deviation breaks it
  ];
}

describe('peak confirmation + retroactive recompute', () => {
  const start = '2026-04-01';

  it('confirms the peak and lands correct P/P1/P2/P3/P4_PLUS states, even POSTed out of order in one batch', async () => {
    const cycleId = randomUUID();
    const entries = buildFullCycleEntries(cycleId, start);
    const shuffled = [...entries].sort(() => 0.5 - Math.random());

    const res = await request(app).post('/entries').send({ entries: shuffled });
    expect(res.status).toBe(200);

    const cycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } });
    expect(cycle.confirmedPeakDay?.toISOString().slice(0, 10)).toBe(addDays(start, 10));

    const byDate = await currentStateByDate(cycleId);
    expect(byDate.get(addDays(start, 10))).toMatchObject({ peakRelation: 'P', computedState: 'FERTILE' });
    expect(byDate.get(addDays(start, 11))).toMatchObject({ peakRelation: 'P1', computedState: 'FERTILE' });
    expect(byDate.get(addDays(start, 12))).toMatchObject({ peakRelation: 'P2', computedState: 'FERTILE' });
    expect(byDate.get(addDays(start, 13))).toMatchObject({ peakRelation: 'P3', computedState: 'FERTILE' });
    expect(byDate.get(addDays(start, 14))).toMatchObject({
      peakRelation: 'P4_PLUS',
      computedState: 'INFERTILE_ABSOLUTE',
    });
    expect(byDate.get(addDays(start, 19))).toMatchObject({
      peakRelation: 'P4_PLUS',
      computedState: 'INFERTILE_ABSOLUTE',
    });
  });

  it('only versions a DailyFertilityState row when its (state, peakRelation) actually changes', async () => {
    const cycleId = randomUUID();
    const entries = buildFullCycleEntries(cycleId, start);

    // POST day-by-day, like real-time capture — not one batch — so the peak
    // candidate day genuinely gets recomputed (and superseded) multiple times
    // as more days arrive, exactly as it would for a real user.
    for (const entry of entries) {
      const res = await request(app).post('/entries').send({ entries: [entry] });
      expect(res.status).toBe(200);
    }

    const deepDate = addDays(start, 19);
    const deepEntry = await prisma.dailyEntry.findFirstOrThrow({
      where: { cycleId, date: new Date(`${deepDate}T00:00:00Z`) },
    });
    const deepStates = await prisma.dailyFertilityState.findMany({ where: { dailyEntryId: deepEntry.id } });
    expect(deepStates).toHaveLength(1);
    expect(deepStates[0]).toMatchObject({ supersededById: null });

    const peakDate = addDays(start, 10);
    const peakEntry = await prisma.dailyEntry.findFirstOrThrow({
      where: { cycleId, date: new Date(`${peakDate}T00:00:00Z`) },
    });
    const peakStates = await prisma.dailyFertilityState.findMany({ where: { dailyEntryId: peakEntry.id } });
    expect(peakStates.length).toBeGreaterThan(1); // CANDIDATE, then P once Tc+3 confirms it
    const current = peakStates.find((s) => s.supersededById === null);
    expect(current).toMatchObject({ peakRelation: 'P' });
  });

  it('handles two concurrent POST /entries for the same cycle without deadlocking', async () => {
    const cycleId = randomUUID();
    const seed = buildEntry(cycleId, addDays(start, 0), { bleedingType: 'H' });
    await request(app).post('/entries').send({ entries: [seed] });

    const a = buildEntry(cycleId, addDays(start, 1));
    const b = buildEntry(cycleId, addDays(start, 2));

    const [resA, resB] = await Promise.all([
      request(app).post('/entries').send({ entries: [a] }),
      request(app).post('/entries').send({ entries: [b] }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const count = await prisma.dailyEntry.count({ where: { cycleId } });
    expect(count).toBe(3);
  });
});

describe('LACTATION variant recompute', () => {
  const start = '2026-05-01';

  it('is no longer variant-blind — persists pibActive and updates it as the PIB establishes/breaks', async () => {
    const cycleId = randomUUID();
    const entries = buildLactationEntries(cycleId, start);

    for (const entry of entries) {
      const res = await request(app).post('/entries').send({ entries: [entry] });
      expect(res.status).toBe(200);
    }

    const byDate = await currentStateByDate(cycleId);
    expect(byDate.get(addDays(start, 0))).toMatchObject({ computedState: 'FERTILE', pibActive: false });
    expect(byDate.get(addDays(start, 17))).toMatchObject({ computedState: 'FERTILE', pibActive: false });
    expect(byDate.get(addDays(start, 18))).toMatchObject({ computedState: 'INFERTILE_ALTERNATING', pibActive: true });
    expect(byDate.get(addDays(start, 19))).toMatchObject({ computedState: 'FERTILE', pibActive: false });

    const cycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } });
    expect(cycle.confirmedPeakDay).toBeNull(); // peak/Ápice tracking doesn't apply to LACTATION
  });

  it('Adendo 01 — a second, later observation on an already PIB_ACTIVE day reconsolidates the peak and correctly breaks the PIB, versioned via superseded_by', async () => {
    const cycleId = randomUUID();
    // Days 1-19 only — established PIB, day 19 is the first PIB_ACTIVE day (drop the day-20 deviation from the fixture; we reconsolidate day 19 itself instead).
    const entries = buildLactationEntries(cycleId, start).slice(0, -1);

    for (const entry of entries) {
      const res = await request(app).post('/entries').send({ entries: [entry] });
      expect(res.status).toBe(200);
    }

    const day19 = addDays(start, 18);
    const day19Date = new Date(`${day19}T00:00:00Z`);
    const beforeState = await currentStateByDate(cycleId);
    expect(beforeState.get(day19)).toMatchObject({ computedState: 'INFERTILE_ALTERNATING', pibActive: true });

    const dailyEntry = await prisma.dailyEntry.findFirstOrThrow({ where: { cycleId, date: day19Date } });

    // A second, later check the same day reports mucus that deviates from the established PIB.
    const secondObservation = buildEntry(cycleId, day19, {
      cycle: { id: cycleId, startDate: start, endDate: null, isActive: true, variantModeSnapshot: 'LACTATION' },
      dailyEntryId: dailyEntry.id, // a real client reuses the day's existing derived-row id
      mucusSensation: 'WET',
      enteredAt: new Date(`${day19}T22:00:00.000Z`).toISOString(),
    });
    const res = await request(app).post('/entries').send({ entries: [secondObservation] });
    expect(res.status).toBe(200);

    const afterState = await currentStateByDate(cycleId);
    expect(afterState.get(day19)).toMatchObject({ computedState: 'FERTILE', pibActive: false });

    const observationCount = await prisma.observation.count({ where: { cycleId, date: day19Date } });
    expect(observationCount).toBe(2);

    // The old PIB_ACTIVE version must be superseded, not silently overwritten.
    const allStatesForDay = await prisma.dailyFertilityState.findMany({ where: { dailyEntryId: dailyEntry.id } });
    expect(allStatesForDay.length).toBeGreaterThan(1);
    const superseded = allStatesForDay.find((s) => s.supersededById !== null);
    expect(superseded).toMatchObject({ computedState: 'INFERTILE_ALTERNATING', pibActive: true });
  });
});
