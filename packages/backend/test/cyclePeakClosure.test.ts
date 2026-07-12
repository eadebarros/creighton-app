import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/express', async () => {
  const mock = await import('./mockClerk.js');
  return { getAuth: mock.getAuth, clerkMiddleware: mock.clerkMiddleware, clerkClient: mock.clerkClient };
});

import request from 'supertest';
import { createApp } from '../src/app.js';
import { asUser, buildEntry } from './factories.js';
import { prisma, resetDb } from './setup.js';
import { TEST_CLERK_USER_ID } from './mockClerk.js';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function currentStateByDate(cycleId: string) {
  const states = await prisma.dailyFertilityState.findMany({
    where: { dailyEntry: { cycleId }, supersededById: null },
    include: { dailyEntry: true },
  });
  return new Map(states.map((s) => [s.dailyEntry.date.toISOString().slice(0, 10), s]));
}

/** A MENOPAUSE cycle with one candidate at `start`, confirmed via 3 non-peak days, plus a few more dry days. */
function buildMenopauseCycleEntries(cycleId: string, start: string, extraDryDays = 10) {
  const cycle = { id: cycleId, startDate: start, endDate: null, isActive: true, variantModeSnapshot: 'MENOPAUSE' as const };
  return [
    buildEntry(cycleId, start, { cycle, mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR' }), // Tc
    ...Array.from({ length: 3 + extraDryDays }, (_, i) => buildEntry(cycleId, addDays(start, 1 + i), { cycle })),
  ];
}

function closingFlowEntry(cycleId: string, date: string) {
  const cycle = { id: cycleId, startDate: date, endDate: null, isActive: true, variantModeSnapshot: 'MENOPAUSE' as const };
  return buildEntry(cycleId, date, { cycle, bleedingType: 'H' });
}

describe('Adendo 02 — Ápice cross-ciclo (Pré-menopausa)', () => {
  it('criterion a: bleeding 10 days after Tc+4 confirms the cycle and cascades P/P1-P3/INFERTILE_ABSOLUTE retroactively', async () => {
    const start = '2026-04-01';
    const cycle1Id = randomUUID();

    for (const entry of buildMenopauseCycleEntries(cycle1Id, start)) {
      await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [entry] });
    }

    const cycle2Id = randomUUID();
    const closeDate = addDays(start, 4 + 10); // Tc+4+10, within the 8-16 window
    await request(app)
      .post('/entries')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ entries: [closingFlowEntry(cycle2Id, closeDate)] });

    const closedCycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycle1Id } });
    expect(closedCycle.peakResolution).toBe('CONFIRMED');
    expect(closedCycle.confirmedPeakDay?.toISOString().slice(0, 10)).toBe(start);

    const states = await currentStateByDate(cycle1Id);
    expect(states.get(start)).toMatchObject({ peakRelation: 'P', computedState: 'FERTILE' });
    expect(states.get(addDays(start, 1))).toMatchObject({ peakRelation: 'P1', computedState: 'FERTILE' });
    expect(states.get(addDays(start, 3))).toMatchObject({ peakRelation: 'P3', computedState: 'FERTILE' });
    expect(states.get(addDays(start, 4))).toMatchObject({ peakRelation: 'P4_PLUS', computedState: 'INFERTILE_ABSOLUTE' });
  });

  it('criterion b: bleeding only 5 days after Tc+4 (before the window) → UNCONFIRMED_CLOSED, no cascade', async () => {
    const start = '2026-04-10';
    const cycle1Id = randomUUID();

    for (const entry of buildMenopauseCycleEntries(cycle1Id, start, 0)) {
      await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [entry] });
    }

    const cycle2Id = randomUUID();
    const closeDate = addDays(start, 4 + 5); // before the window
    await request(app)
      .post('/entries')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ entries: [closingFlowEntry(cycle2Id, closeDate)] });

    const closedCycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycle1Id } });
    expect(closedCycle.peakResolution).toBe('UNCONFIRMED_CLOSED');
    expect(closedCycle.confirmedPeakDay).toBeNull();

    const states = await currentStateByDate(cycle1Id);
    expect(states.get(addDays(start, 1))).toMatchObject({ peakRelation: 'NOT_APPLICABLE' });
    expect([...states.values()].every((s) => s.computedState !== 'INFERTILE_ABSOLUTE')).toBe(true);
  });

  it('criterion d: two candidates, only the older satisfies the window → the older is confirmed', async () => {
    const start = '2026-05-01';
    const cycle1Id = randomUUID();
    const cycle = { id: cycle1Id, startDate: start, endDate: null, isActive: true, variantModeSnapshot: 'MENOPAUSE' as const };

    const entries = [
      buildEntry(cycle1Id, start, { cycle, mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR' }), // Tc1
      buildEntry(cycle1Id, addDays(start, 1), { cycle }),
      buildEntry(cycle1Id, addDays(start, 2), { cycle }),
      buildEntry(cycle1Id, addDays(start, 3), { cycle }), // Tc1 confirmed
      ...Array.from({ length: 6 }, (_, i) => buildEntry(cycle1Id, addDays(start, 4 + i), { cycle })),
      buildEntry(cycle1Id, addDays(start, 10), { cycle, mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR' }), // Tc2
      buildEntry(cycle1Id, addDays(start, 11), { cycle }),
      buildEntry(cycle1Id, addDays(start, 12), { cycle }),
      buildEntry(cycle1Id, addDays(start, 13), { cycle }), // Tc2 confirmed
    ];
    for (const entry of entries) {
      await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [entry] });
    }

    // Tc1+4 = day4 -> day14 is 10 days later (within window); Tc2+4 = day14 -> 0 days (outside window).
    const cycle2Id = randomUUID();
    await request(app)
      .post('/entries')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ entries: [closingFlowEntry(cycle2Id, addDays(start, 14))] });

    const closedCycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycle1Id } });
    expect(closedCycle.peakResolution).toBe('CONFIRMED');
    expect(closedCycle.confirmedPeakDay?.toISOString().slice(0, 10)).toBe(start);
  });

  it('criterion e: REGULAR cycle-closing regression — peak_resolution reflects the normal intra-cycle confirmation, no behavior change', async () => {
    const start = '2026-06-01';
    const cycleId = randomUUID();
    const entries = [
      buildEntry(cycleId, start, { bleedingType: 'H' }),
      buildEntry(cycleId, addDays(start, 1)),
      buildEntry(cycleId, addDays(start, 2), { mucusSensation: 'WET' }),
      buildEntry(cycleId, addDays(start, 3), { mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR' }), // Tc
      buildEntry(cycleId, addDays(start, 4)),
      buildEntry(cycleId, addDays(start, 5)),
      buildEntry(cycleId, addDays(start, 6)), // confirms Tc
    ];
    for (const entry of entries) {
      await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [entry] });
    }

    const nextCycleId = randomUUID();
    await request(app)
      .post('/entries')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ entries: [buildEntry(nextCycleId, addDays(start, 29), { cycle: { id: nextCycleId, startDate: addDays(start, 29), endDate: null, isActive: true, variantModeSnapshot: 'REGULAR' }, bleedingType: 'H' })] });

    const closedCycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } });
    expect(closedCycle.peakResolution).toBe('CONFIRMED');
    expect(closedCycle.confirmedPeakDay?.toISOString().slice(0, 10)).toBe(addDays(start, 3));
  });

  it('criterion f: voiding the confirmed candidate reprocesses the closed cycle back to UNCONFIRMED_CLOSED, reverting the cascade via superseded_by', async () => {
    const start = '2026-07-01';
    const cycle1Id = randomUUID();

    for (const entry of buildMenopauseCycleEntries(cycle1Id, start)) {
      await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [entry] });
    }
    const cycle2Id = randomUUID();
    await request(app)
      .post('/entries')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ entries: [closingFlowEntry(cycle2Id, addDays(start, 4 + 10))] });

    const beforeVoid = await prisma.cycle.findUniqueOrThrow({ where: { id: cycle1Id } });
    expect(beforeVoid.peakResolution).toBe('CONFIRMED');
    const day1BeforeVoid = (await currentStateByDate(cycle1Id)).get(addDays(start, 1));
    expect(day1BeforeVoid).toMatchObject({ peakRelation: 'P1', computedState: 'FERTILE' });
    const day1StateId = day1BeforeVoid!.id;

    // Voiding the cycle's only observation for the candidate day removes it
    // entirely (Adendo 01) — the candidate vanishes, so reprocessing must
    // find no confirmed Tc anymore.
    const peakObservation = await prisma.observation.findFirstOrThrow({
      where: { cycleId: cycle1Id, date: new Date(`${start}T00:00:00Z`) },
    });
    const voidRes = await request(app).post(`/observations/${peakObservation.id}/void`).set(asUser(TEST_CLERK_USER_ID));
    expect(voidRes.status).toBe(204);

    const afterVoid = await prisma.cycle.findUniqueOrThrow({ where: { id: cycle1Id } });
    expect(afterVoid.peakResolution).toBe('UNCONFIRMED_CLOSED');
    expect(afterVoid.peakCandidateDate).toBeNull();

    const day1AfterVoid = (await currentStateByDate(cycle1Id)).get(addDays(start, 1));
    expect(day1AfterVoid).toMatchObject({ peakRelation: 'NOT_APPLICABLE', computedState: 'INFERTILE_ALTERNATING' });

    // The old CONFIRMED-cascade version must be superseded, never deleted/overwritten.
    const oldState = await prisma.dailyFertilityState.findUniqueOrThrow({ where: { id: day1StateId } });
    expect(oldState.supersededById).not.toBeNull();
  });
});
