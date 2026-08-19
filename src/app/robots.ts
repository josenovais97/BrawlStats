import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/**
 * Player and club pages are crawlable; the API routes are not.
 *
 * They were blocked until now for a real reason: there is one URL per Brawl
 * Stars tag in existence, they cannot be enumerated, and each one costs an
 * upstream API call to render, so an unbounded discovery crawl would burn the
 * rate limit on pages nobody searched for.
 *
 * What changed is that the sitemap now names a bounded set — the current
 * global top players and clubs — and a disallowed URL stays uncrawled however
 * prominently it is listed. Those profiles are the long tail people actually
 * search by name, so they are worth the crawl budget. Discovery beyond them is
 * limited by what is linked: the leaderboards and club member lists, not an
 * enumeration.
 *
 * If crawl volume ever becomes a problem, the fix is to put `/player/` and
 * `/club/` back in `disallow` — the pages stay shareable either way, since a
 * blocked path only stops discovery crawls, never a direct visit.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
