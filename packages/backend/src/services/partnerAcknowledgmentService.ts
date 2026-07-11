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

export interface AcknowledgmentSummary {
  date: string;
  acknowledgedAt: string;
}

/** The calling partner's own acknowledgment history for their linked primary, most recent first. */
export async function listAcknowledgments(
  partnerUserId: string,
  primaryUserId: string,
): Promise<AcknowledgmentSummary[]> {
  const rows = await prisma.partnerAcknowledgment.findMany({
    where: { partnerUserId, primaryUserId },
    orderBy: { date: 'desc' },
  });
  return rows.map((row) => ({
    date: toIsoDate(row.date),
    acknowledgedAt: row.acknowledgedAt.toISOString(),
  }));
}
