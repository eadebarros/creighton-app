import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/express', async () => {
  const mock = await import('./mockClerk.js');
  return { getAuth: mock.getAuth, clerkMiddleware: mock.clerkMiddleware, clerkClient: mock.clerkClient };
});

import request from 'supertest';
import { createApp } from '../src/app.js';
import { buildEntry } from './factories.js';
import { resetDb } from './setup.js';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

describe('GET /sync', () => {
  it('returns fertility states computed after `since`, and an empty diff on repeat with the previous serverTime', async () => {
    const epoch = new Date(0).toISOString();
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-05-01', { bleedingType: 'H' });
    await request(app).post('/entries').send({ entries: [entry] });

    const first = await request(app).get('/sync').query({ since: epoch });
    expect(first.status).toBe(200);
    expect(first.body.fertilityStates.length).toBeGreaterThan(0);
    expect(first.body.cycles).toHaveLength(1);

    const second = await request(app).get('/sync').query({ since: first.body.serverTime });
    expect(second.body.fertilityStates).toHaveLength(0);
  });

  it('only ever returns the current (non-superseded) version of each entry', async () => {
    const cycleId = randomUUID();
    const start = '2026-05-10';
    const entries = [
      buildEntry(cycleId, addDays(start, 0), { mucusSensation: 'WET', mucusStretch: 'ELASTIC', mucusColor: 'CLEAR' }),
      buildEntry(cycleId, addDays(start, 1)),
      buildEntry(cycleId, addDays(start, 2)),
      buildEntry(cycleId, addDays(start, 3)), // confirms the peak, forcing a supersede on day 0
    ];
    for (const entry of entries) {
      await request(app).post('/entries').send({ entries: [entry] });
    }

    const res = await request(app).get('/sync').query({ since: new Date(0).toISOString() });
    const entryIds: string[] = res.body.fertilityStates.map((s: { entryId: string }) => s.entryId);
    expect(new Set(entryIds).size).toBe(entryIds.length);
  });
});
