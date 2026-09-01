import type { NextRequest } from 'next/server';

import { errorResponse, okResponse } from '@/lib/route-helpers';
import { getMetaIndex, isTierFormat } from '@/lib/stats';

/**
 * GET /api/v1/tier-list?format=ranked|trophy&window=7
 *
 * The same scored roster the tier list renders, as JSON.
 *
 * Both parameters are validated against a closed set rather than passed
 * through. `format` decides which population the numbers describe — Ranked and
 * ladder are genuinely different metas and mixing them is the one mistake this
 * data invites — and `window` is clamped because it reaches a database query:
 * an unbounded value would let a caller ask for an arbitrarily long scan.
 */
export const revalidate = 7200;

const WINDOWS = [1, 3, 7, 14, 30];

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const rawFormat = params.get('format') ?? 'ranked';
    const format = isTierFormat(rawFormat) ? rawFormat : 'ranked';

    const rawWindow = Number(params.get('window') ?? 7);
    const windowDays = WINDOWS.includes(rawWindow) ? rawWindow : 7;

    const index = await getMetaIndex(format, windowDays);

    return okResponse(
      {
        format,
        windowDays,
        brawlers: [...index.values()]
          .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
          .map((entry) => ({
            brawlerId: entry.brawlerId,
            name: entry.brawlerName,
            tier: entry.tier,
            metaScore: entry.metaScore,
            winRate: entry.winRate,
            adjustedWinRate: entry.normalizedWinRate,
            usageRate: entry.usageRate,
            battles: entry.decidedSampleSize,
          })),
      },
      7200,
    );
  } catch (err) {
    return errorResponse(err);
  }
}
