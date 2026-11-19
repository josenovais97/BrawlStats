import type { NextRequest } from 'next/server';

import { brawlerIconUrl, rankedTierIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getPlayer } from '@/lib/bs-api';
import { appNames, localRank } from '@/lib/bubble-app-l10n';
import { isOptedOut } from '@/lib/opted-out';
import { RANK_ELO_FLOORS, rankProgress } from '@/lib/ranked-elo';
import { getSeasonPair, type SeasonWindow } from '@/lib/ranked-seasons';
import { okResponse } from '@/lib/route-helpers';
import { SITE_URL } from '@/lib/site';
import { getPlayerPeakElo, getPlayerSeasonStats } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';

/**
 * This season against the last one, for the Bubble app's "Season vs last
 * season" card (1.42).
 *
 * For each of the two seasons: games and wins and the best brawler (Ranked,
 * from player_battle_daily, so only for players the sampler follows), and the
 * peak rank (the highest daily elo read in player_trophy_points; for the
 * running season also the game's own "highest this season"). The app merges
 * in what it counted itself, the way the Wrapped card does, so a player the
 * sampler never saw still gets this season from the phone.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tag = normalizeTag(params.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });

  const [pair, player, name, art] = await Promise.all([
    getSeasonPair(),
    getPlayer(tag).catch(() => null),
    appNames(params.get('lang')),
    getBrawlerArtMap().catch(() => new Map()),
  ]);
  if (!pair.now) return Response.json({ error: 'no season' }, { status: 503 });
  const hidden = isOptedOut(tag);

  const side = async (season: SeasonWindow | null, gameHigh: number | null) => {
    if (!season) return null;
    const [stats, peakRead] = hidden
      ? [null, null]
      : await Promise.all([getPlayerSeasonStats(tag, season.from, season.to), getPlayerPeakElo(tag, season.from, season.to)]);
    const peakElo = Math.max(peakRead ?? -1, gameHigh ?? -1);
    const peak = peakElo >= 0 ? rankProgress(peakElo) : null;
    const peakIndex = peak ? RANK_ELO_FLOORS.findIndex(([n]) => n === peak.rank.toUpperCase()) : -1;
    const top = stats?.byBrawler[0];
    const brawler = top ? art.get(top.brawlerId) : undefined;
    return {
      number: season.number,
      from: season.from,
      to: season.to,
      games: stats?.games ?? 0,
      wins: stats?.wins ?? 0,
      best: top
        ? {
            id: top.brawlerId,
            name: name(brawler?.name ?? ''),
            icon: absolute(brawler?.imageUrl ?? brawlerIconUrl(top.brawlerId)),
            games: top.games,
            wins: top.wins,
          }
        : null,
      peakElo: peakElo >= 0 ? peakElo : null,
      peakIndex,
      peakRank: peakIndex >= 0 ? localRank(peak?.rank, name) : null,
      peakIcon: peakIndex >= 0 ? absolute(rankedTierIconUrl(peakIndex + 1)) : null,
    };
  };

  // The game's own "highest this season" (reset with the season) belongs to the running one.
  const high = Math.max(player?.highestSeasonRankedElo ?? -1, player?.rankedElo ?? -1);
  const [now, last] = await Promise.all([side(pair.now, high >= 0 ? high : null), side(pair.last, null)]);
  return okResponse({ tag, now, last }, 1800);
}

function absolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
