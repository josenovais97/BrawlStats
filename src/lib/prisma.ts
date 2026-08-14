import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

/**
 * The site is fully usable without a database — only the tier list and the
 * aggregated numbers on brawler pages need one. So the client is created
 * lazily and `hasDatabase()` guards every call site, letting the app build and
 * deploy before Neon is provisioned.
 *
 * Prisma 7 requires a driver adapter; `PrismaPg` speaks plain Postgres, which
 * is what Neon's pooled connection string offers.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Returns null when DATABASE_URL is unset rather than throwing at import time. */
export function getPrisma(): PrismaClient | null {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return globalForPrisma.prisma;
}
