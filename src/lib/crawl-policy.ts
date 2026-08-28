/**
 * One crawl policy, enforced in two places.
 *
 * `robots.txt` is a request. On 2026-08-25 that turned out to matter: the
 * draft helper moved its state into the path, every draft page links to every
 * next state, and the reachable set is roughly 27 maps x 1.2M enemy orderings
 * x 10k ally orderings. A crawler walked into it and took the Vercel project
 * past its Fluid CPU and origin-transfer allowances inside a day, which paused
 * the site for the rest of the billing cycle.
 *
 * `robots.txt` now blocks those paths, and that is the fix. This module is the
 * enforcement behind it, for the gap the fix does not cover: a crawler that
 * ignores `robots.txt`, and the day or so where a well-behaved one is still
 * working from a cached copy and a queue of URLs it already discovered. The
 * proxy answers 404 before the render, which turns a page view costing a
 * database round trip, an ISR write and ~200 KB of origin transfer into a
 * regex test.
 *
 * The two must not disagree, which is why both read the same two lists here
 * rather than keeping their own. A path blocked in `robots.txt` but served at
 * the edge is a cost the fix was supposed to remove; a path served in
 * `robots.txt` but blocked at the edge is a feature quietly broken for the
 * agents that were deliberately let in.
 */

/**
 * Paths no search crawler should fetch, as `robots.txt` prefixes.
 *
 * Two kinds, and they are blocked for different reasons.
 *
 * `/player/`, `/club/` and `/api/` are one URL per tag in existence: bounded
 * only by the game's player base, uncached, and each costing an upstream API
 * call. They are `noindex` anyway, so a crawler spending that was buying
 * nothing back.
 *
 * `/draft/` and `/compare/players/` are worse, because they are
 * *combinatorial* rather than merely large — a draft state spells a map, up to
 * three enemies and up to two allies into one path. `noindex` cannot help
 * either group: the crawler has to fetch the URL to read the directive, and
 * the fetch is the entire cost.
 *
 * Prefixes, so `/draft` and `/compare` themselves — the bare tools, which are
 * what the sitemap lists and what is worth indexing — stay crawlable.
 */
import { normalizeTag } from '@/lib/tags';

export const CRAWLER_DISALLOW = [
  '/api/',
  // Umami's dashboard and collection endpoint. A login screen and a POST API,
  // not a document set -- and crawling it would file analytics hits for the
  // crawler itself.
  '/analytics',
  '/player/',
  '/club/',
  '/draft/',
  '/compare/players/',
] as const;

/**
 * Unfurlers, which fetch one deliberately-shared URL rather than crawling.
 *
 * These are exempt from everything above except `/api/`. A profile carries
 * both a Share button and its own `opengraph-image`, so blocking them would
 * mean a profile pasted into a club chat unfurls as nothing — the site's whole
 * word-of-mouth loop, given away to save crawl budget it never spent. The
 * distinction is exactly right: an unfurler fetches one URL somebody chose to
 * share, a search crawler walks every URL it can find.
 */
/**
 * Agents refused outright, at the edge, for every path.
 *
 * `meta-externalagent` is Meta's AI-training crawler -- NOT
 * `facebookexternalhit`, which unfurls shared links and stays welcome.
 * Measured over 24h on 2026-08-28 it was **58% of all traffic**: 17,419
 * requests, ~600/hour round the clock, of which 15,193 were 404s on /player/.
 * It ignores this file, so listing it here documents the intent while
 * `Caddyfile` does the actual refusing -- one regex in Caddy instead of
 * booting Next 17,000 times a day to say no.
 *
 * Deliberately short. Every name here is a crawler measured to be a real cost
 * with no traffic to show for it; guessing at others trades away reach for
 * nothing.
 */
export const BLOCKED_AGENTS = ['meta-externalagent'] as const;

export const SOCIAL_AGENTS = [
  'Twitterbot',
  'facebookexternalhit',
  'Discordbot',
  'WhatsApp',
  'TelegramBot',
] as const;

const SOCIAL_PATTERN = new RegExp(SOCIAL_AGENTS.join('|'), 'i');

/** What the unfurlers above are still kept out of, and all they are kept out of. */
export const SOCIAL_DISALLOW = ['/api/'] as const;

