import 'server-only';

import { cached } from '@/lib/cached';
import { WIKI_API } from '@/lib/wiki';

/**
 * Brawlers announced but not yet in the game, found by difference.
 *
 * The wiki creates a brawler's page when it is revealed, while the game API
 * only lists it once it ships. So anything in the wiki's brawler category that
 * the catalogue does not know about is, by definition, announced and pending.
 * Measured 2026-08-31: 109 on the wiki against 107 live, and the two extras
 * were exactly the pair revealed in that month's Brawl Talk.
 *
 * This began as a hand-curated list, on the assumption that reveals could not
 * be automated — Category:Upcoming, Category:Unreleased and their variants are
 * all empty, and there is no Brawl Talk page, so there is no source that
 * *states* what is coming. The difference states it implicitly, which is
 * better than curation in every way that matters: nothing to remember on
 * announcement day, and nothing to clean up on release day, because a brawler
 * that ships enters the catalogue and leaves this set on its own.
 *
 * Deliberately only names them. What a brawler does before release is video
 * commentary and rumour, and this site does not publish either — the value
 * here is being the page that already exists when people start searching the
 * name, which needs nothing more than the name.
 *
 * The reverse difference is checked too. If the catalogue ever holds a brawler
 * the wiki category does not, the two are disagreeing about *naming* rather
 * than about releases, and the whole answer is suppressed rather than
 * publishing a live brawler as "upcoming".
 */

/** Announcements matter in hours, so this is polled far more often than the wiki changes. */
const REVALIDATE = 1800;

async function fetchUpcoming(liveNames: string[]): Promise<string[]> {
  try {
    const url = new URL(WIKI_API);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'categorymembers');
    url.searchParams.set('cmtitle', 'Category:Brawlers');
    url.searchParams.set('cmlimit', '500');
    url.searchParams.set('cmnamespace', '0');
    url.searchParams.set('format', 'json');

    const res = await fetch(url, {
      headers: { 'user-agent': 'BrawlZone (+https://brawlzone.net)' },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];

    const body = (await res.json()) as {
      query?: { categorymembers?: { title: string }[] };
    };
    const wiki = (body.query?.categorymembers ?? []).map((m) => m.title).filter(Boolean);
    // A short list means the category moved or the fetch half-failed; a
    // difference computed against it would call most of the roster upcoming.
    if (wiki.length < liveNames.length) return [];

    const live = new Set(liveNames.map((n) => n.toLowerCase()));
    const wikiLower = new Set(wiki.map((n) => n.toLowerCase()));

    // Disagreement in the other direction means the two sides name brawlers
    // differently, not that something is unreleased. Say nothing rather than
    // announce a brawler that has been out for months.
    const missingFromWiki = liveNames.filter((n) => !wikiLower.has(n.toLowerCase()));
    if (missingFromWiki.length > 0) return [];

    return wiki.filter((n) => !live.has(n.toLowerCase()));
  } catch {
    // An unreachable wiki costs this section, never the page.
    return [];
  }
}

/** Names of brawlers revealed but not yet playable. Empty when there are none. */
export const getUpcomingBrawlers = cached('upcoming-brawlers', fetchUpcoming, REVALIDATE);
