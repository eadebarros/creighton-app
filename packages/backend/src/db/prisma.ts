import { PrismaClient } from '@prisma/client';

/** Singleton client — one connection pool per process. */
export const prisma = new PrismaClient();
