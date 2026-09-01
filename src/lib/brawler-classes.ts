import 'server-only';

import { getBrawlerWiki } from '@/lib/brawler-wiki';
import { cached } from '@/lib/cached';
import { titleCase } from '@/lib/format';

/**
 * Classes for the brawlers the artwork mirror does not classify.
 *
 * Brawlify reports `class: "Unknown"` for every brawler released since Meeple
 * — twenty of them, a fifth of the roster — so those cards showed no class
 * chip at all and the class filter on the brawler index quietly returned
 * incomplete lists. Picking "Assassin" missed Kaze, Alli, Gigi, Starr Nova and
 * Nori, with nothing on screen to say so.
 *
 * The wiki has every one. Checked 2026-09-01: all twenty resolved on the first
 * try, with no name mismatches, which is what makes a sweep viable rather than
 * a table of special cases.
 *
 * Only the unclassified names are fetched, not the whole roster — that is
 * twenty requests instead of a hundred and seven, and the mirror is already
 * right about the rest. Cached for a day, because a brawler's class changes
 * when a brawler is added and at no other time.
 */

/** A class is settled data; a day is generous and keeps this off the hot path. */
const REVALIDATE = 86_400;

async function fetchClasses(names: string[]): Promise<[string, string][]> {
  if (names.length === 0) return [];

  const found = await Promise.all(
    names.map(async (name): Promise<[string, string] | null> => {
      /*
       * Title-cased before asking. The official API shouts its names — "COSMO"
       * — and a brawler with no artwork-mirror entry takes its name from
       * there, which is precisely the brawler this lookup exists for. The raw
       * name is kept as a second attempt for anything the casing rule mangles.
       */
      const wiki =
        (await getBrawlerWiki(titleCase(name)).catch(() => null)) ??
        (await getBrawlerWiki(name).catch(() => null));
      const className = wiki?.stats.className?.trim();
      // The wiki carries its own "Unknown" for a brawler nobody has written up
      // yet, and echoing it would undo the point of asking.
      if (!className || /unknown/i.test(className)) return null;
      return [name.toLowerCase(), className];
    }),
  );

  return found.filter((entry): entry is [string, string] => entry !== null);
}

/**
 * Keyed by lowercased name, holding only what was recovered.
 *
 * An unreachable wiki yields an empty map and every caller falls back to the
 * behaviour it had before: no chip, rather than a wrong one.
 */
export const getWikiBrawlerClasses = cached('wiki-brawler-classes', fetchClasses, REVALIDATE);
