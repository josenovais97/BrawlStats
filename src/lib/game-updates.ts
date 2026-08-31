import 'server-only';

import { cached } from '@/lib/cached';
import { WIKI_API } from '@/lib/wiki';

/**
 * What the latest game update actually touched, brawler by brawler.
 *
 * Supercell's own release notes are prose, so `lib/release-notes` can show
 * them but cannot answer "did my brawler change?" — and that is the question
 * every player has in the hours after an update, which is exactly when the
 * searches happen and when almost nobody has published anything yet.
 *
 * The wiki's version history is structured where the official post is not: an
 * update is a heading, and beneath it sit headings for new brawlers, new
 * hypercharges, new buffies and balance changes, with the affected brawlers as
 * their own sub-headings. Only the section *outline* is read — headings and
 * their nesting — never the body text. Names and categories are facts; the
 * write-ups are the wiki's own work and belong to it.
 *
 * Sections are matched against the live brawler catalogue rather than by
 * heading depth, because the wiki's levels are inconsistent: in the June 2026
 * notes one new brawler sits at level 4 and the next at level 3. Matching on
 * names survives that.
 */

/** The page holding the current year's updates. */
const HISTORY_PAGE = () => `Version History/${new Date().getUTCFullYear()}`;

/** Updates land and then sit still; hourly keeps update day fast. */
const REVALIDATE = 3600;

/** Section headings that introduce a category rather than a brawler. */
const CATEGORIES: { key: GameUpdateCategory; test: RegExp }[] = [
  { key: 'brawlers', test: /new\s+brawler/i },
  { key: 'hypercharges', test: /hypercharge/i },
  { key: 'buffies', test: /buffie/i },
  { key: 'balance', test: /balance/i },
  { key: 'gadgets', test: /gadget/i },
  { key: 'starPowers', test: /star\s*power/i },
];

export type GameUpdateCategory =
  | 'brawlers'
  | 'hypercharges'
  | 'buffies'
  | 'balance'
  | 'gadgets'
  | 'starPowers';

export interface GameUpdate {
  /** The update's own heading, e.g. "Release Notes June 2026". */
  title: string;
  /** Brawlers affected, grouped by what happened to them. */
  changes: { category: GameUpdateCategory; brawlers: string[] }[];
}

interface WikiSection {
  line: string;
  level: string;
}

/** Strips the wiki's trailing qualifiers: "Nori - Legendary - Assassin". */
function headingName(line: string): string {
  return line
    .replace(/<[^>]*>/g, '')
    .split(/\s+[-–—]\s+/)[0]
    .replace(/[:.]+$/, '')
    .trim();
}

async function fetchUpdates(known: Set<string>): Promise<GameUpdate[]> {
  try {
    const url = new URL(WIKI_API);
    url.searchParams.set('action', 'parse');
    url.searchParams.set('page', HISTORY_PAGE());
    url.searchParams.set('prop', 'sections');
    url.searchParams.set('format', 'json');

    const res = await fetch(url, {
      headers: { 'user-agent': 'BrawlZone (+https://brawlzone.net)' },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];

    const body = (await res.json()) as { parse?: { sections?: WikiSection[] } };
    const sections = body.parse?.sections ?? [];
    if (sections.length === 0) return [];

    const updates: GameUpdate[] = [];
    let current: GameUpdate | null = null;
    let category: GameUpdateCategory | null = null;

    for (const section of sections) {
      const line = section.line.replace(/<[^>]*>/g, '').trim();
      if (!line) continue;
      const name = headingName(line);
      const isBrawler = known.has(name.toLowerCase());

      // A heading naming a known brawler is a change entry, whatever its depth.
      if (isBrawler) {
        if (!current || !category) continue;
        const bucket = current.changes.find((c) => c.category === category);
        if (bucket) {
          if (!bucket.brawlers.includes(name)) bucket.brawlers.push(name);
        } else {
          current.changes.push({ category, brawlers: [name] });
        }
        continue;
      }

      const matched = CATEGORIES.find((c) => c.test.test(line));
      if (matched) {
        category = matched.key;
        continue;
      }

      // Anything else that is neither a brawler nor a category starts a new
      // update — "Release Notes June 2026", "Maintenance - July 8".
      if (/release notes|update|maintenance|season/i.test(line)) {
        // Wiki headings carry decoration: "⚠️ After Maintenance ⚠️". Strip it,
        // and skip anything left too short to be a real heading.
        const title = line
          .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (title.length < 4) continue;
        current = { title, changes: [] };
        updates.push(current);
        category = null;
      }
    }

    return updates.filter((u) => u.changes.length > 0);
  } catch {
    // An unreachable wiki costs this section, never the page.
    return [];
  }
}

/** Cached per set of known brawler names, which changes only when one ships. */
export const getGameUpdates = cached(
  'game-updates',
  async (knownNames: string[]) => fetchUpdates(new Set(knownNames.map((n) => n.toLowerCase()))),
  REVALIDATE,
);

/** How each category reads on the page. */
export const CATEGORY_LABEL: Record<GameUpdateCategory, string> = {
  brawlers: 'New brawlers',
  hypercharges: 'New hypercharges',
  buffies: 'New buffies',
  balance: 'Balance changes',
  gadgets: 'New gadgets',
  starPowers: 'New star powers',
};
