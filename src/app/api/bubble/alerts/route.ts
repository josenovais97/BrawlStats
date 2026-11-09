import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getFreeRewards } from '@/lib/free-rewards';
import { getSeasonState } from '@/lib/ranked-seasons';
import { okResponse } from '@/lib/route-helpers';
import { SITE_URL } from '@/lib/site';
import { getMetaIndex } from '@/lib/stats';

/**
 * Everything the Bubble app's hourly check needs, in one request (1.40,
 * 2026-11-09): the newest free rewards (notifications and the home-screen
 * widget), the Ranked season's dates (the "season started" and "ends in two
 * days" notifications) and today's top Ranked pick (the widget).
 *
 * One small cached response rather than three calls, because every install
 * asks once an hour whether or not anything changed.
 */

export const revalidate = 600;

const absolute = (url: string | null | undefined) =>
  !url ? null : url.startsWith('http') ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

export async function GET() {
  const [rewards, season, meta, art] = await Promise.all([
    getFreeRewards().catch(() => ({ live: [], earlier: [] })),
    getSeasonState().catch(() => null),
    getMetaIndex('ranked', 1).catch(() => new Map()),
    getBrawlerArtMap().catch(() => new Map()),
  ]);

  const top = [...meta.values()].sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))[0];
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
      season: current
        ? { number: current.number, startsOn: current.startsOn, endsOn: current.endsOn }
        : null,
      nextSeason: season?.nextStartsOn ? { startsOn: season.nextStartsOn } : null,
      topPick: top
        ? {
            brawlerId: top.brawlerId,
            name: top.brawlerName,
            tier: top.tier,
            winRate: top.winRate,
            imageUrl: absolute(art.get(top.brawlerId)?.imageUrl ?? brawlerIconUrl(top.brawlerId)),
          }
        : null,
    },
    600,
  );
}
