/**
 * A ceiling on how fast the uncached routes can be asked for.
 *
 * Written 2026-09-08, during an outage. A scraper walking
 * `/draft/<mode>/<map>/<allies>/<enemies>` and `/player/<tag>` took the box to
 * 99% CPU for half an hour: 4,000 requests in four and a half minutes, of which
 * 3,992 never completed, so the site was down for everybody.
 *
 * `robots.txt` already forbids both prefixes and `proxy.ts` already enforces it
 * — for anything that admits to being a crawler. This one sent Chrome's user
 * agent from several hundred addresses, two requests each, which is a gap
 * `crawl-policy` names in its own comments: a request with a browser's user
 * agent is indistinguishable from a browser, and the roster of names was never
 * going to be the thing that stopped this.
 *
 * So the limit is on the resource rather than on the client. It is deliberately
 * **global**, not per-IP: the traffic came from hundreds of addresses at two
 * requests each, so a per-IP bucket would have let every one of them through
 * while the box fell over. What has to be protected is two shared cores, and
 * they do not care who is asking.
 *
 * That trade is real and worth stating: under a flood, some genuine visitors to
 * these routes get a 429. They currently get a timeout, which is worse, and the
 * rest of the site — everything served from ISR — stays fast either way.
 */

/**
 * Sustained requests a second across every uncached route.
 *
 * Four is roughly twenty times a plausible human rate on these pages: a person
 * reading a profile or stepping through a draft generates something like one
 * request every few seconds, and there are not forty of them at once. It is
 * also about a quarter of what saturated the box, which is the number that
 * actually matters.
 */
export const REFILL_PER_SECOND = 4;

/**
 * How much of a burst is allowed before the rate starts to bite.
 *
 * Ten seconds' worth. Loading a profile fires the page and its own follow-up
 * requests together, and a limit with no burst turns one visitor's normal
 * behaviour into a 429 on their second click.
 */
export const BURST = 40;

/**
 * The prefixes this covers: every route that renders per request.
 *
 * Kept as a list rather than derived from `CRAWLER_DISALLOW` even though they
 * are nearly the same set, because they answer different questions. That list
 * is about what should be *indexed*; this one is about what is expensive, and
 * the day those two stop agreeing this should follow the cost.
 */
export const LIMITED_PREFIXES = [
  '/player/',
  '/club/',
  '/draft/',
  '/compare/players/',
  '/wrapped/',
] as const;

export function isLimitedPath(pathname: string): boolean {
  return LIMITED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * A token bucket, as two numbers.
 *
 * No timers and no sweeping: tokens are computed from the elapsed time when
 * they are asked for, so an idle process costs nothing and there is no
 * background job to leak. Module state, so it is per server process — which is
 * the right scope, because a process is what runs out of CPU.
 */
export interface Bucket {
  tokens: number;
  updatedAt: number;
}

export function createBucket(now: number): Bucket {
  return { tokens: BURST, updatedAt: now };
}

/**
 * Spends a token if there is one.
 *
 * Returns whether the request may proceed, and mutates the bucket. Refill is
 * capped at `BURST` so a quiet hour does not bank an hour's worth of flood.
 */
export function take(bucket: Bucket, now: number): boolean {
  const elapsed = Math.max(0, now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(BURST, bucket.tokens + elapsed * REFILL_PER_SECOND);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/** Seconds to wait for one token, for `Retry-After`. Always at least 1. */
export function retryAfter(bucket: Bucket): number {
  const missing = Math.max(0, 1 - bucket.tokens);
  return Math.max(1, Math.ceil(missing / REFILL_PER_SECOND));
}
