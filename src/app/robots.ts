import type { MetadataRoute } from 'next';

import { INDEXABLE_PLAYER_TAGS } from '@/generated/indexable-players';
import { CRAWLER_DISALLOW, SOCIAL_AGENTS, SOCIAL_DISALLOW } from '@/lib/crawl-policy';
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
 *
 * Except that it very nearly did stop one. Social unfurlers obey robots.txt
 * too, and a profile carries both a Share button and its own `opengraph-image`
 * — so a single `Disallow: /player/` also blocked Discord, Twitter, WhatsApp
 * and Telegram from fetching the card, and a profile pasted into a club chat
 * would have unfurled as nothing. That is the site's most-used feature and its
 * whole word-of-mouth loop, given away to save crawl budget it never spent.
 *
 * Hence the named groups below. A crawler obeys the most specific group that
 * matches its own user agent and ignores `*` entirely, so naming these five
 * gives them the run of the site while search engines stay out of the
 * unbounded per-tag pages. The distinction is exactly right: an unfurler
 * fetches one URL somebody deliberately shared, a search crawler walks every
 * URL it can find.
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...SOCIAL_AGENTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        // The API is not a document set for anyone, unfurler or otherwise.
        disallow: [...SOCIAL_DISALLOW],
      })),
      {
        userAgent: '*',
        allow: '/',
        /*
         * Both lists live in `@/lib/crawl-policy`, which explains what is on
         * them and why. They are shared because `src/proxy.ts` enforces the
         * same policy at the edge for crawlers that ignore this file, and the
         * two cannot be allowed to drift: a path blocked here but served there
         * is the cost this file exists to remove, and a path served here but
         * blocked there is a feature quietly broken.
         */
        disallow: [...CRAWLER_DISALLOW],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
