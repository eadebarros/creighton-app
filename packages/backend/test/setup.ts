import { prisma } from '../src/db/prisma.js';

/**
 * Truncates every table between tests. There's no ephemeral-database-per-run
 * available (tests run against a dedicated `test` schema on the same
 * Railway Postgres instance as dev — see .env.test.example), so this is the
 * pragmatic substitute. `RESTART IDENTITY CASCADE` also resets any sequences
 * and follows FKs, so table order here doesn't matter.
 */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE daily_fertility_states, daily_entries, observations, cycles,
       partner_acknowledgments, partner_invites, users
     RESTART IDENTITY CASCADE`,
  );
}

export { prisma };
