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

describe('POST /entries', () => {
  it('creates a new entry and its cycle', async () => {
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-03-01', { bleedingType: 'H' });

    const res = await request(app).post('/entries').send({ entries: [entry] });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([{ id: entry.id, status: 'created' }]);

    const stored = await prisma.dailyEntry.findUnique({ where: { id: entry.id } });
    expect(stored).toMatchObject({ cycleId, bleedingType: 'H', rawCode: '0' });
  });

  it('is idempotent on a repeated entry id', async () => {
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-03-01', { bleedingType: 'H' });

    await request(app).post('/entries').send({ entries: [entry] });
    const second = await request(app).post('/entries').send({ entries: [entry] });

    expect(second.body.results).toEqual([{ id: entry.id, status: 'duplicate' }]);
    const count = await prisma.dailyEntry.count({ where: { cycleId } });
    expect(count).toBe(1);
  });

  it('is idempotent on a repeated (cycle, date) pair even with a fresh entry id', async () => {
    const cycleId = randomUUID();
    const first = buildEntry(cycleId, '2026-03-01', { bleedingType: 'H' });
    const secondAttempt = buildEntry(cycleId, '2026-03-01', { bleedingType: 'H' }); // different id, same date

    await request(app).post('/entries').send({ entries: [first] });
    const res = await request(app).post('/entries').send({ entries: [secondAttempt] });

    expect(res.body.results).toEqual([{ id: secondAttempt.id, status: 'duplicate' }]);
    const count = await prisma.dailyEntry.count({ where: { cycleId } });
    expect(count).toBe(1);
  });

  it('never trusts a client-sent raw code — always re-derives it server-side', async () => {
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-03-01', {
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
    });

    await request(app).post('/entries').send({ entries: [entry] });

    const stored = await prisma.dailyEntry.findUnique({ where: { id: entry.id } });
    expect(stored?.rawCode).toBe('10C');
  });

  it('a real menstrual flow (H/M) on an active cycle after a genuine gap opens a new cycle', async () => {
    const firstCycleId = randomUUID();
    const dry = buildEntry(firstCycleId, '2026-03-01', { bleedingType: 'NONE' });

    const secondCycleId = randomUUID();
    const flow = buildEntry(secondCycleId, '2026-03-29', { bleedingType: 'H' });

    await request(app).post('/entries').send({ entries: [dry] });
    await request(app).post('/entries').send({ entries: [flow] });

    const stored = await prisma.dailyEntry.findUnique({ where: { id: flow.id } });
    expect(stored?.cycleId).toBe(secondCycleId);

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
});
