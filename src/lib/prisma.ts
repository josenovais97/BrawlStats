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
      /*
       * Prisma's default is 5 seconds for the whole transaction, and it applies
       * to the batch form `$transaction([...])` as well as the interactive one.
       * The only transactions here are the roll-up's delete-then-insert pairs
       * in `lib/aggregation`, each of which aggregates a day of raw battles —
       * real work whose duration is set by how much was sampled and by whatever
       * else the box is doing at :17. On 2026-09-16 and 2026-09-21 one took
       * 9.6s, the roll-up failed, the prune parked, and the sampler paged.
       *
       * The site itself opens no transactions, so this costs the pages nothing.
       * A minute is not a target; it is far enough above the measured worst
       * case that hitting it means something is actually wrong.
       */
      transactionOptions: { maxWait: 10_000, timeout: 60_000 },
    });
  }
  return globalForPrisma.prisma;
}
