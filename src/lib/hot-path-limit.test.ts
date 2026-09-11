import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

import {
  ALLOWANCES,
  BURST,
  ClientBuckets,
  LIMITED_PREFIXES,
  MAX_CLIENTS,
  SUSPECT_ALLOWANCE,
  PER_CLIENT_BURST,
  REFILL_PER_SECOND,
  TOTAL_CEILING,
  allowanceFor,
  browserShapedReferer,
  createBucket,
  isLimitedPath,
  limitedPrefix,
  retryAfter,
  take,
} from '@/lib/hot-path-limit';

/**
 * The arithmetic the outage mitigation rests on.
 *
 * These are pinned because the failure is silent in both directions: a bucket
 * that never refills throttles the site to nothing and every page still returns
 * a valid response, and one that refills too fast protects nothing while
 * looking exactly like one that works.
 */

test('only the routes that render per request are covered', () => {
  assert.ok(isLimitedPath('/player/2VLR2JJLJL'));
  assert.ok(isLimitedPath('/draft/gem-grab/undermine/13/x/65'));
  assert.ok(isLimitedPath('/wrapped/abc'));
  assert.ok(!isLimitedPath('/'), 'the home page is cached');
  assert.ok(!isLimitedPath('/tier-list/ranked'), 'tier lists are cached');
  assert.ok(!isLimitedPath('/draft'), 'the empty helper is one cached page');
});

test('a burst is allowed, and then it is not', () => {
  const bucket = createBucket(0);
  for (let i = 0; i < BURST; i += 1) {
    assert.ok(take(bucket, 0), `request ${i + 1} of the burst should pass`);
  }
  assert.equal(take(bucket, 0), false, 'one past the burst is refused');
});

test('tokens come back at the stated rate', () => {
  const bucket = createBucket(0);
  for (let i = 0; i < BURST; i += 1) take(bucket, 0);
  assert.equal(take(bucket, 0), false);

  // One second later, exactly REFILL_PER_SECOND requests get through.
  for (let i = 0; i < REFILL_PER_SECOND; i += 1) {
    assert.ok(take(bucket, 1000), `refilled request ${i + 1} should pass`);
  }
  assert.equal(take(bucket, 1000), false, 'and no more than that');
});

test('a quiet hour does not bank an hour of flood', () => {
  const bucket = createBucket(0);
  for (let i = 0; i < BURST; i += 1) take(bucket, 0);

  let passed = 0;
  while (take(bucket, 3_600_000)) passed += 1;
  assert.equal(passed, BURST, 'refill is capped at the burst, not the elapsed time');
});

test('sustained load settles at the refill rate, not above it', () => {
  const bucket = createBucket(0);
  let passed = 0;
  // Ten seconds of a scraper asking twenty times a second.
  for (let ms = 0; ms < 10_000; ms += 50) {
    if (take(bucket, ms)) passed += 1;
  }
  const expected = BURST + (10_000 / 1000) * REFILL_PER_SECOND;
  assert.ok(
    Math.abs(passed - expected) <= 1,
    `expected about ${expected} to pass, got ${passed}`,
  );
});

test('retry-after is a whole number of seconds and never zero', () => {
  const bucket = createBucket(0);
  for (let i = 0; i < BURST; i += 1) take(bucket, 0);
  const wait = retryAfter(bucket);
  assert.ok(Number.isInteger(wait) && wait >= 1, `got ${wait}`);
});

test('a flood on one prefix does not refuse another', () => {
  // The failure this exists for: a crawler walking /draft at fifty requests a
  // second took 2,747 of every 3,000 responses, and readers opening a profile
  // were refused for traffic that was nothing to do with them.
  const draft = createBucket(0);
  const player = createBucket(0);
  for (let i = 0; i < BURST * 3; i += 1) take(draft, 0);

  assert.equal(take(draft, 0), false, '/draft is exhausted, as intended');
  assert.ok(take(player, 0), '/player must be unaffected');
});

test('prefixes are told apart', () => {
  assert.equal(limitedPrefix('/player/2VLR2JJLJL'), '/player/');
  assert.equal(limitedPrefix('/draft/gem-grab/undermine/13'), '/draft/');
  assert.equal(limitedPrefix('/tier-list/ranked'), null);
});

test('one client cannot drink a prefix dry', () => {
  const clients = new ClientBuckets();
  let noisy = 0;
  while (clients.take('1.2.3.4', 0)) noisy += 1;
  assert.equal(noisy, PER_CLIENT_BURST, 'the loud client is capped at its burst');
  assert.ok(clients.take('5.6.7.8', 0), 'a quiet client is still served');
});

