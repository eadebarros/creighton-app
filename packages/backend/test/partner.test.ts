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

describe('GET /partner/status', () => {
  it('rejects a caller who is not a linked COOP_PARTNER', async () => {
    const res = await request(app).get('/partner/status').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(403);
  });

  it('reports no active cycle before the primary has logged anything', async () => {
    await linkPartner();
    const res = await request(app).get('/partner/status').set(asUser(PARTNER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ hasActiveCycle: false, colorToken: null, acknowledgedToday: false });
  });

  it('reports RED even on a day with fertile-type mucus, once bleeding is present', async () => {
    await linkPartner();
    const today = new Date().toISOString().slice(0, 10);
    const entry = buildEntry(randomUUID(), today, {
      bleedingType: 'L',
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
    });
    const entriesRes = await request(app)
      .post('/entries')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ entries: [entry] });
    expect(entriesRes.status).toBe(200);

    const res = await request(app).get('/partner/status').set(asUser(PARTNER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ hasActiveCycle: true, colorToken: 'RED', asOfDate: today, cycleDay: 1 });
  });
});

describe('POST /partner/acknowledge', () => {
  it('rejects a caller who is not a linked COOP_PARTNER', async () => {
    const res = await request(app).post('/partner/acknowledge').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(403);
  });

  it('is idempotent — calling twice the same day only leaves one record and status reflects it', async () => {
    await linkPartner();
    const first = await request(app).post('/partner/acknowledge').set(asUser(PARTNER_ID));
    const second = await request(app).post('/partner/acknowledge').set(asUser(PARTNER_ID));
    expect(first.status).toBe(204);
    expect(second.status).toBe(204);

    const status = await request(app).get('/partner/status').set(asUser(PARTNER_ID));
    expect(status.body.acknowledgedToday).toBe(true);
  });
});
