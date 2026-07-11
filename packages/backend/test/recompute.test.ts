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