test('the client table cannot grow without bound', () => {
  const clients = new ClientBuckets();
  for (let i = 0; i < MAX_CLIENTS + 500; i += 1) clients.take(`ip-${i}`, 0);
  assert.ok(
    clients.size <= MAX_CLIENTS,
    `client table grew to ${clients.size}; a map the internet can add keys to must be bounded`,
  );
});

/**
 * The sum, which is the number that actually decides whether the box survives.
 *
 * Per-prefix buckets add up, and nothing about adding a prefix or nudging one
 * rate makes the total visible at the point of change. On 2026-09-11 five
 * prefixes at eight a second admitted forty uncached renders a second into two
 * shared cores; the app stopped completing requests, so the middleware holding
 * this limit never ran and 2,994 of 3,000 requests returned nothing at all.
 *
 * Isolation and the total are separate questions. The tests above cover the
 * first. These cover the second.
 */

test('the prefixes together stay inside what the box can render', () => {
  const total = LIMITED_PREFIXES.reduce((sum, prefix) => sum + allowanceFor(prefix).perSecond, 0);
  assert.ok(
    total <= TOTAL_CEILING,
    `the limited prefixes admit ${total} uncached renders a second, over the ${TOTAL_CEILING} ` +
      `this box can serve. Per-prefix budgets add up: at 40/s on 2026-09-11 the site stopped ` +
      `answering entirely. Lower a rate rather than raising the ceiling.`,
  );
});

test('a burst cannot outrun the ceiling for long either', () => {
  // Bursts are additive too, and every bucket starts full. Sustained refill is
  // what the ceiling governs, so the combined burst is allowed to exceed it —
  // but not so far that the opening seconds of a flood are themselves an
  // outage. Ten seconds' worth is the same shape as the per-bucket burst.
  const burst = LIMITED_PREFIXES.reduce((sum, prefix) => sum + allowanceFor(prefix).burst, 0);
  assert.ok(
    burst <= TOTAL_CEILING * 10,
    `the prefixes can open with ${burst} requests at once, which two cores cannot absorb`,
  );
});

test('every limited prefix is budgeted deliberately', () => {
  // The fallback exists so an unlisted prefix is limited rather than unlimited,
  // but a prefix reaching it means someone added a route and never said what it
  // costs — and the cheap default is the one that would go unnoticed.
  for (const prefix of LIMITED_PREFIXES) {
    assert.ok(
      prefix in ALLOWANCES,
      `${prefix} is rate-limited but has no entry in ALLOWANCES; say what it costs`,
    );
  }
});

test('no single prefix can crowd out the rest', () => {
  // Replaced an assertion that /draft must be tighter than /player, which was
  // true only while /draft was the expensive one. It is now ~200x cheaper, and
  // a test that pins a transient fact starts failing for the wrong reason —
  // here, because the route it was protecting against got fixed.
  //
  // What is durable is that these prefixes share a fixed budget: if any one of
  // them holds most of it, the split that stopped a crawler refusing readers
  // has been undone by arithmetic rather than by an edit anyone would notice.
  const share = TOTAL_CEILING / 3;
  for (const prefix of LIMITED_PREFIXES) {
    const { perSecond } = allowanceFor(prefix);
    assert.ok(
      perSecond <= share,
      `${prefix} holds ${perSecond}/s of a ${TOTAL_CEILING}/s budget; no prefix may exceed ${share}`,
    );
  }
});

test('a reader clicking through profiles is never refused', () => {
  // The allowance has to be usable by a person, or it is just an outage with
  // better manners. A profile page and its follow-up requests arrive together.
  const { perSecond, burst } = allowanceFor('/player/');
  const bucket = createBucket(0, burst);
  let served = 0;
  // Ten clicks, two seconds apart, each firing four requests at once.
  for (let click = 0; click < 10; click += 1) {
    const now = click * 2000;
    for (let i = 0; i < 4; i += 1) {
      if (take(bucket, now, perSecond, burst)) served += 1;
    }
  }
  assert.equal(served, 40, 'a person browsing profiles must never see a 429');
});

/**
 * Every page that opts out of caching has to be covered by a limit.
 *
 * This is the hole the numbers above cannot close. A rate only protects the
 * prefixes it names, and nothing about adding a route makes its absence from
 * that list visible — `next build` prints one line for `/draft/[[...state]]`
 * whether it addresses one page or 3x10^11 (AGENTS.md trap 5), and an uncached
 * route that nobody limited looks exactly like a cached one until a crawler
 * finds it.
 *
 * Checked against the source rather than at runtime, for the same reason
 * `cached-shape.test.ts` is: the runtime path needs a server and a database,
 * and the mistake is a missing line in a file, which is where to catch it.
 */
