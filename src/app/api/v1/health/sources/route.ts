import { getUpcomingHealth } from '@/lib/announced';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getSeasonState } from '@/lib/ranked-seasons';
import { rotationMaps } from '@/lib/ranked-rotation';
import { getRankedRecentMaps } from '@/lib/stats';

/**
 * The outside data sources, as the health check sees them (2026-10-19).
 *
 * Each of these fails quietly by design -- a broken wiki table falls back to
 * a built-in list, a naming mismatch hides the upcoming brawlers -- so a page
 * keeps rendering and nothing looks wrong. On 2026-10-15 the season parser
 * broke that way and /ranked showed season 48 for a day. The health check
 * (deploy/bin/brawlzone-healthcheck, check 14) reads this and mails when a
 * source has fallen back.
 */
export const revalidate = 600;

export async function GET() {
  const [season, art, recent] = await Promise.all([
    getSeasonState().catch(() => null),
    getBrawlerArtMap().catch(() => new Map()),
    getRankedRecentMaps().catch(() => []),
  ]);
  const upcoming = await getUpcomingHealth([...art.values()].map((b) => b.name)).catch(() => null);
  const rotation = rotationMaps({ recent, pool: [] });
  return Response.json({
    season: {
      source: season?.source ?? 'error',
      current: season?.current?.number ?? null,
      trialBrawlers: season?.current?.trialBrawlers ?? [],
    },
    upcoming,
    rotation: { modes: rotation.size, maps: [...rotation.values()].reduce((n, l) => n + l.length, 0) },
  });
}
