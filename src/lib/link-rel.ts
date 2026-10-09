import { INDEXABLE_PLAYER_TAGS } from '@/generated/indexable-players';
import { normalizeTag } from '@/lib/tags';

/**
 * `rel` for links into pages Google is told not to index.
 *
 * Search Console (2026-10-09): 974 pages excluded by noindex and 827
 * "discovered, not indexed" -- a seven-week-old site's small crawl budget
 * going on pages it will never index, while the map and compare pages in the
 * sitemaps waited to be crawled at all. Player profiles outside the indexable
 * set answer Googlebot with a 404, and club pages are noindex, yet leaderboards,
 * battle logs and club rosters link to thousands of them.
 *
 * `nofollow` asks the crawler not to spend a fetch on those links. Visitors see
 * no difference. The compare matchups already do the same for pairs outside
 * `getIndexablePairs`.
 */
export function playerLinkRel(tag: string | null | undefined): 'nofollow' | undefined {
  return INDEXABLE_PLAYER_TAGS.has(normalizeTag(tag)) ? undefined : 'nofollow';
}

/** Club pages are never indexed. */
export const CLUB_LINK_REL = 'nofollow' as const;