const APP_DIR = new URL('../app/', import.meta.url);

/** Every `page.tsx` under `src/app`, as a path relative to that directory. */
function pageFiles(dir: URL, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return pageFiles(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`);
    }
    return entry.name === 'page.tsx' ? [`${prefix}${entry.name}`] : [];
  });
}

/**
 * The URL a page file answers on, with its dynamic segments removed.
 *
 * `draft/[[...state]]/page.tsx` is `/draft/`. Route groups — `(marketing)` —
 * are organisational and contribute no segment, which is exactly why they are
 * easy to forget when reasoning about a path by eye.
 */
function routePrefix(file: string): string {
  const segments = file
    .split('/')
    .slice(0, -1)
    .filter((segment) => !segment.startsWith('[') && !segment.startsWith('('));
  return `/${segments.join('/')}${segments.length > 0 ? '/' : ''}`;
}

test('a page that renders per request is covered by a limit', () => {
  const uncovered = pageFiles(APP_DIR)
    .filter((file) =>
      /export const dynamic\s*=\s*'force-dynamic'/.test(
        readFileSync(new URL(file, APP_DIR), 'utf8'),
      ),
    )
    .map(routePrefix)
    .filter((prefix) => limitedPrefix(`${prefix}anything`) === null);

  assert.deepEqual(
    uncovered,
    [],
    `these render per request but no bucket covers them: ${uncovered.join(', ')}. ` +
      `Add the prefix to LIMITED_PREFIXES and give it an entry in ALLOWANCES, or ` +
      `let the route be cached. An uncached route with no ceiling is what took the ` +
      `site down on 2026-09-08 and again on 2026-09-11.`,
  );
});

test('a person stepping through a draft is never refused', () => {
  // The counterpart to the profile test, and the reason /draft did not stay at
  // the 1/s it was cut to during the outage: a limit that a single human user
  // trips is an outage with better manners. Picking a mode, a map and then five
  // brawlers is seven requests, and people do it faster than they read.
  const { perSecond, burst } = allowanceFor('/draft/');
  const bucket = createBucket(0, burst);
  let served = 0;
  for (let step = 0; step < 7; step += 1) {
    if (take(bucket, step * 1500, perSecond, burst)) served += 1;
  }
  assert.equal(served, 7, 'a full draft must complete without a 429');
});

/**
 * The Referer shape check, which is the only thing that tells a distributed
 * flood apart from a reader.
 *
 * Worth testing carefully in both directions. A false negative costs only the
 * advantage — that traffic rejoins the ordinary buckets. A false *positive*
 * puts a real visitor in a 1/s bucket with a crawler, so the cases that must
 * pass matter more than the ones that must fail.
 */

test('a browser Referer always carries a path', () => {
  // What real navigation looks like: the home page, a section, and a draft
  // state clicked through from the one before it.
  for (const referer of [
    'https://brawlzone.net/',
    'https://brawlzone.net/draft',
    'https://brawlzone.net/draft/gem-grab/hard-rock-mine/16000000',
    'https://www.brawlzone.net/',
    'https://www.google.com/',
    'https://brawlzone.net/?utm_source=x',
  ]) {
    assert.ok(browserShapedReferer(referer), `${referer} is a real browser Referer`);
  }
});

test('no Referer at all is a reader, not a crawler', () => {
  // A pasted link, a bookmark, a shared draft, a typed URL. Refusing these
  // would break the reason draft state lives in the path in the first place.
  assert.ok(browserShapedReferer(null));
  assert.ok(browserShapedReferer(''));
});

test('a pathless origin is not something a browser sends', () => {
  // 58,479 of 58,485 requests to /draft on 2026-09-11, all five and six
  // segments deep. `new URL()` would normalise this to "/" and report it as
  // identical to the line above, which is why the raw string is inspected.
  assert.ok(!browserShapedReferer('https://brawlzone.net'));
  assert.ok(!browserShapedReferer('http://brawlzone.net'));
  assert.ok(!browserShapedReferer('not a url'));
});

test('the flood cannot take the budget by looking like five audiences', () => {
  // One bucket for everything suspect, not one per prefix: five would be five
  // times the allowance for a single flood, which is the same arithmetic that
  // caused the outage.
  assert.ok(
    SUSPECT_ALLOWANCE.perSecond <= allowanceFor('/draft/').perSecond,
    'suspect traffic must never be given more room than the readers it mimics',
  );
});
