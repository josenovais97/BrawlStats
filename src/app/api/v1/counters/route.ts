import type { NextRequest } from 'next/server';

import { bracketBySlug } from '@/lib/rank-brackets';
import { errorResponse, okResponse } from '@/lib/route-helpers';
import { getRankedCounterScores, type CounterScore } from '@/lib/stats';

/**
 * Who beats one brawler in Ranked, for the Bubble's draft tab: tap an enemy
 * pick, see its best counters.
 *
 *   GET /api/v1/counters?brawler=16000001&rank=mythic
 *
 * The same measurement and floors as the counters pages
 * (`/brawlers/<slug>/counters`): each matchup against what the two brawlers'
 * own rates predict, a counter has to win as well as beat expectation. At a
 * rank, when that rank has too few battles for three counters, the answer is
 * every rank's -- and says so -- rather than a thin list that looks complete.
 */

const WINDOW_DAYS = 21;
const MIN_GAMES = 150;
const MIN_GAMES_AT_RANK = 60;
const MIN_EDGE = 0.01;
const RETURN = 5;

function top(scores: Map<number, CounterScore>, self: number, minGames: number) {
  return [...scores.values()]
    .filter((s) => s.brawlerId !== self && s.decidedSampleSize >= minGames && s.edge >= MIN_EDGE && s.winRate >= 0.5)
    .sort((a, b) => b.edge - a.edge)
    .slice(0, RETURN)
    .map((s) => ({ brawlerId: s.brawlerId, winRate: s.winRate, edge: s.edge, games: s.decidedSampleSize }));
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const id = Number(params.get('brawler'));
    if (!Number.isInteger(id) || id <= 0) return okResponse({ brawlerId: null, counters: [], allRanks: true });
    const bracket = bracketBySlug(params.get('rank'))?.id;

    if (bracket) {
      const atRank = top(await getRankedCounterScores([id], WINDOW_DAYS, bracket).catch(() => new Map()), id, MIN_GAMES_AT_RANK);
      if (atRank.length >= 3) return okResponse({ brawlerId: id, counters: atRank, allRanks: false }, 600);
    }
    const all = top(await getRankedCounterScores([id], WINDOW_DAYS).catch(() => new Map()), id, MIN_GAMES);
    return okResponse({ brawlerId: id, counters: all, allRanks: true }, 600);
  } catch (error) {
    return errorResponse(error);
  }
}
