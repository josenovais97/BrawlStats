import 'server-only';

import { getPrisma } from '@/lib/prisma';

/**
 * The newest post on the site's own TikTok, as written by the box.
 *
 * The row is refreshed by `brawlzone-tiktok-latest` rather than fetched here,
 * because reading it from TikTok needs an access token and the refresh token
 * that mints one rotates on every use. Whatever holds it has to write the new
 * one back, which rules out the app container: it is rebuilt on every deploy
 * and its filesystem goes with it. So the box fetches and the site reads, and
 * the database is the only place both can reach that survives a rebuild.
 *
 * A missing row is the normal state before the first refresh, and the card
 * built on this renders nothing rather than an empty frame. The YouTube card
 * this replaced learned that the hard way: it shipped against a channel with
 * zero entries and rendered an empty frame for a day.
 */

/** The account the box posts to. `@brawlzone` is a different account. */
export const TIKTOK_PROFILE_URL = 'https://www.tiktok.com/@brawlzone.net';

export interface TikTokLatestPost {
  postId: string;
  url: string;
  title: string | null;
  coverUrl: string | null;
  postedAt: string | null;
}

/**
 * Read straight through rather than wrapped in `cachedRead`.
 *
 * The home page is ISR, so this runs once per revalidation rather than per
 * view, and one indexed lookup of a single row is cheaper than the cache entry
 * that would wrap it. `cachedRead` also lives inside `lib/stats` and exporting
 * it to reach one row would widen that module's surface for nothing.
 */
export async function getLatestTikTokPost(): Promise<TikTokLatestPost | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  try {
    const row = await prisma.tikTokLatestPost.findUnique({ where: { id: 1 } });
    if (!row) return null;

    return {
      postId: row.postId,
      url: row.url,
      title: row.title,
      coverUrl: row.coverUrl,
      postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    };
  } catch {
    // Swallowed like every other lib/stats read: one broken aggregate must not
    // take down a page that has nine working ones.
    return null;
  }
}
