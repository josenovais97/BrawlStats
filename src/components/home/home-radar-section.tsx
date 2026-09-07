import { HomeRadar } from '@/components/home/home-radar';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { getDailyDiscoveries } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

/**
 * Loads the day's findings for the landing page.
 *
 * Its own server component so it can sit inside a `Suspense` boundary: the
 * discoveries are six separate aggregate reads, and the search box above must
 * never wait on a database. Renders nothing at all when there is nothing
 * surprising to report — a Radar section saying "no findings today" is worse
 * than no Radar section, because it advertises an empty promise every time the
 * sampler has a quiet day.
 */
export async function HomeRadarSection() {
  const [discoveries, brawlerMeta] = await Promise.all([
    getDailyDiscoveries().catch(() => []),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
  ]);

  if (discoveries.length === 0) return null;

  return <HomeRadar discoveries={discoveries} brawlerMeta={brawlerMeta} />;
}
