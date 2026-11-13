import type { NextRequest } from 'next/server';

import { getBattleLog } from '@/lib/bs-api';
import { rankedGames } from '@/lib/bubble-review';
import { okResponse } from '@/lib/route-helpers';
import { normalizeTag } from '@/lib/tags';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bubble/history?tag= -- the panel's match history (2026-11-13):
 * the Ranked games still in the battle log (up to 25), newest first, each
 * with both teams' brawlers, who was star player and whether it was won.
 * Light on purpose: the full review of a game is /api/bubble/review?game=,
 * fetched when one is tapped.
 */
export async function GET(request: NextRequest) {
  const tag = normalizeTag(request.nextUrl.searchParams.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });
  const log = await getBattleLog(tag)
    .then((r) => r.items)
    .catch(() => null);
  if (!log) return okResponse({ games: [], unavailable: true }, 30);

  const games = rankedGames(log).map((e) => {
    const teams = e.battle.teams ?? [];
    const own = teams.find((team) => team.some((p) => normalizeTag(p.tag) === tag)) ?? [];
    const other = teams.find((team) => team !== own) ?? [];
    const star = normalizeTag(e.battle.starPlayer?.tag ?? null);
    const side = (team: typeof own) =>
      team
        .map((p) => ({ id: p.brawler?.id ?? 0, you: normalizeTag(p.tag) === tag, star: normalizeTag(p.tag) === star }))
        .filter((p) => p.id > 0);
    return {
      battleTime: e.battleTime,
      mode: e.event?.mode ?? e.battle.mode ?? null,
      mapName: e.event?.map ?? null,
      result: e.battle.result === 'victory' ? 'victory' : 'defeat',
      duration: typeof e.battle.duration === 'number' ? e.battle.duration : null,
      mine: side(own),
      theirs: side(other),
    };
  });
  return okResponse({ games }, 60);
}
