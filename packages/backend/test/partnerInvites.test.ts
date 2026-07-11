import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/express', async () => {
  const mock = await import('./mockClerk.js');
  return { getAuth: mock.getAuth, clerkMiddleware: mock.clerkMiddleware, clerkClient: mock.clerkClient };
});

import request from 'supertest';
import { createApp } from '../src/app.js';
import { asUser } from './factories.js';
import { prisma, resetDb } from './setup.js';
import { TEST_CLERK_EMAIL, TEST_CLERK_USER_ID } from './mockClerk.js';

const app = createApp();
const PARTNER_ID = 'user_partner_test';
const THIRD_PARTY_ID = 'user_third_party';

beforeEach(async () => {
  await resetDb();
});

async function jitProvision(userId: string) {
  await request(app).get('/me').set(asUser(userId));
}

describe('POST /partner-invites', () => {
  it('creates an invite and reuses it on a repeated call', async () => {
    const first = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
    expect(first.status).toBe(200);
    expect(first.body.code).toMatch(/^[A-Z0-9]{8}$/);

    const second = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
    expect(second.body.code).toBe(first.body.code);
  });
});

describe('POST /partner-invites/redeem', () => {
  it('links both users symmetrically and flips only the redeemer role', async () => {
    const invite = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
    const res = await request(app)
      .post('/partner-invites/redeem')
      .set(asUser(PARTNER_ID))
      .send({ code: invite.body.code });

    expect(res.status).toBe(200);
    expect(res.body.partnerEmail).toBe(TEST_CLERK_EMAIL);

    const inviter = await prisma.user.findUniqueOrThrow({ where: { clerkUserId: TEST_CLERK_USER_ID } });
    const redeemer = await prisma.user.findUniqueOrThrow({ where: { clerkUserId: PARTNER_ID } });
    expect(inviter.partnerId).toBe(redeemer.id);
    expect(redeemer.partnerId).toBe(inviter.id);
    expect(inviter.role).toBe('PRIMARY_OBSERVER');
    expect(redeemer.role).toBe('COOP_PARTNER');
  });

  it('rejects an unknown code', async () => {
    await jitProvision(PARTNER_ID);
    const res = await request(app)
      .post('/partner-invites/redeem')
      .set(asUser(PARTNER_ID))
      .send({ code: 'NOTREAL1' });
    expect(res.status).toBe(404);
  });

  it('rejects an already-used code', async () => {
    const invite = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
    await request(app).post('/partner-invites/redeem').set(asUser(PARTNER_ID)).send({ code: invite.body.code });

    const res = await request(app)
      .post('/partner-invites/redeem')
      .set(asUser(THIRD_PARTY_ID))
      .send({ code: invite.body.code });
    expect(res.status).toBe(409);
  });

  it('rejects an expired code', async () => {
    const invite = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
    await jitProvision(TEST_CLERK_USER_ID);
    await prisma.partnerInvite.update({
      where: { code: invite.body.code },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/partner-invites/redeem')
      .set(asUser(PARTNER_ID))
      .send({ code: invite.body.code });
    expect(res.status).toBe(400);
  });

  it('rejects redeeming your own invite', async () => {
    const invite = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
    const res = await request(app)
      .post('/partner-invites/redeem')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ code: invite.body.code });
    expect(res.status).toBe(400);
  });

  it('rejects when either side is already linked to someone else', async () => {
    const firstInvite = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
    await request(app)
      .post('/partner-invites/redeem')
      .set(asUser(PARTNER_ID))
      .send({ code: firstInvite.body.code });

    // A third party invites the already-linked TEST_CLERK_USER_ID's partner — should fail.
    const secondInvite = await request(app).post('/partner-invites').set(asUser(THIRD_PARTY_ID));
    const res = await request(app)
      .post('/partner-invites/redeem')
      .set(asUser(PARTNER_ID))
      .send({ code: secondInvite.body.code });
    expect(res.status).toBe(409);
  });
});
