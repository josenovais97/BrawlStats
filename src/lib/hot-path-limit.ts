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
 * caller can drink a prefix dry.
 *
 * **Splitting the budget is not a reason to raise it.** The same change that
 * added per-prefix buckets also doubled the rate to eight, which across five
 * prefixes is forty a second where there had been four — and on 2026-09-11 that
 * took the box down harder than the flood it was written for. Isolation decides
 * *who* gets refused; the sum decides whether the box survives. They are
 * separate questions and only one of them was asked.
 */

/**
 * What each expensive prefix is allowed, per second, and its burst.
 *
 * Per prefix and not shared, because a shared budget means whoever is loudest
 * decides what everyone else gets — a crawler on `/draft` was refusing people
 * opening a profile. But per-prefix budgets **add up**, and that is how this
 * broke the site on 2026-09-11: five prefixes at eight a second is forty
 * uncached renders a second, ten times the ceiling it replaced. The box has two
 * shared cores and `/draft` renders per request, so it saturated, stopped
 * answering, and the middleware that was supposed to protect it never got to
 * run — 2,994 of 3,000 requests returned nothing at all.
 *
 * So they are budgeted individually against what they cost and who actually
 * asks for them, and `TOTAL_CEILING` below is asserted in the tests so the sum
 * cannot quietly creep back up.
 */
export interface Allowance {
  perSecond: number;
  burst: number;
}

export const ALLOWANCES: Record<string, Allowance> = {
  /*
   * Cheap since the pairing matrix was cached — measured warm on 2026-09-11,
   * median 65ms against the 11.1s that took the box down the same morning. It
   * gets four a second because it is now *worth* four a second: a route that
   * was made ~200x cheaper should earn back the room it was costing, and this
   * is the one prefix people click through rather than read one page of.
   *
   * Still not the largest allowance, because it is the most exposed: the state
   * space is ~3x10^11 URLs (AGENTS.md trap 5) and the traffic walking it is
   * distributed across thousands of addresses, so a shared budget of any
   * affordable size can be drained by it. Real visitors will still occasionally
   * meet a 429 here during a flood. That is a real cost and the alternative was
   * measured: a site that answers nothing at all.
   */
  '/draft/': { perSecond: 4, burst: 30 },

  /*
   * The one people notice when it fails, and the cheapest in the way that
   * matters. It looks slow — median 1.07s — but that is almost entirely waiting
   * on the game API, not computing: an I/O-bound request occupies a socket
   * rather than a core, which is the same distinction AGENTS.md draws about the
   * sampler being invisible to a CPU metric. Real demand measured at 0.3/s.
   */
  '/player/': { perSecond: 4, burst: 30 },

  /* 0.82s, and roughly one request every five minutes. */
  '/club/': { perSecond: 2, burst: 15 },

  /* No measured demand; moderate cost. */
  '/compare/players/': { perSecond: 1, burst: 10 },

  /*
   * The most expensive single render left — 3.4s — and no measured demand at
   * all, which is the combination that deserves the tightest allowance.
   */
  '/wrapped/': { perSecond: 1, burst: 10 },
};

/**
 * The most this box will admit per second across every uncached route.
 *
 * A request count is a crude proxy for the thing that actually breaks, which is
 * CPU — trap 8 in AGENTS.md is the long version. It is kept anyway because it
 * is the one number a reviewer can check against a diff, and because the
 * failure it guards is arithmetic nobody does by eye: five prefixes at eight a
 * second is forty, and the change that made it forty read as a sensible
 * two-line edit.
 *
 * Unchanged at 12 while `/draft` went from 1/s to 4/s — the room came from
 * `/compare/players/` and `/wrapped/`, which have no measured demand, and not
 * from raising the bar to fit. Lower a rate rather than raising this.
 */
export const TOTAL_CEILING = 12;

/** Fallback for a limited prefix with no explicit allowance. */
export const REFILL_PER_SECOND = 2;
export const BURST = 15;

export function allowanceFor(prefix: string): Allowance {
  return ALLOWANCES[prefix] ?? { perSecond: REFILL_PER_SECOND, burst: BURST };
}

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
