import 'server-only';

import { getBrawlerWiki } from '@/lib/brawler-wiki';
import { cached } from '@/lib/cached';
import { titleCase } from '@/lib/format';
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
 * Each one is then filled in from its wiki page: rarity, class, the combat
 * stats and the names of its gadgets and star powers. That is the same parser
 * the brawler pages already use, so it costs nothing new.
 *
 * How complete that is depends entirely on how long ago the reveal was, and
 * the card is built to degrade rather than to look broken. Measured the day
 * after this month's Brawl Talk: one of the two had full stats, four named
 * abilities and a portrait, while the other had only its rarity and four
 * placeholder abilities the wiki writes as "pending". Placeholders are
 * dropped; a brawler with nothing but a name still gets a card.
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

/** What the wiki knows about a brawler that has not shipped. */
export interface UpcomingBrawler {
  name: string;
  rarityName: string | null;
  className: string | null;
  /** Combat stats, only where the infobox has been filled in. */
  stats: { label: string; value: string }[];
  /** Gadget and star power names. Empty while the wiki still says "pending". */
  abilities: string[];
  portraitUrl: string | null;
}

/** The wiki files a brawler's portrait under a predictable name. */
async function portraitFor(name: string): Promise<string | null> {
  try {
    const url = new URL(WIKI_API);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'allimages');
    url.searchParams.set('aiprefix', `${name}_Portrait`);
    url.searchParams.set('ailimit', '2');
    url.searchParams.set('aiprop', 'url');
    url.searchParams.set('format', 'json');
    const res = await fetch(url, {
      headers: { 'user-agent': 'BrawlZone (+https://brawlzone.net)' },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { query?: { allimages?: { url: string }[] } };
    return body.query?.allimages?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

async function fetchDetails(names: string[]): Promise<UpcomingBrawler[]> {
  return Promise.all(
    names.map(async (name) => {
      const [wiki, portraitUrl] = await Promise.all([
        getBrawlerWiki(name).catch(() => null),
        portraitFor(name),
      ]);
      const s = wiki?.stats;

      const stats: { label: string; value: string }[] = [];
      const push = (label: string, value: string | null | undefined) => {
        if (value) stats.push({ label, value });
      };
      push('Health', s?.health);
      push(s?.attackLabel ?? 'Attack', s?.attack);
      push(s?.superLabel ?? 'Super', s?.super);
      push('Reload', s?.reload);
      push('Speed', s?.movementSpeed);
      push('Range', s?.attackRange);

      // The wiki names an unwritten ability "Gadget 1 (Pending)". Rendering
      // that reads as a bug rather than as an unfinished page.
      const abilities = [...(wiki?.abilities.keys() ?? [])]
        .filter((slug) => !/pending/i.test(slug))
        .map((slug) => titleCase(slug.replace(/-/g, ' ')));

      return {
        name: titleCase(name),
        rarityName: s?.rarityName ?? null,
        className: s?.className ?? null,
        stats,
        abilities,
        portraitUrl,
      };
    }),
  );
}

/** Brawlers revealed but not yet playable, with whatever the wiki knows. */
export const getUpcomingBrawlers = cached(
  'upcoming-brawlers',
  async (liveNames: string[]) => fetchDetails(await fetchUpcoming(liveNames)),
  REVALIDATE,
);
