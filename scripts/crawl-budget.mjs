/**
 * What a crawler can actually reach, measured rather than reasoned about.
 *
 * On 2026-08-25 the draft helper moved its state into the path, every draft
 * page linked to every next state, and the reachable set went from ~1,000 URLs
 * to roughly 3x10^11. Nothing in the type system, the tests or the build output
 * said so — `next build` prints one line for `/draft/[[...state]]` whether that
 * route addresses one page or a hundred billion. The site was paused inside a
 * day.
 *
 * So this walks the site the way a crawler does: breadth-first from `/`,
 * following same-origin `<a href>` only, obeying the `*` group in `robots.txt`
 * and `rel="nofollow"`. If it terminates, the crawlable surface is bounded and
 * the number it prints is the bound. If it hits the cap, something is
 * unbounded and the section breakdown says which route.
 *
 * That is the whole point: a bound you can re-measure after every change beats
 * a bound you argued for once.
 *
 *   npm run crawl:budget                      # against a local `next start`
 *   npm run crawl:budget -- https://…         # against production
 *
 * Read-only, so it is safe against production — but it is still ~1,000 page
 * views against the origin, which on a metered plan is not free. Prefer local.
 */

const BASE = (process.argv[2] ?? 'http://localhost:3111').replace(/\/$/, '');

/** Well past the ~1,000 URLs the sitemap lists, and far short of a real trap. */
const CAP = 5_000;

/**
 * Overridable, because production now rate-limits this tool.
 *
 * A Cloudflare rule added 2026-09-28 blocks an IP at 100 requests per 10
 * seconds. Eight in flight against a site answering in a few hundred
 * milliseconds is roughly 200 per 10s, so the default walk trips it, gets
 * blocked, and reports a *smaller* reachable set -- the one failure mode this
 * script must never have, since its whole output is the answer to "is this
 * bounded?". A short walk that stops early looks exactly like a healthy bound.
 *
 * Local runs should leave it alone. Against production use CRAWL_CONCURRENCY=2,
 * which keeps the walk near 5 req/s.
 */
const CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY) || 8;

/** CRAWL_DUMP=1 prints every reachable path, grouped, for eyeballing shape. */
const DUMP = process.env.CRAWL_DUMP === '1';

/**
 * Only the `*` group matters: this is asking what an ordinary crawler sees.
 *
 * Both lists, not just Disallow. `/player/` is disallowed as a prefix while a
 * bounded allowlist of individual tags is permitted (see
 * scripts/gen-indexable-players.ts), and a reader that ignored Allow would
 * report a smaller surface than a real crawler walks -- which is the one
 * mistake this script must not make, since its output is the answer to "is
 * this bounded?".
 */
async function robotsRules() {
  const text = await fetch(`${BASE}/robots.txt`).then((r) => r.text());
  const disallow = [];
  const allow = [];
  let inStar = false;
  for (const line of text.split('\n')) {
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') inStar = value === '*';
    else if (inStar && key === 'disallow' && value) disallow.push(value);
    else if (inStar && key === 'allow' && value) allow.push(value);
  }
  return { disallow, allow };
}

/**
 * Longest match wins, which is how every major crawler resolves a conflict
 * between an Allow and a Disallow that both match a path.
 */
function isBlocked({ disallow, allow }, pathname) {
  let blockedBy = 0;
  for (const prefix of disallow) {
    if (pathname.startsWith(prefix) && prefix.length > blockedBy) blockedBy = prefix.length;
  }
  if (blockedBy === 0) return false;
  for (const prefix of allow) {
    if (pathname.startsWith(prefix) && prefix.length >= blockedBy) return false;
  }
  return true;
}

/*
 * A crawler reads the markup, so this does too. `next/link` renders a plain
 * anchor, and parsing the anchors is the only way to see what a crawler sees —
 * `router.push` from a `<select>`, which is how the leaderboard's ~250 region
 * boards are reached, is correctly invisible here.
 */
