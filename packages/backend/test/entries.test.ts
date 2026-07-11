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

function findDailyEntry(cycleId: string, date: string) {
  return prisma.dailyEntry.findUnique({
    where: { cycleId_date: { cycleId, date: new Date(`${date}T00:00:00Z`) } },
  });
}

describe('POST /entries', () => {
  it('creates a new observation and consolidates it into the day\'s DailyEntry', async () => {
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-03-01', { bleedingType: 'H' });

    const res = await request(app).post('/entries').send({ entries: [entry] });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([{ id: entry.id, status: 'created' }]);

    const observation = await prisma.observation.findUnique({ where: { id: entry.id } });
    expect(observation).toMatchObject({ cycleId, bleedingType: 'H', rawCode: '0' });

    const consolidated = await findDailyEntry(cycleId, '2026-03-01');
    expect(consolidated).toMatchObject({ id: entry.dailyEntryId, bleedingType: 'H', rawCode: '0', peakObservationId: entry.id });
  });

  it('is idempotent on a repeated observation id — no duplicate row, no duplicate consolidation', async () => {
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-03-01', { bleedingType: 'H' });

    await request(app).post('/entries').send({ entries: [entry] });
    const second = await request(app).post('/entries').send({ entries: [entry] });

    expect(second.body.results).toEqual([{ id: entry.id, status: 'duplicate' }]);
    const count = await prisma.observation.count({ where: { cycleId } });
    expect(count).toBe(1);
  });

  it('a second observation for an already-recorded date is NOT a duplicate — both are kept, and the peak wins consolidation', async () => {
    const cycleId = randomUUID();
    const dailyEntryId = randomUUID();
    const morning = buildEntry(cycleId, '2026-03-01', { dailyEntryId, mucusSensation: 'DRY' }); // raw_code '0'
    const evening = buildEntry(cycleId, '2026-03-01', {
      dailyEntryId,
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
    }); // raw_code '10C', more fertile

    const first = await request(app).post('/entries').send({ entries: [morning] });
    const second = await request(app).post('/entries').send({ entries: [evening] });

    expect(first.body.results).toEqual([{ id: morning.id, status: 'created' }]);
    expect(second.body.results).toEqual([{ id: evening.id, status: 'created' }]);

    const observationCount = await prisma.observation.count({ where: { cycleId } });
    expect(observationCount).toBe(2);

    const consolidated = await findDailyEntry(cycleId, '2026-03-01');
    expect(consolidated).toMatchObject({ id: dailyEntryId, rawCode: '10C', peakObservationId: evening.id });
  });

  it('never trusts a client-sent raw code — always re-derives it server-side', async () => {
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-03-01', {
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
    });

    await request(app).post('/entries').send({ entries: [entry] });

    const observation = await prisma.observation.findUnique({ where: { id: entry.id } });
    expect(observation?.rawCode).toBe('10C');
  });

  it('a real menstrual flow (H/M) on an active cycle after a genuine gap opens a new cycle', async () => {
    const firstCycleId = randomUUID();
    const dry = buildEntry(firstCycleId, '2026-03-01', { bleedingType: 'NONE' });

    const secondCycleId = randomUUID();
    const flow = buildEntry(secondCycleId, '2026-03-29', { bleedingType: 'H' });

    await request(app).post('/entries').send({ entries: [dry] });
    await request(app).post('/entries').send({ entries: [flow] });

    const consolidated = await findDailyEntry(secondCycleId, '2026-03-29');
    expect(consolidated?.cycleId).toBe(secondCycleId);

    const firstCycle = await prisma.cycle.findUnique({ where: { id: firstCycleId } });
    expect(firstCycle).toMatchObject({ isActive: false });
  });

  it('consecutive H/M days (a real multi-day period) stay in the same cycle', async () => {
    const cycleId = randomUUID();
    const day1 = buildEntry(cycleId, '2026-03-01', { bleedingType: 'H' });
    const day2 = buildEntry(cycleId, '2026-03-02', { bleedingType: 'H' });
    const day3 = buildEntry(cycleId, '2026-03-03', { bleedingType: 'M' });

    await request(app).post('/entries').send({ entries: [day1, day2, day3] });

    const entries = await prisma.dailyEntry.findMany({ where: { cycleId } });
    expect(entries).toHaveLength(3);
    const cycles = await prisma.cycle.count();
    expect(cycles).toBe(1);
  });

  it('a second same-day observation does not itself re-trigger cycle-boundary resolution (no spurious extra cycle)', async () => {
    const cycleId = randomUUID();
    const dailyEntryId = randomUUID();
    const morning = buildEntry(cycleId, '2026-03-01', { dailyEntryId, bleedingType: 'NONE' });
    // A same-day second check reporting bleeding — must NOT be read as "a fresh flow starting", since it's the same calendar day already in the active cycle.
    const evening = buildEntry(cycleId, '2026-03-01', { dailyEntryId, bleedingType: 'H' });

    await request(app).post('/entries').send({ entries: [morning] });
    await request(app).post('/entries').send({ entries: [evening] });

    const cycles = await prisma.cycle.count();
    expect(cycles).toBe(1);
    const consolidated = await findDailyEntry(cycleId, '2026-03-01');
    expect(consolidated?.bleedingType).toBe('H'); // most intense of the day wins consolidation
  });
});