/**
 * What a crawler calls itself.
 *
 * Substrings rather than a roster of names, because the roster is never
 * finished — `bot` alone catches Googlebot, bingbot, YandexBot, DuckDuckBot,
 * AhrefsBot, SemrushBot, MJ12bot, DotBot, PetalBot, Applebot, GPTBot and
 * Amazonbot without naming any of them, and `spider` catches Baiduspider and
 * Bytespider.
 *
 * Deliberately not here: `curl`, `wget` and the HTTP client libraries. They
 * are how the manual `/api/cron/refresh-stats` trigger is invoked, and
 * blocking a documented operation to catch a scraper that can rename itself
 * anyway is the wrong trade. A request with no user agent at all is likewise
 * let through — a real browser always sends one, so there is a gap here, but
 * it is a gap in the belt and not in the braces: `robots.txt` and the ISR
 * cache both still apply.
 */
const CRAWLER_PATTERN = /bot|crawler|crawling|spider|slurp/i;

/** True for a search crawler, false for browsers and for the unfurlers above. */
export function isSearchCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  // Social first: every name in that list would otherwise match `bot`.
  if (SOCIAL_PATTERN.test(userAgent)) return false;
  return CRAWLER_PATTERN.test(userAgent);
}

/**
 * The paths `robots.txt` tells this agent to stay out of, or null for anything
 * that is not an automated client.
 *
 * This is the function that makes the two enforcement points one policy: it
 * returns the same list `robots.txt` prints for the same agent, so "does the
 * proxy refuse this?" and "does robots.txt forbid this?" cannot answer
 * differently. Getting it wrong in the generous direction is what the first
 * version of this module did — it exempted the unfurlers from everything
 * rather than from everything except `/api/`, quietly serving them a path
 * `robots.txt` told them not to fetch.
 */
export function disallowFor(
  userAgent: string | null | undefined,
): readonly string[] | null {
  if (!userAgent) return null;
  if (SOCIAL_PATTERN.test(userAgent)) return SOCIAL_DISALLOW;
  if (CRAWLER_PATTERN.test(userAgent)) return CRAWLER_DISALLOW;
  return null;
}

/** True when `robots.txt` tells search crawlers to stay out of this path. */
/**
 * The tag in `/player/<tag>`, normalised, or null for any other shape.
 *
 * Normalised with the same function the route canonicalises with, so `#abc`,
 * `%23ABC` and `abc` all resolve to the one allowlist entry rather than three
 * near-misses that quietly fall back to being blocked.
 */
export function playerTagFromPath(pathname: string): string | null {
  const match = /^\/player\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return normalizeTag(decodeURIComponent(match[1]));
  } catch {
    // A malformed percent-escape is not a tag anyone can have.
    return null;
  }
}

/**
 * Whether a crawler is refused this path.
 *
 * `allowIndexablePlayers` is the baked allowlist (see
 * scripts/gen-indexable-players.ts). It carves a bounded hole in the
 * `/player/` disallow: the ranked leaderboard's top 100, which the site
 * already links to. Omit it and the behaviour is exactly what it was before
 * the allowlist existed — which is what every caller that has no business
 * knowing about players should do.
 */
export function isCrawlerDisallowed(
  pathname: string,
  allowIndexablePlayers?: ReadonlySet<string>,
): boolean {
  if (allowIndexablePlayers?.size) {
    const tag = playerTagFromPath(pathname);
    if (tag && allowIndexablePlayers.has(tag)) return false;
  }
  return CRAWLER_DISALLOW.some((prefix) => pathname.startsWith(prefix));
}

/**
 * The single question the proxy asks: should this request be refused before
 * anything renders?
 */
export function shouldBlockCrawl(
  pathname: string,
  userAgent: string | null | undefined,
  allowIndexablePlayers?: ReadonlySet<string>,
): boolean {
  const disallow = disallowFor(userAgent);
  if (disallow === null) return false;
  // Only search crawlers get the player carve-out. Social unfurlers were never
  // blocked from /player/ in the first place -- SOCIAL_DISALLOW is /api/ only
  // -- so this must not widen anything for them.
  if (disallow === CRAWLER_DISALLOW && allowIndexablePlayers?.size) {
    const tag = playerTagFromPath(pathname);
    if (tag && allowIndexablePlayers.has(tag)) return false;
  }
  return disallow.some((prefix) => pathname.startsWith(prefix));
}
