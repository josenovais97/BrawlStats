import { NextResponse, type NextRequest } from 'next/server';

import { getClubRankings, getPlayerRankings } from '@/lib/bs-api';
import { isSupportedRegion } from '@/lib/regions';
import { errorResponse, okResponse } from '@/lib/route-helpers';

/**
 * GET /api/rankings/players?region=global&limit=50
 * GET /api/rankings/clubs?region=us&limit=50
 *
 * Region is a two-letter country code or "global"; the API rejects anything
 * else, so we validate before spending a call.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  const { searchParams } = req.nextUrl;

  const region = (searchParams.get('region') ?? 'global').toLowerCase();
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 50), 1), 200);

  if (type !== 'players' && type !== 'clubs') {
    return NextResponse.json(
      {
        error: {
          code: 'invalidTag',
          title: 'Unknown leaderboard',
          detail: 'Leaderboard type must be "players" or "clubs".',
        },
      },
      { status: 400 },
    );
  }

  if (!isSupportedRegion(region)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalidTag',
          title: 'Unknown region',
          detail: 'Region must be "global" or a supported two-letter country code.',
        },
      },
      { status: 400 },
    );
  }

  try {
    const data =
      type === 'players'
        ? await getPlayerRankings(region, limit)
        : await getClubRankings(region, limit);

    return okResponse(data, 120);
  } catch (err) {
    return errorResponse(err);
  }
}
