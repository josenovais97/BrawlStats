import { NextResponse, type NextRequest } from 'next/server';

import { runAggregation } from '@/lib/aggregation';
import { hasDatabase } from '@/lib/prisma';

/**
 * POST/GET /api/cron/refresh-stats
 *
 * Triggered daily by Vercel Cron (see vercel.json). Vercel attaches
 * `Authorization: Bearer <CRON_SECRET>` only when a CRON_SECRET environment
 * variable exists on the project. It is not provisioned automatically: if it
 * is missing in Production, the nightly request arrives with no header and
 * every run dies at the 401 below without ever reaching runAggregation.
 *
 * Not cached, and always dynamic: a cached cron endpoint would silently stop
 * doing work.
 */
export const dynamic = 'force-dynamic';

/**
 * Sampling is I/O-bound across hundreds of upstream calls.
 *
 * 300s is both the default and the hard maximum on Hobby, so this is as far as
 * the plan goes. `RUN_BUDGET_MS` stops the work 30s earlier; the gap is what
 * guarantees the response is written instead of the invocation being killed
 * mid-flight, which Vercel would never retry.
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
