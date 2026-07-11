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
  it('reports PRIMARY_OBSERVER with no partner before any linking, defaults unacknowledged/REGULAR', async () => {
    const res = await request(app).get('/me').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      role: 'PRIMARY_OBSERVER',
      partner: null,
      instructorCredentialAck: false,
      currentVariantMode: 'REGULAR',
    });
  });

  it('reflects the linked partner on both sides after redemption', async () => {
    const invite = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
    await request(app).post('/partner-invites/redeem').set(asUser(PARTNER_ID)).send({ code: invite.body.code });

    const inviterMe = await request(app).get('/me').set(asUser(TEST_CLERK_USER_ID));
    expect(inviterMe.body).toMatchObject({
      role: 'PRIMARY_OBSERVER',
      partner: { email: `${PARTNER_ID}@example.com` },
    });

    const partnerMe = await request(app).get('/me').set(asUser(PARTNER_ID));
    expect(partnerMe.body).toMatchObject({ role: 'COOP_PARTNER', partner: { email: TEST_CLERK_EMAIL } });
  });
});

describe('PATCH /me', () => {
  it('persists instructorCredentialAck and currentVariantMode', async () => {
    const res = await request(app)
      .patch('/me')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ instructorCredentialAck: true, currentVariantMode: 'LACTATION' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ instructorCredentialAck: true, currentVariantMode: 'LACTATION' });

    const after = await request(app).get('/me').set(asUser(TEST_CLERK_USER_ID));
    expect(after.body).toMatchObject({ instructorCredentialAck: true, currentVariantMode: 'LACTATION' });
  });

  it('allows a partial update, leaving the other field untouched', async () => {
    await request(app).patch('/me').set(asUser(TEST_CLERK_USER_ID)).send({ instructorCredentialAck: true });
    const res = await request(app).get('/me').set(asUser(TEST_CLERK_USER_ID));
    expect(res.body).toMatchObject({ instructorCredentialAck: true, currentVariantMode: 'REGULAR' });
  });

  it('rejects an invalid currentVariantMode', async () => {
    const res = await request(app)
      .patch('/me')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ currentVariantMode: 'NOT_REAL' });
    expect(res.status).toBe(400);
  });
});
