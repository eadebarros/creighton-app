import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/express', async () => {
  const mock = await import('./mockClerk.js');
  return { getAuth: mock.getAuth, clerkMiddleware: mock.clerkMiddleware, clerkClient: mock.clerkClient };
});

import request from 'supertest';
import { createApp } from '../src/app.js';
import { asUser } from './factories.js';
import { resetDb } from './setup.js';
import { TEST_CLERK_EMAIL, TEST_CLERK_USER_ID } from './mockClerk.js';

const app = createApp();
const PARTNER_ID = 'user_partner_test';

beforeEach(async () => {
  await resetDb();
});

describe('GET /me', () => {
  it('reports PRIMARY_OBSERVER with no partner before any linking', async () => {
    const res = await request(app).get('/me').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ role: 'PRIMARY_OBSERVER', partner: null });
  });

  it('reflects the linked partner on both sides after redemption', async () => {
    const invite = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
    await request(app).post('/partner-invites/redeem').set(asUser(PARTNER_ID)).send({ code: invite.body.code });

    const inviterMe = await request(app).get('/me').set(asUser(TEST_CLERK_USER_ID));
    expect(inviterMe.body).toEqual({ role: 'PRIMARY_OBSERVER', partner: { email: `${PARTNER_ID}@example.com` } });

    const partnerMe = await request(app).get('/me').set(asUser(PARTNER_ID));
    expect(partnerMe.body).toEqual({ role: 'COOP_PARTNER', partner: { email: TEST_CLERK_EMAIL } });
  });
});
