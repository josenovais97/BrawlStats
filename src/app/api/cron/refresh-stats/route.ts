import { NextResponse, type NextRequest } from 'next/server';

import { runAggregation } from '@/lib/aggregation';
import { hasDatabase } from '@/lib/prisma';

/**
 * POST/GET /api/cron/refresh-stats
 *
 * A manual trigger. Nothing calls this on a schedule any more.
 *
 * Sampling runs in GitHub Actions now, and runs the work *in the runner*
 * rather than POSTing here — see .github/workflows/refresh-stats.yml and
 * scripts/refresh-stats.ts. The reason is cost: this route made a Vercel
 * Function do ~184s of sampling eight times a day, ~12.3 hours a month against
 * a 4-hour Fluid Active CPU allowance, for a batch job that needs no web
 * server at all. The `crons` entries in vercel.json are gone with it.
 *
 * Kept because a one-off run against production is occasionally what you want
 * — after a schema change, or to confirm a fix without waiting three hours:
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://brawlzone.net/api/cron/refresh-stats
 *
 * CRON_SECRET must exist as a Production environment variable; without it this
 * fails closed at the 401 below rather than becoming an open trigger that
 * burns the upstream rate limit for anyone who finds the URL.
 *
 * Not cached, and always dynamic: a cached trigger would silently stop doing
 * work.
 */
export const dynamic = 'force-dynamic';

/**
 * Sampling is I/O-bound across hundreds of upstream calls.
 *
 * 300s is both the default and the hard maximum on Hobby, so this is as far as
 * the plan goes. `RUN_BUDGET_MS` stops the work 30s earlier; the gap is what
 * guarantees the response is written instead of the invocation being killed
 * mid-flight, which Vercel would never retry.
 *
 * Only binds a manual run now. The scheduled path has no such ceiling, which
 * is a second reason the work moved off this route.
 */
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // Fail closed. Without a secret the route would be an open trigger that
  // burns the API rate limit for anyone who finds the URL.
  if (!secret) return false;

  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: { code: 'unauthorized', title: 'Unauthorized', detail: 'Invalid cron secret.' } },
      { status: 401 },
    );
  }

  if (!hasDatabase()) {
    return NextResponse.json(
      {
        error: {
          code: 'notConfigured',
          title: 'No database configured',
          detail: 'Set DATABASE_URL (Neon) and run migrations before scheduling this job.',
        },
      },
      { status: 503 },
    );
  }

  // Omitting ?batch= uses the module default. The upper bound is generous
  // because the run budget, not this number, is what actually stops sampling.
  const raw = req.nextUrl.searchParams.get('batch');
  const batchSize = raw === null ? undefined : Number(raw);

  try {
    const result = await runAggregation(
      batchSize !== undefined && Number.isFinite(batchSize)
        ? Math.min(Math.max(batchSize, 1), 500)
        : undefined,
    );
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'unknown',
          title: 'Aggregation failed',
          detail: err instanceof Error ? err.message : 'Unknown error',
        },
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export const GET = handle;
export const POST = handle;
