import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  DEFAULT_BOARD,
  DEFAULT_REGION,
  isLeaderboardBoard,
  leaderboardHref,
} from '@/lib/leaderboard-route';
import { MAX_ENEMIES, draftHref } from '@/lib/draft-route';
import { INDEXABLE_PLAYER_TAGS } from '@/generated/indexable-players';
import { shouldBlockCrawl } from '@/lib/crawl-policy';
import { slugify } from '@/lib/slugs';

/**
 * Permanent redirects for the URLs that used to carry state in query strings.
 *
 * Four pages moved their state into the path — the tier lists, the compare
 * tool, the leaderboard and the draft helper — and none of the redirects can
 * live in the pages themselves any more. Reading `searchParams` in a server component is exactly
 * what opts a route out of static rendering, and getting these pages *back*
 * into the cache is the whole reason the schemes changed. A redirect that
 * lived in the page would keep the page dynamic in order to serve the visitors
 * who no longer need it.
 *
 * So it lives here, ahead of the render, where it costs the cached pages
 * nothing. The old links are worth honouring rather than dropping: they are in
 * shared links, in whatever search engines already indexed, and — for the
 * compare tool — in the one place a comparison is ever stored.
 *
 * Unknown values resolve to the default rather than 404ing. `?window=30d` names
 * a window that no longer exists, and a stale link asking for it wants the
 * page, not an error.
 */

const TIER_LIST = /^\/tier-list\/(ranked|trophy)(?:\/|$)/;

/** Mirrors `TIER_WINDOWS`, minus the default, which is spelled as a bare path. */
const WINDOW_SEGMENTS = new Set(['24h']);

/** Where a legacy URL should have pointed, or null if it is already canonical. */
function canonicalPath(pathname: string, searchParams: URLSearchParams): string | null {
  const tierList = TIER_LIST.exec(pathname);
  if (tierList) {
    const mode = searchParams.get('mode');
    const windowKey = searchParams.get('window');
    // Nothing legacy in the URL, so it is already canonical. Returning null
    // matters: redirecting unconditionally would redirect the target too.
    if (!mode && !windowKey) return null;

    const segments = ['tier-list', tierList[1]];
    if (mode) segments.push(slugify(mode));
    if (windowKey && WINDOW_SEGMENTS.has(windowKey)) segments.push(windowKey);
    return `/${segments.join('/')}`;
  }

  /*
   * `/compare?player1=&player2=` predates `/compare/players/[a]/[b]`, and the
   * tool's whole premise is that a comparison is a link someone keeps — "they
   * are shareable and nothing is stored" — so the old ones have to keep
   * working. Same reasoning as the tier list: the pairing moved to a path so
   * that `/compare` itself could stop being rendered per request.
   */
  if (pathname === '/compare') {
    const a = searchParams.get('player1')?.trim();
    const b = searchParams.get('player2')?.trim();
    if (!a || !b) return null;
    return `/compare/players/${encodeURIComponent(a)}/${encodeURIComponent(b)}`;
  }

  /*
   * `/leaderboard?type=&region=`. Both moved into the path for the same
   * reason, and both are worth honouring: a region board is the kind of link
   * people keep, and `?type=clubs` is what every share of the club board looks
   * like today.
   *
   * The board is validated rather than passed through, so a hand-edited
   * `?type=` cannot mint a path that 404s — an unknown board falls back to the
   * default rather than redirecting into an error.
   */
  if (pathname === '/leaderboard') {
    const type = searchParams.get('type');
    const region = searchParams.get('region');
    if (!type && !region) return null;

    const board = type && isLeaderboardBoard(type) ? type : DEFAULT_BOARD;
    return leaderboardHref(board, region?.toLowerCase() ?? DEFAULT_REGION);
  }

  /*
   * `/draft?map=&mode=&enemy=`. The enemy list changes separator and base as
   * well as position — comma-joined full ids become dash-joined short ones —
   * so it is re-encoded here rather than passed through.
   */
  if (pathname === '/draft') {
    const map = searchParams.get('map');
    const mode = searchParams.get('mode');
    const enemy = searchParams.get('enemy');
    if (!map && !mode && !enemy) return null;
    // Enemies were only ever reachable alongside a map, and there is no path
    // that spells them without one.
    if (!map || !mode) return '/draft';

    const enemies = (enemy ?? '')
      .split(',')
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0)
      .slice(0, MAX_ENEMIES);

    return draftHref({ mode, map, enemies });
  }

  return null;
}

/**
 * Answered before anything renders, which is the entire point.
 *
 * A crawler reaching a disallowed path has already ignored `robots.txt`, or is
 * working from a cached copy of it and a queue of URLs discovered before the
 * rule existed. Either way the page behind it costs a database round trip, an
 * ISR write and a couple of hundred kilobytes of origin transfer, and refusing
 * here costs a regex test.
 *
 * 404 rather than 403: it is the same answer the draft page already gives a
 * path shape it does not have, and it is the one a crawler responds to by
 * dropping the URL rather than retrying it. No body, because the recipient is
 * a machine and every byte here is billed as origin transfer.
 */
const CRAWLER_REFUSED = 'Not found.\n';

export function proxy(request: NextRequest): NextResponse | undefined {
  const { pathname, searchParams } = request.nextUrl;

  // The allowlist is baked at build time (scripts/gen-indexable-players.ts)
  // because `config.matcher` below has to be statically analysable and this
  // runs on every profile view -- a lookup here would cost more than the crawl
  // it prevents. An empty set means nothing is indexable, which is the
  // behaviour this had before the allowlist existed.
  if (shouldBlockCrawl(pathname, request.headers.get('user-agent'), INDEXABLE_PLAYER_TAGS)) {
    return new NextResponse(CRAWLER_REFUSED, {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        // Nothing downstream should hold this: the same URL served to a person
        // is a real page, and only the user agent decided otherwise.
        'cache-control': 'no-store',
      },
    });
  }

  const target = canonicalPath(pathname, searchParams);
  if (!target) return;

  const url = request.nextUrl.clone();
  url.pathname = target;
  // Every other parameter is dropped on purpose: the ones read above were the
  // only ones these pages ever read, and carrying unknown ones through would
  // reopen the duplicate-URL problem this change closes.
  url.search = '';

  return NextResponse.redirect(url, 308);
}

/**
 * Two jobs, so two sets of paths.
 *
 * The first four are the legacy query-string redirects above. The rest are
 * `CRAWLER_DISALLOW`, spelled as matchers because this file cannot read that
 * list at build time — `config` has to be statically analysable, so a
 * mismatch is caught by `crawl-policy.test.ts` rather than by the compiler.
 *
 * `/player/:path*` is on the hot path and the cost of putting it here is one
 * regex test per profile view. It earns that many times over: `/player/[tag]`
 * is the only route on the site that renders fully per request *and* makes an
 * upstream API call, so it is the most expensive thing a crawler can find.
 */
export const config = {
  matcher: [
    '/tier-list/:path*',
    '/compare',
    '/leaderboard',
    '/draft',
    '/api/:path*',
    // Both, because the disallowed prefix has no trailing slash: the Umami
    // dashboard sits at exactly /analytics, which a :path* matcher misses.
    //
    // No apostrophes in this block. crawl-policy.test.ts extracts the entries
    // with a single-quote regex over this file as text, so one in a comment
    // shifts the pairing and silently hides the entries after it.
    '/analytics',
    '/analytics/:path*',
    '/player/:path*',
    '/club/:path*',
    '/draft/:path*',
    '/compare/players/:path*',
  ],
};
