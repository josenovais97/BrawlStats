import type { NextRequest } from 'next/server';

import { errorResponse, okResponse } from '@/lib/route-helpers';
import {
  RANKED_MAP_WINDOW_DAYS,
  getAllyScores,
  getCounterScores,
  getRankedMapPicks,
} from '@/lib/stats';

/**
 * GET /api/v1/draft-suggest?map=Belle%27s%20Rock&enemies=1,2&allies=3&bans=4,5
 *
 * What to pick, given a map and who has already been taken.
 *
 * The same three numbers the site's draft helper adds up — the brawler's
 * measured form on this map, its edge against the enemies named, and its edge
 * alongside the team-mates named — so the overlay and the website cannot give
 * different answers to the same draft.
 *
 * Fetched per selection rather than precomputed. A draft is combinatorial: one
 * map times the bans times two partial line-ups is not a set anything can ship
 * to a phone in advance. `getCounterScores` and `getAllyScores` each answer for
 * the *whole roster* in one grouped query, so the cost is two round trips no
 * matter how many candidates come back.
 *
 * Under `/api/`, which `robots.txt` already disallows — see `lib/crawl-policy`.
 */

/** Enough for a draft; the tail is brawlers nobody is choosing. */
const RETURN = 14;

/** Guards the query: a draft has three enemies and two team-mates, plus bans. */
const MAX_IDS = 12;

function ids(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_IDS);
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const mapName = params.get('map')?.trim();
    if (!mapName) return okResponse({ mapName: null, picks: [] });

    const enemies = ids(params.get('enemies'));
    const allies = ids(params.get('allies'));
    const taken = new Set([...ids(params.get('bans')), ...enemies, ...allies]);

    /*
     * The map first, because it is the floor everything else adjusts. `only`
     * narrows the roll-up to this one map rather than reading the whole pool
     * and filtering in memory.
     */
    const [maps, counters, synergies] = await Promise.all([
      getRankedMapPicks(60, RANKED_MAP_WINDOW_DAYS, { mapName }).catch(() => []),
      enemies.length > 0
        ? getCounterScores(enemies).catch(() => new Map())
        : Promise.resolve(new Map()),
      allies.length > 0
        ? getAllyScores(allies).catch(() => new Map())
        : Promise.resolve(new Map()),
    ]);

    const map = maps.find((m) => m.mapName === mapName) ?? maps[0];
    if (!map) return okResponse({ mapName, picks: [] });

    const picks = map.picks
      .filter((pick) => !taken.has(pick.brawlerId))
      .map((pick) => {
        const counter = counters.get(pick.brawlerId);
        const synergy = synergies.get(pick.brawlerId);
        return {
          brawlerId: pick.brawlerId,
          brawlerName: pick.brawlerName,
          mapScore: pick.score,
          battles: pick.decidedSampleSize,
          counterEdge: counter?.edge ?? null,
          allyEdge: synergy?.edge ?? null,
          /*
           * Simply added, and that is deliberate.
           *
           * Half a point of counter edge is worth about as much as half a point
           * of map score. Nothing subtler is defensible on samples this size,
           * and all three are measured the same way — against the brawler's own
           * overall rate — so they are already on one scale.
           */
          total: pick.score + (counter?.edge ?? 0) + (synergy?.edge ?? 0),
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, RETURN);

    return okResponse({ mapName: map.mapName, mode: map.mode, picks }, 300);
  } catch (error) {
    return errorResponse(error);
  }
}
