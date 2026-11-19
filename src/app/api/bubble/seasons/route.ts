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
import { getPlayerEloSeries, getPlayerPeakElo, getPlayerSeasonStats } from '@/lib/stats';
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
 * sampler never saw still gets this season from the phone: g w pk b for this
 * season, lg lw lpk lb for the last (games, wins, peak rank index, best
 * brawler in the app's language), whichever count is larger wins.
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

  const byLocalName = new Map([...art.entries()].map(([id, b]) => [name(b.name).toLowerCase(), id] as const));
  const int = (key: string) => {
    const n = Number(params.get(key));
    return params.get(key) !== null && Number.isFinite(n) ? Math.max(-1, Math.round(n)) : null;
  };

  const side = async (season: SeasonWindow | null, gameHigh: number | null, p: '' | 'l') => {
    if (!season) return null;
    const [stats, peakRead] = hidden
      ? [null, null]
      : await Promise.all([getPlayerSeasonStats(tag, season.from, season.to), getPlayerPeakElo(tag, season.from, season.to)]);
    const peakElo = Math.max(peakRead ?? -1, gameHigh ?? -1);
    const peak = peakElo >= 0 ? rankProgress(peakElo) : null;
    const readIndex = peak ? RANK_ELO_FLOORS.findIndex(([n]) => n === peak.rank.toUpperCase()) : -1;
    const appPeak = int(`${p}pk`) ?? -1;
    const peakIndex = Math.min(RANK_ELO_FLOORS.length - 1, Math.max(readIndex, appPeak));
    const appGames = int(`${p}g`) ?? 0;
    const useApp = appGames > (stats?.games ?? 0);
    const top = useApp ? undefined : stats?.byBrawler[0];
    const appBest = useApp ? (params.get(`${p}b`) ?? '').slice(0, 24) : '';
    const bestId = top?.brawlerId ?? (appBest ? byLocalName.get(appBest.toLowerCase()) : undefined);
    const brawler = bestId !== undefined ? art.get(bestId) : undefined;
    return {
      number: season.number,
      from: season.from,
      to: season.to,
      games: useApp ? appGames : (stats?.games ?? 0),
      wins: useApp ? Math.min(appGames, Math.max(0, int(`${p}w`) ?? 0)) : (stats?.wins ?? 0),
      best:
        top || appBest
          ? {
              id: bestId ?? null,
              name: top ? name(brawler?.name ?? '') : appBest,
              icon: bestId !== undefined ? absolute(brawler?.imageUrl ?? brawlerIconUrl(bestId)) : null,
            }
          : null,
      peakIndex,
      peakRank: peakIndex >= 0 ? localRank(rankProgress(RANK_ELO_FLOORS[peakIndex][1])?.rank, name) : null,
      peakIcon: peakIndex >= 0 ? absolute(rankedTierIconUrl(peakIndex + 1)) : null,
    };
  };

  // The game's own "highest this season" (reset with the season) belongs to the running one.
  const high = Math.max(player?.highestSeasonRankedElo ?? -1, player?.rankedElo ?? -1);
  const [now, last, series] = await Promise.all([
    side(pair.now, high >= 0 ? high : null, ''),
    side(pair.last, null, 'l'),
    hidden ? Promise.resolve([]) : getPlayerEloSeries(tag, pair.now.from, pair.now.to),
  ]);
  // The season graph (1.42): daily readings, the app adds its own hourly ones.
  return okResponse({ tag, now: now ? { ...now, series: series.map((r) => [r.day, r.elo]) } : null, last }, 900);
}

function absolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
