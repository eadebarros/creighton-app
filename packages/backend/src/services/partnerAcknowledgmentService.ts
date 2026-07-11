import { prisma } from '../db/prisma.js';
import { toIsoDate } from '../domain/mapping.js';

/** Idempotent via upsert on the compound unique key — repeat taps are a no-op, not a second row. */
export async function recordAcknowledgment(partnerUserId: string, primaryUserId: string): Promise<void> {
  const date = new Date(`${toIsoDate(new Date())}T00:00:00Z`);
  await prisma.partnerAcknowledgment.upsert({
    where: { partnerUserId_primaryUserId_date: { partnerUserId, primaryUserId, date } },
    create: { partnerUserId, primaryUserId, date },
    update: {},
  });
}
