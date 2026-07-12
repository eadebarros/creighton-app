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

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

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

  it('reports YELLOW once the primary is under an active PIB (LACTATION)', async () => {
    await linkPartner();
    const cycleId = randomUUID();
    const start = '2026-06-01';
    const cycle = { id: cycleId, startDate: start, endDate: null, isActive: true, variantModeSnapshot: 'LACTATION' as const };
    const dry = (date: string) => buildEntry(cycleId, date, { cycle });
    const entries = [
      ...Array.from({ length: 15 }, (_, i) => dry(addDays(start, i))), // observation
      dry(addDays(start, 15)), // day 16
      dry(addDays(start, 16)), // day 17
      dry(addDays(start, 17)), // day 18 — established
      dry(addDays(start, 18)), // day 19 — first PIB_ACTIVE day
    ];

    const entriesRes = await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries });
    expect(entriesRes.status).toBe(200);

    const res = await request(app).get('/partner/status').set(asUser(PARTNER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ hasActiveCycle: true, colorToken: 'YELLOW' });
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

describe('GET /partner/acknowledgments', () => {
  it('rejects a caller who is not a linked COOP_PARTNER', async () => {
    const res = await request(app).get('/partner/acknowledgments').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(403);
  });

  it('is empty before any acknowledgment, then has one entry after acknowledging today', async () => {
    await linkPartner();
    const before = await request(app).get('/partner/acknowledgments').set(asUser(PARTNER_ID));
    expect(before.body.acknowledgments).toEqual([]);

    await request(app).post('/partner/acknowledge').set(asUser(PARTNER_ID));
    const after = await request(app).get('/partner/acknowledgments').set(asUser(PARTNER_ID));
    expect(after.body.acknowledgments).toHaveLength(1);
    expect(after.body.acknowledgments[0]).toMatchObject({ date: new Date().toISOString().slice(0, 10) });
  });
});

describe('POST /partner/unlink', () => {
  it('rejects a caller with no partner', async () => {
    const res = await request(app).post('/partner/unlink').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(400);
  });

  it('clears partnerId symmetrically and reverts the COOP_PARTNER role, initiated by the PRIMARY_OBSERVER', async () => {
    await linkPartner();

    const res = await request(app).post('/partner/unlink').set(asUser(TEST_CLERK_USER_ID));
    expect(res.status).toBe(204);

    const inviter = await prisma.user.findUniqueOrThrow({ where: { clerkUserId: TEST_CLERK_USER_ID } });
    const redeemer = await prisma.user.findUniqueOrThrow({ where: { clerkUserId: PARTNER_ID } });
    expect(inviter.partnerId).toBeNull();
    expect(inviter.role).toBe('PRIMARY_OBSERVER');
    expect(redeemer.partnerId).toBeNull();
    expect(redeemer.role).toBe('PRIMARY_OBSERVER');
  });

  it('also works initiated by the COOP_PARTNER side', async () => {
    await linkPartner();

    const res = await request(app).post('/partner/unlink').set(asUser(PARTNER_ID));
    expect(res.status).toBe(204);

    const redeemer = await prisma.user.findUniqueOrThrow({ where: { clerkUserId: PARTNER_ID } });
    expect(redeemer.partnerId).toBeNull();
    expect(redeemer.role).toBe('PRIMARY_OBSERVER');
  });
});

describe('GET /me — partner.linkedAt', () => {
  it('reflects the invite redemption timestamp once linked, and disappears after unlinking', async () => {
    await linkPartner();
    const linked = await request(app).get('/me').set(asUser(TEST_CLERK_USER_ID));
    expect(linked.body.partner.linkedAt).not.toBeNull();

    await request(app).post('/partner/unlink').set(asUser(TEST_CLERK_USER_ID));
    const unlinked = await request(app).get('/me').set(asUser(TEST_CLERK_USER_ID));
    expect(unlinked.body.partner).toBeNull();
  });
});
