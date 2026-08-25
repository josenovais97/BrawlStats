import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/**
 * Player and club pages are blocked, along with the API routes.
 *
 * This is the reversal the previous version of this comment anticipated: "if
 * crawl volume ever becomes a problem, the fix is to put `/player/` and
 * `/club/` back in `disallow`". On 2026-08-25 it became the problem — the free
 * tier's origin transfer and the database's monthly egress allowance both hit
 * 100% inside a fortnight — and these two routes are the last that render
 * fully per request, each costing an upstream API call plus uncached per-tag
 * reads. They are also `noindex`, so a crawler spending that was buying
 * nothing back.
 *
 * The tradeoff, which is real and is the reason this is not free: `noindex`
 * only works if the crawler is allowed to *fetch* the page and read the
 * directive. Blocked here, that directive becomes unenforceable, so a profile
 * still linked from the leaderboard or a club roster can be indexed as a bare
 * URL with no description. That is a worse outcome per page than `noindex` —
 * but it applies only to whatever is linked rather than to every tag in
 * existence, and a URL-only entry for a player profile costs nothing anyone
 * searches for.
 *
 * What is given up otherwise is small: `follow` used to pass link equity from
 * these pages to brawler and map pages, which are already linked from the
 * indexes that exist to link them.
 *
 * The pages stay shareable either way — a blocked path only stops discovery
 * crawls, never a direct visit.
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
