import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/**
 * Player, club and API routes are excluded from crawling.
 *
 * They are unbounded — one URL per Brawl Stars tag in existence — and each one
 * costs an upstream API call to render. Letting a crawler walk them would burn
 * the rate limit on pages nobody searched for. They stay fully shareable and
 * indexable when someone links to one directly; this only stops discovery
 * crawls from enumerating them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/player/', '/club/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
