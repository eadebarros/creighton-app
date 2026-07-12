import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/express', async () => {
  const mock = await import('./mockClerk.js');
  return { getAuth: mock.getAuth, clerkMiddleware: mock.clerkMiddleware, clerkClient: mock.clerkClient };
});

import request from 'supertest';
import { createApp } from '../src/app.js';
import { asUser, buildEntry } from './factories.js';
import { resetDb } from './setup.js';
import { TEST_CLERK_USER_ID } from './mockClerk.js';

const app = createApp();
const PARTNER_ID = 'user_partner_test';

beforeEach(async () => {
  await resetDb();
});

async function linkPartner(): Promise<void> {
  const invite = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
  await request(app).post('/partner-invites/redeem').set(asUser(PARTNER_ID)).send({ code: invite.body.code });
}

describe('GET /me/export-data', () => {
  it('rejects a COOP_PARTNER with 403', async () => {
    await linkPartner();
    const res = await request(app).get('/me/export-data').set(asUser(PARTNER_ID));
    expect(res.status).toBe(403);
  });

  it('returns an empty-but-valid export for an account with no cycles yet', async () => {
    const res = await request(app).get('/me/export-data').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cycles: [], observations: [], dailyEntries: [], dailyFertilityStates: [] });
  });

  it('includes the full dailyFertilityState version history (not just current) when a second same-day observation reconsolidates the day', async () => {
    const cycleId = randomUUID();
    const dailyEntryId = randomUUID();
    const morning = buildEntry(cycleId, '2026-02-01', { dailyEntryId, mucusSensation: 'DRY' });
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [morning] });
    const evening = buildEntry(cycleId, '2026-02-01', {
      dailyEntryId,
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
    });
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [evening] });

    const res = await request(app).get('/me/export-data').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(200);
    expect(res.body.observations).toHaveLength(2);
    expect(res.body.observations.every((o: { voided: boolean }) => !o.voided)).toBe(true);
    // Reconsolidation re-versions the fertility state — export must carry the
    // whole chain (old superseded row + the new current one), not just current.
    expect(res.body.dailyFertilityStates.length).toBeGreaterThanOrEqual(2);
    const supersededCount = res.body.dailyFertilityStates.filter((s: { supersededById: string | null }) => s.supersededById !== null).length;
    expect(supersededCount).toBeGreaterThanOrEqual(1);
  });

  it('includes a voided observation in the export, still attributed to its (still-existing) day', async () => {
    const cycleId = randomUUID();
    const dailyEntryId = randomUUID();
    const morning = buildEntry(cycleId, '2026-02-05', { dailyEntryId, mucusSensation: 'DRY' });
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [morning] });
    const evening = buildEntry(cycleId, '2026-02-05', { dailyEntryId, mucusSensation: 'WET' });
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [evening] });

    // Void the first (morning) observation — the day still has the evening one, so the entry survives.
    await request(app).post(`/observations/${morning.id}/void`).set(asUser(TEST_CLERK_USER_ID));

    const res = await request(app).get('/me/export-data').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(200);
    expect(res.body.observations).toHaveLength(2);
    const voided = res.body.observations.find((o: { id: string }) => o.id === morning.id);
    expect(voided).toMatchObject({ voided: true });
    expect(voided.voidedAt).not.toBeNull();
  });
});
