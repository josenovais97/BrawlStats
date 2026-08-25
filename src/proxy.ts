import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { slugify } from '@/lib/slugs';

/**
 * Permanent redirects for the tier-list URLs that used query parameters.
 *
 * `?mode=` and `?window=` are both path segments now. Neither can be handled
 * by the pages themselves any more: reading `searchParams` in a server
 * component is exactly what opts a route out of static rendering, and getting
 * these two pages *back* into the cache is the whole reason the scheme
 * changed. A redirect that lives in the page would keep the page dynamic in
 * order to serve the visitors who no longer need it.
 *
 * So it lives here, ahead of the render, where it costs the cached pages
 * nothing. The old links are worth honouring rather than dropping: `?mode=`
 * predates the per-mode pages and is out there in shared links and in whatever
 * search engines already indexed.
 *
 * `?window=30d` resolves to the default rather than 404ing. The window no
 * longer exists — 30d was removed — and a stale link asking for it wants this
 * page, not an error.
 */

const TIER_LIST = /^\/tier-list\/(ranked|trophy)(?:\/|$)/;

/** Mirrors `TIER_WINDOWS`, minus the default, which is spelled as a bare path. */
const WINDOW_SEGMENTS = new Set(['24h']);

export function proxy(request: NextRequest): NextResponse | undefined {
  const { pathname, searchParams } = request.nextUrl;

  const match = TIER_LIST.exec(pathname);
  if (!match) return;

  const mode = searchParams.get('mode');
  const windowKey = searchParams.get('window');
  // Nothing legacy in the URL, so it is already canonical. Returning early
  // matters: rewriting unconditionally would redirect the target too, forever.
  if (!mode && !windowKey) return;

  const segments = ['tier-list', match[1]];
  if (mode) segments.push(slugify(mode));
  if (windowKey && WINDOW_SEGMENTS.has(windowKey)) segments.push(windowKey);

  const url = request.nextUrl.clone();
  url.pathname = `/${segments.join('/')}`;
  // Every other parameter is dropped on purpose: these two were the only ones
  // the page ever read, and carrying unknown ones through would reopen the
  // duplicate-URL problem this change closes.
  url.search = '';

  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: '/tier-list/:path*',
};
