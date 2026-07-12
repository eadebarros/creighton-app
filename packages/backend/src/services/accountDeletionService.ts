import { clerkClient } from '@clerk/express';
import { prisma } from '../db/prisma.js';

/**
 * LGPD — direito de exclusão (SPEC 03 §3.7). Hard delete, sem janela de
 * carência (decisão de Edu, 12/07): apaga o histórico clínico completo,
 * desvincula o parceiro (a conta dele permanece intacta, sem acesso a nada
 * dela), remove todo registro de convite/reconhecimento que referencie esta
 * conta (evita violação de FK ao apagar a linha User), e por fim exclui a
 * própria identidade no Clerk — sem isso, a pessoa "excluída" ainda
 * conseguiria logar numa conta vazia, o que não cumpre o direito de exclusão.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const clerkUserId = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

      const cycles = await tx.cycle.findMany({ where: { userId }, select: { id: true } });
      const cycleIds = cycles.map((c) => c.id);
      if (cycleIds.length > 0) {
        await tx.dailyFertilityState.deleteMany({ where: { dailyEntry: { cycleId: { in: cycleIds } } } });
        await tx.dailyEntry.deleteMany({ where: { cycleId: { in: cycleIds } } });
        await tx.observation.deleteMany({ where: { cycleId: { in: cycleIds } } });
        await tx.cycle.deleteMany({ where: { id: { in: cycleIds } } });
      }

      if (user.partnerId) {
        const partner = await tx.user.findUnique({ where: { id: user.partnerId } });
        if (partner) {
          await tx.user.update({
            where: { id: partner.id },
            data: { partnerId: null, ...(partner.role === 'COOP_PARTNER' ? { role: 'PRIMARY_OBSERVER' } : {}) },
          });
        }
      }

      await tx.partnerInvite.deleteMany({ where: { OR: [{ createdById: userId }, { usedById: userId }] } });
      await tx.partnerAcknowledgment.deleteMany({
        where: { OR: [{ partnerUserId: userId }, { primaryUserId: userId }] },
      });

      await tx.user.delete({ where: { id: userId } });
      return user.clerkUserId;
    },
    { timeout: 30_000 },
  );

  await clerkClient.users.deleteUser(clerkUserId);
}
