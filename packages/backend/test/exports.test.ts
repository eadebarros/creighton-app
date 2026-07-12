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
import { resolveExportData } from '../src/services/exportDataService.js';

const app = createApp();
const PARTNER_ID = 'user_partner_test';

beforeEach(async () => {
  await resetDb();
});

async function linkPartner(): Promise<void> {
  const invite = await request(app).post('/partner-invites').set(asUser(TEST_CLERK_USER_ID));
  await request(app).post('/partner-invites/redeem').set(asUser(PARTNER_ID)).send({ code: invite.body.code });
}

describe('POST /exports/pdf', () => {
  it('rejects a COOP_PARTNER with 403, regardless of privacy config', async () => {
    await linkPartner();
    const res = await request(app)
      .post('/exports/pdf')
      .set(asUser(PARTNER_ID))
      .send({ period: 'current', password: 'senha123' });
    expect(res.status).toBe(403);
  });

  it('rejects a password shorter than 6 characters', async () => {
    const res = await request(app)
      .post('/exports/pdf')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ period: 'current', password: '123' });
    expect(res.status).toBe(400);
  });

  it('returns 422 when the selected period has no data', async () => {
    const res = await request(app)
      .post('/exports/pdf')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ period: 'current', password: 'senha123' });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: 'insufficient_data' });
  });

  it('generates a password-protected PDF for a Regular cycle', async () => {
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-01-01', { bleedingType: 'H' });
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [entry] });

    const res = await request(app)
      .post('/exports/pdf')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ period: 'current', password: 'senha123' })
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect((res.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('generates a PDF for a Lactação cycle without throwing', async () => {
    const cycleId = randomUUID();
    const cycle = { id: cycleId, startDate: '2026-02-01', endDate: null, isActive: true, variantModeSnapshot: 'LACTATION' as const };
    const entry = buildEntry(cycleId, '2026-02-01', { cycle });
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [entry] });

    const res = await request(app)
      .post('/exports/pdf')
      .set(asUser(TEST_CLERK_USER_ID))
      .send({ period: 'current', password: 'senha123' })
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect((res.body as Buffer).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

describe('POST /observations/:id/void (sync gap fix)', () => {
  it('marks the observation voided and reconsolidates the day server-side', async () => {
    const cycleId = randomUUID();
    const dailyEntryId = randomUUID();
    const cycle = { id: cycleId, startDate: '2026-03-01', endDate: null, isActive: true, variantModeSnapshot: 'REGULAR' as const };
    const morning = buildEntry(cycleId, '2026-03-01', { cycle, dailyEntryId, mucusSensation: 'DRY' });
    const evening = buildEntry(cycleId, '2026-03-01', {
      cycle,
      dailyEntryId,
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
    });
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [morning] });
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [evening] });

    const peak = await prisma.observation.findFirstOrThrow({ where: { cycleId, rawCode: '10C' } });
    const voidRes = await request(app).post(`/observations/${peak.id}/void`).set(asUser(TEST_CLERK_USER_ID));
    expect(voidRes.status).toBe(204);

    const voided = await prisma.observation.findUniqueOrThrow({ where: { id: peak.id } });
    expect(voided.voided).toBe(true);

    const consolidated = await prisma.dailyEntry.findUniqueOrThrow({
      where: { cycleId_date: { cycleId, date: new Date('2026-03-01T00:00:00Z') } },
    });
    expect(consolidated).toMatchObject({ rawCode: '0' }); // falls back to the remaining (morning) observation

    const exportData = await resolveExportData((await prisma.user.findFirstOrThrow({})).id, {
      period: 'current',
      password: 'senha123',
    });
    expect(exportData.summary.voidedObservationCount).toBe(1);
  });

  it('rejects voiding an observation that belongs to a different user', async () => {
    const cycleId = randomUUID();
    const entry = buildEntry(cycleId, '2026-03-05', {});
    await request(app).post('/entries').set(asUser(TEST_CLERK_USER_ID)).send({ entries: [entry] });
    const obs = await prisma.observation.findFirstOrThrow({ where: { cycleId } });

    const res = await request(app).post(`/observations/${obs.id}/void`).set(asUser('user_someone_else'));
    expect(res.status).toBe(403);
  });
});
