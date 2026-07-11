import { randomInt } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';

const INVITE_TTL_HOURS = 24;
// Crockford-ish alphabet, excludes 0/O/1/I to avoid ambiguity when read aloud/copied by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const existing = await prisma.partnerInvite.findUnique({ where: { code } });
    if (!existing) {
      return code;
    }
  }
  throw new Error('Could not generate a unique invite code after 5 attempts');
}

export interface InviteSummary {
  code: string;
  expiresAt: string;
}

/** Reuses a still-valid unused invite instead of minting a new one every time the invite screen is opened. */
export async function getOrCreateActiveInvite(createdById: string): Promise<InviteSummary> {
  const now = new Date();
  const existing = await prisma.partnerInvite.findFirst({
    where: { createdById, usedById: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    return { code: existing.code, expiresAt: existing.expiresAt.toISOString() };
  }

  const code = await generateUniqueCode();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000);
  const invite = await prisma.partnerInvite.create({ data: { code, createdById, expiresAt } });
  return { code: invite.code, expiresAt: invite.expiresAt.toISOString() };
}

export interface RedeemResult {
  partnerEmail: string;
}

/**
 * Links both User rows' partnerId symmetrically and flips only the
 * redeemer's role to COOP_PARTNER — the inviter's role is untouched (already
 * PRIMARY_OBSERVER by JIT-provisioning default, see middleware/requireUser.ts).
 */
export async function redeemInvite(code: string, redeemerId: string): Promise<RedeemResult> {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.partnerInvite.findUnique({ where: { code } });
    if (!invite) {
      throw new NotFoundError('Invalid invite code');
    }
    if (invite.usedById) {
      throw new ConflictError('Invite already used');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestError('Invite has expired');
    }
    if (invite.createdById === redeemerId) {
      throw new BadRequestError('Cannot redeem your own invite');
    }

    const [inviter, redeemer] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: invite.createdById } }),
      tx.user.findUniqueOrThrow({ where: { id: redeemerId } }),
    ]);
    if (inviter.partnerId) {
      throw new ConflictError('Inviter is already linked to a partner');
    }
    if (redeemer.partnerId) {
      throw new ConflictError('You are already linked to a partner');
    }

    await tx.user.update({ where: { id: inviter.id }, data: { partnerId: redeemer.id } });
    await tx.user.update({
      where: { id: redeemer.id },
      data: { partnerId: inviter.id, role: 'COOP_PARTNER' },
    });
    await tx.partnerInvite.update({
      where: { id: invite.id },
      data: { usedById: redeemer.id, usedAt: new Date() },
    });

    return { partnerEmail: inviter.email };
  });
}
