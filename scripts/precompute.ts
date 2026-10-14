/**
 * Computes the expensive reads off the request path and stores them in
 * `precomputed_reads` (see `precomputed` in lib/stats). Run after each sampler
 * run by brawlzone-precompute.timer; safe to run by hand.
 *
 *   node --import tsx --conditions=react-server scripts/precompute.ts
 *
 * An empty result is not stored: it means the computation failed or found
 * nothing, and the pages should keep computing live rather than read a blank.
 * No top-level await: tsx compiles this to CommonJS.
 */
import { getPrisma } from '@/lib/prisma';
import { precomputeJobs } from '@/lib/stats';

function empty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') {
    return Object.values(value).every((v) => Array.isArray(v) && v.length === 0);
  }
  return value === null || value === undefined;
}

async function main(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) throw new Error('no database');
  let failed = 0;
  for (const job of await precomputeJobs()) {
    const started = Date.now();
    try {
      const value = await job.run();
      if (!job.keepEmpty && empty(value)) {
        console.log(`skipped ${job.key}: empty result`);
        continue;
      }
      await prisma.precomputedRead.upsert({
        where: { key: job.key },
        create: { key: job.key, value: value as object },
        update: { value: value as object, computedAt: new Date() },
      });
      console.log(`stored ${job.key} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } catch (error) {
      failed += 1;
      console.error(`failed ${job.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed) process.exitCode = 1;
}

void main().finally(() => setTimeout(() => process.exit(), 100));
