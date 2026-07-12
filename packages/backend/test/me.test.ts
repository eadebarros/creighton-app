import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/express', async () => {
  const mock = await import('./mockClerk.js');
  return { getAuth: mock.getAuth, clerkMiddleware: mock.clerkMiddleware, clerkClient: mock.clerkClient };
});

import request from 'supertest';
import { createApp } from '../src/app.js';
import { asUser } from './factories.js';
import { prisma, resetDb } from './setup.js';
import {
  SAME_EMAIL_IDENTITY_A,
  SAME_EMAIL_IDENTITY_B,
  SAME_EMAIL_SHARED_EMAIL,
  TEST_CLERK_EMAIL,
  TEST_CLERK_USER_ID,
} from './mockClerk.js';

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
      instructorCredentialAckAt: null,
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

describe('JIT provisioning — same email, different Clerk identity', () => {
  it('re-points the existing row at a new clerkUserId instead of crashing on the email unique constraint', async () => {
    const first = await request(app).get('/me').set(asUser(SAME_EMAIL_IDENTITY_A));
    expect(first.status).toBe(200);

    // Same real person signs in again via a different Clerk identity (e.g.
    // password vs. Google) sharing the same email — Clerk doesn't merge
    // these automatically, so our own JIT-provisioning must.
    const second = await request(app).get('/me').set(asUser(SAME_EMAIL_IDENTITY_B));
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ role: 'PRIMARY_OBSERVER' });

    const users = await prisma.user.findMany({ where: { email: SAME_EMAIL_SHARED_EMAIL } });
    expect(users).toHaveLength(1);
    expect(users[0].clerkUserId).toBe(SAME_EMAIL_IDENTITY_B);
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
    expect(res.body.instructorCredentialAckAt).not.toBeNull();

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
