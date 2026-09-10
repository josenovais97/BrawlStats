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
 *
 * **One bucket for everything was wrong, and it broke the site for readers.**
 * Measured on 2026-09-10, a crawler walking `/draft` was arriving at about
 * fifty requests a second and taking 2,747 of every 3,000 responses as 429s —
 * and because the allowance was shared, people trying to open a *profile* were
 * refused for traffic that had nothing to do with them. A shared budget means
 * whoever is loudest decides what everyone else gets.
 *
 * So there is now a bucket per prefix, and a small one per client inside that.
 * A flood on `/draft` can exhaust `/draft` and nothing else, and no single
 * caller can drink a prefix dry. The disk cost that made the original flood
 * dangerous is gone — those routes no longer write anything — so the shared
 * ceiling can also be twice what it was.
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
export const REFILL_PER_SECOND = 8;

/**
 * How much of a burst is allowed before the rate starts to bite.
 *
 * Ten seconds' worth. Loading a profile fires the page and its own follow-up
 * requests together, and a limit with no burst turns one visitor's normal
 * behaviour into a 429 on their second click.
 */
export const BURST = 80;

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
  return limitedPrefix(pathname) !== null;
}

/** Which prefix a path belongs to, or null when it is not limited. */
export function limitedPrefix(pathname: string): string | null {
  return LIMITED_PREFIXES.find((prefix) => pathname.startsWith(prefix)) ?? null;
}

/**
 * A token bucket, as two numbers.
 *
 * No timers and no sweeping: tokens are computed from elapsed time when they
 * are asked for, so an idle bucket costs nothing and there is no background job
 * to leak.
 */
export interface Bucket {
  tokens: number;
  updatedAt: number;
}

export function createBucket(now: number, capacity = BURST): Bucket {
  return { tokens: capacity, updatedAt: now };
}

/**
 * Spends a token if there is one. Mutates the bucket.
 *
 * Refill is capped at the capacity so a quiet hour does not bank an hour's
 * worth of flood.
 */
export function take(
  bucket: Bucket,
  now: number,
  refillPerSecond = REFILL_PER_SECOND,
  capacity = BURST,
): boolean {
  const elapsed = Math.max(0, now - bucket.updatedAt) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/** Seconds to wait for one token, for `Retry-After`. Always at least 1. */
export function retryAfter(bucket: Bucket, refillPerSecond = REFILL_PER_SECOND): number {
  const missing = Math.max(0, 1 - bucket.tokens);
  return Math.max(1, Math.ceil(missing / refillPerSecond));
}

/**
 * Per-client allowance, so one caller cannot spend a whole prefix's budget.
 *
 * Generous for a person and tight for a script: a reader opening profiles makes
 * a request every few seconds, and the burst covers a page and the handful of
 * follow-ups it fires at once.
 */
export const PER_CLIENT_PER_SECOND = 2;
export const PER_CLIENT_BURST = 20;

/**
 * How many clients are remembered. Beyond this the oldest are dropped.
 *
 * Bounded because this is a map that anything on the internet can add keys to,
 * and an unbounded one of those is a memory leak wearing a rate limiter's coat.
 * Dropping a client's bucket only refunds its burst, which is the safe way to
 * be wrong.
 */
export const MAX_CLIENTS = 5000;

export class ClientBuckets {
  private readonly buckets = new Map<string, Bucket>();

  take(key: string, now: number): boolean {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = createBucket(now, PER_CLIENT_BURST);
      this.buckets.set(key, bucket);
    } else {
      // Re-inserted so the map's iteration order is least-recently-used first.
      this.buckets.delete(key);
      this.buckets.set(key, bucket);
    }
    if (this.buckets.size > MAX_CLIENTS) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== undefined) this.buckets.delete(oldest);
    }
    return take(bucket, now, PER_CLIENT_PER_SECOND, PER_CLIENT_BURST);
  }

  get size(): number {
    return this.buckets.size;
  }
}
