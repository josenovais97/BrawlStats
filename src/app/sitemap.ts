import type { MetadataRoute } from 'next';

import { getOfficialBrawlers } from '@/lib/bs-api';
import { SITE_URL } from '@/lib/site';

/**
 * The site's fixed routes, plus one page per brawler.
 *
 * Player and club pages are deliberately absent: there is one per tag in the
 * game, they cannot be enumerated, and `robots.ts` asks crawlers not to walk
 * them anyway.
 *
 * `/tier-list` itself is left out because it redirects; the two lists it
 * redirects to are listed instead, which is what should be indexed.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: [string, MetadataRoute.Sitemap[number]['changeFrequency'], number][] = [
    ['', 'daily', 1],
    ['/tier-list/ranked', 'daily', 0.9],
    ['/tier-list/trophy', 'daily', 0.9],
    ['/ranked', 'daily', 0.8],
    ['/brawlers', 'weekly', 0.8],
    ['/events', 'hourly', 0.7],
    ['/leaderboard', 'daily', 0.7],
    ['/news', 'daily', 0.6],
    ['/release-notes', 'weekly', 0.5],
    ['/about', 'monthly', 0.3],
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map(
    ([path, changeFrequency, priority]) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    }),
  );

  // Bounded (~106) and stable, so worth listing individually. If the API is
  // unavailable the sitemap still serves the fixed routes rather than failing.
  const brawlers = await getOfficialBrawlers()
    .then((r) => r.items)
    .catch(() => []);

  for (const brawler of brawlers) {
    entries.push({
      url: `${SITE_URL}/brawlers/${brawler.id}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }

  return entries;
}
