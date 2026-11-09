import type { NextRequest } from 'next/server';

import { brawlerIconUrl, getGameModeMap, modeLabel } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { appNames } from '@/lib/bubble-app-l10n';
import { getFreeRewards } from '@/lib/free-rewards';
import { getSeasonState } from '@/lib/ranked-seasons';
import { okResponse } from '@/lib/route-helpers';
import { SITE_URL } from '@/lib/site';
import {
  getBrawlerStatsForWindow,
  getFilterableModes,
  getMetaIndex,
  getSkillEdge,
  scoreBrawlers,
} from '@/lib/stats';

/**
 * Everything the Bubble app's hourly check needs, in one request (1.40):
 * the newest free rewards (notifications, widgets), the Ranked season's dates
 * (season notifications, the widget's countdown), today's top Ranked pick
 * (medium widget) and the top five per Ranked mode over the panel's window
 * (the large widget, which a player can set to one mode).
 *
 * `?lang=` puts brawler and mode names in the app's language, so the widgets
 * read like the panel. One small cached response per language.
 */

export const revalidate = 600;

const WINDOW_DAYS = 7;
const TOP = 5;

const absolute = (url: string | null | undefined) =>
  !url ? null : url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

export async function GET(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get('lang');
  const filterable = await getFilterableModes(30, 150, 'ranked').catch(() => []);
  const modeKeys = filterable.map((m) => m.mode);

  const [rewards, season, today, art, name, edges, modeMeta, allRows, perMode] = await Promise.all([
    getFreeRewards().catch(() => ({ live: [], earlier: [] })),
    getSeasonState().catch(() => null),
    getMetaIndex('ranked', 1).catch(() => new Map()),
    getBrawlerArtMap().catch(() => new Map()),
    appNames(lang),
    getSkillEdge('ranked').catch(() => undefined),
    getGameModeMap().catch(() => new Map()),
    getBrawlerStatsForWindow(WINDOW_DAYS, undefined, 'ranked').catch(() => []),
    Promise.all(modeKeys.map((mode) => getBrawlerStatsForWindow(WINDOW_DAYS, mode, 'ranked').catch(() => []))),
  ]);

  const image = (id: number) => absolute(art.get(id)?.imageUrl ?? brawlerIconUrl(id));
  const top = (rows: Awaited<ReturnType<typeof getBrawlerStatsForWindow>>) =>
    scoreBrawlers(rows, 'ranked', edges)
      .filter((e) => e.tier !== null)
      .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
      .slice(0, TOP)
      .map((e) => ({
        brawlerId: e.brawlerId,
        name: name(e.brawlerName),
        tier: e.tier,
        winRate: e.winRate,
        imageUrl: image(e.brawlerId),
      }));

  const pick = [...today.values()].sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))[0];
  const current = season?.current ?? null;

  return okResponse(
    {
      rewards: rewards.live.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.name,
        url: r.url,
        image: absolute(r.image),
        postedAt: r.postedAt,
      })),
      season: current ? { number: current.number, startsOn: current.startsOn, endsOn: current.endsOn } : null,
      nextSeason: season?.nextStartsOn ? { startsOn: season.nextStartsOn } : null,
      topPick: pick
        ? {
            brawlerId: pick.brawlerId,
            name: name(pick.brawlerName),
            tier: pick.tier,
            winRate: pick.winRate,
            imageUrl: image(pick.brawlerId),
          }
        : null,
      meta: {
        windowDays: WINDOW_DAYS,
        all: top(allRows),
        modes: modeKeys
          .map((mode, i) => ({
            key: mode,
            label: name(modeLabel(modeMeta, mode)),
            icon: absolute(modeMeta.get(mode.toLowerCase())?.imageUrl ?? null),
            top: top(perMode[i]),
          }))
          .filter((m) => m.top.length > 0),
      },
    },
    600,
  );
}