const ANCHOR = /<a\b([^>]*)>/gi;
const HREF = /\bhref="([^"]*)"/i;
const REL = /\brel="([^"]*)"/i;

function linksIn(html, from) {
  const out = new Set();
  for (const [, attrs] of html.matchAll(ANCHOR)) {
    if (REL.exec(attrs)?.[1].includes('nofollow')) continue;
    const href = HREF.exec(attrs)?.[1];
    if (!href || href.startsWith('#')) continue;

    let url;
    try {
      url = new URL(href, from);
    } catch {
      continue;
    }
    if (url.origin !== new URL(BASE).origin) continue;
    // Query strings and fragments are not separate documents here: every tool
    // on this site spells its state in the path now, deliberately.
    out.add(url.pathname);
  }
  return out;
}

/** First path segment, which is granular enough to name the offender. */
function section(pathname) {
  const [, first] = pathname.split('/');
  return first ? `/${first}` : '/';
}

async function main() {
  const rules = await robotsRules();
  const disallow = rules.disallow;
  console.log(`base      ${BASE}`);
  console.log(`disallow  ${disallow.join(' ') || '(none)'}\n`);

  const seen = new Set(['/']);
  const bytes = new Map();
  let queue = ['/'];
  let capped = false;
  let throttled = 0;

  while (queue.length > 0 && !capped) {
    const batch = queue.splice(0, CONCURRENCY);
    const found = await Promise.all(
      batch.map(async (pathname) => {
        const response = await fetch(`${BASE}${pathname}`, {
          headers: { 'user-agent': 'crawl-budget (bot)' },
        });
        // A blocked path answers 404 with no body, which is the enforcement
        // working; counting its bytes as a page would misreport the saving.
        // 429 and 403 are the rate limiter, not the site: treat them as fatal
        // rather than as "no links here". Swallowing them would shrink the
        // reported surface and turn a throttled run into a false all-clear.
        if (response.status === 429 || response.status === 403) {
          throttled += 1;
        }
        if (!response.ok) return new Set();
        const html = await response.text();
        bytes.set(section(pathname), (bytes.get(section(pathname)) ?? 0) + html.length);
        return linksIn(html, `${BASE}${pathname}`);
      }),
    );

    for (const pathname of found.flatMap((set) => [...set])) {
      if (seen.has(pathname)) continue;
      if (isBlocked(rules, pathname)) continue;
      seen.add(pathname);
      queue.push(pathname);
      if (seen.size > CAP) {
        capped = true;
        break;
      }
    }
  }

  const bySection = new Map();
  for (const pathname of seen) {
    bySection.set(section(pathname), (bySection.get(section(pathname)) ?? 0) + 1);
  }

  console.log('section            URLs        raw HTML');
  for (const [name, count] of [...bySection].sort((a, b) => b[1] - a[1])) {
    const mb = (bytes.get(name) ?? 0) / 1e6;
    console.log(`${name.padEnd(18)} ${String(count).padStart(5)}    ${mb.toFixed(1).padStart(8)} MB`);
  }
  console.log(`${'TOTAL'.padEnd(18)} ${String(seen.size).padStart(5)}`);

  if (DUMP) {
    console.log('\n--- reachable paths ---');
    for (const pathname of [...seen].sort()) console.log(pathname);
  }

  if (throttled > 0) {
    console.error(
      `\nTHROTTLED: ${throttled} request(s) were refused with 403/429.\n` +
        'The number above is therefore a FLOOR, not the bound. Re-run with\n' +
        'CRAWL_CONCURRENCY=2, or against a local `next start`.',
    );
    process.exitCode = 1;
  }

  if (capped) {
    console.error(
      `\nUNBOUNDED: stopped at ${CAP} URLs and the queue was still growing.\n` +
        'The largest section above is the trap. Either bound the route or add\n' +
        'its prefix to CRAWLER_DISALLOW in src/lib/crawl-policy.ts.',
    );
    process.exitCode = 1;
  }
}

main();
