import type { NextRequest } from 'next/server';

import { playerIconUrl, rankedTierIconUrl } from '@/lib/brawlapi';
import { getBattleLog, getPlayer } from '@/lib/bs-api';
import { appNames, localRank } from '@/lib/bubble-app-l10n';
import { RANK_ELO_FLOORS, rankProgress, winsToNext } from '@/lib/ranked-elo';
import { okResponse } from '@/lib/route-helpers';
import { SITE_URL } from '@/lib/site';
import { getRankedEloRates } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';
import { lastBubble, rememberBubble } from '@/lib/bubble-last';
import { toApiError } from '@/lib/errors';

/**
 * One player's Ranked standing for the Bubble app (1.40): the "My rank"
 * widget, the rank-up notification and the Sunday recap.
 *
 * Rank, elo, progress to the next rank and "≈ N wins" (lib/ranked-elo), the
 * rank badge, and the Ranked games still in the battle log, so the app can
 * keep its own week of results. Deliberately NOT a profile lookup: it does
 * not call recordLookup, which would restart the elo-per-win pairing for this
 * player on every hourly call.
 */

export const dynamic = 'force-dynamic';

const RANKED = new Set(['soloRanked', 'teamRanked']);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tag = normalizeTag(params.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });

  let failure: unknown = null;
  const [player, log, rates, name] = await Promise.all([
    getPlayer(tag).catch((err) => {
      failure = err;
      return null;
    }),
    getBattleLog(tag)
      .then((r) => r.items)
      .catch(() => []),
    getRankedEloRates().catch(() => ({})),
    appNames(params.get('lang')),
  ]);
  if (!player) {
    // During an outage, the last good answer (see lib/bubble-last), so the
    // My rank widget keeps the rank instead of asking for a tag.
    const code = failure ? toApiError(failure).code : 'unknown';
    if (code !== 'notFound' && code !== 'invalidTag') {
      const last = await lastBubble<Record<string, unknown>>('me', tag);
      if (last) return Response.json({ ...last, stale: true }, { headers: { 'cache-control': 'no-store' } });
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const progress = rankProgress(player.rankedElo ?? null);
  const rankIndex = progress ? RANK_ELO_FLOORS.findIndex(([n]) => n === progress.rank.toUpperCase()) : -1;
  const me = `#${tag}`;

  const games = log
    .filter((e) => RANKED.has(e.battle.type ?? '') && (e.battle.result === 'victory' || e.battle.result === 'defeat'))
    .map((e) => {
      const mine = (e.battle.teams ?? []).flat().find((p) => normalizeTag(p.tag) === tag);
      return {
        t: e.battleTime,
        win: e.battle.result === 'victory',
        star: e.battle.starPlayer?.tag?.toUpperCase() === me,
        brawler: mine?.brawler?.name ? name(mine.brawler.name) : null,
      };
    });

  const icon = absolute(playerIconUrl(player.icon?.id));

  const body = {
      tag,
      name: player.name,
      iconUrl: icon,
      elo: player.rankedElo ?? null,
      rank: localRank(progress?.rank, name),
      rankIndex,
      rankIcon: rankIndex >= 0 ? absolute(rankedTierIconUrl(rankIndex + 1)) : null,
      next: localRank(progress?.next, name),
      toNext: progress?.toNext ?? null,
      share: progress?.share ?? null,
      winsToNext: winsToNext(progress, rates),
      recent: {
        games: games.length,
        wins: games.filter((g) => g.win).length,
        losses: games.filter((g) => !g.win).length,
        stars: games.filter((g) => g.star).length,
      },
      games,
  };
  rememberBubble('me', tag, body).catch(() => {
    /* A lost copy only matters during the next outage. */
  });
  return okResponse(body, 600);
}

function absolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
