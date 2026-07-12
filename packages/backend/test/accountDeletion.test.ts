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
const PARTNER_ID = 'user_partner_test';

beforeEach(async () => {
  await resetDb();
});

async function linkPartner(): Promise<void> {
  const invite = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
  await request(app).post('/partner-invites/redeem').set(asUser(PARTNER_ID)).send({ code: invite.body.code });
}

describe('POST /me/delete-account', () => {
  it('removes the user row, cycles, entries, observations and fertility states', async () => {
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-03-01');
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [entry] });

    const res = await request(app).post('/me/delete-account').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(204);

    const user = await prisma.user.findUnique({ where: { clerkUserId: TEST_CLERK_USER_ID } });
    expect(user).toBeNull();
    const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
    expect(cycle).toBeNull();
    const remainingObservations = await prisma.observation.findMany({ where: { cycleId } });
    expect(remainingObservations).toHaveLength(0);
  });

  it('unlinks the partner without deleting the partner\'s own account, and reverts their role if they were COOP_PARTNER', async () => {
    await linkPartner();

    const res = await request(app).post('/me/delete-account').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(204);

    const deletedUser = await prisma.user.findUnique({ where: { clerkUserId: TEST_CLERK_USER_ID } });
    expect(deletedUser).toBeNull();

    const partner = await prisma.user.findUniqueOrThrow({ where: { clerkUserId: PARTNER_ID } });
    expect(partner.partnerId).toBeNull();
    expect(partner.role).toBe('PRIMARY_OBSERVER');
  });

  it('a COOP_PARTNER can also delete their own account, unlinking the PRIMARY_OBSERVER side without touching her data', async () => {
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-03-05');
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [entry] });
    await linkPartner();

    const res = await request(app).post('/me/delete-account').set(asUser(PARTNER_ID));
    expect(res.status).toBe(204);

    const deletedPartner = await prisma.user.findUnique({ where: { clerkUserId: PARTNER_ID } });
    expect(deletedPartner).toBeNull();

    const primary = await prisma.user.findUniqueOrThrow({ where: { clerkUserId: TEST_CLERK_USER_ID } });
    expect(primary.partnerId).toBeNull();
    const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
    expect(cycle).not.toBeNull();
  });
});
