import { NextResponse, type NextRequest } from 'next/server';

import { runAggregation } from '@/lib/aggregation';
import { hasDatabase } from '@/lib/prisma';

/**
 * POST/GET /api/cron/refresh-stats
 *
 * Triggered daily by Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>` using the secret it auto-provisions
 * for projects that declare cron jobs.
 *
 * Not cached, and always dynamic: a cached cron endpoint would silently stop
 * doing work.
 */
export const dynamic = 'force-dynamic';

/** Sampling is I/O-bound across dozens of upstream calls. */
export const maxDuration = 60;

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

  const batchSize = Number(req.nextUrl.searchParams.get('batch') ?? 25);

  try {
    const result = await runAggregation(
      Number.isFinite(batchSize) ? Math.min(Math.max(batchSize, 1), 100) : 25,
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
