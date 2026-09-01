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

export interface WikiBrawlerFacts {
  className: string | null;
  rarityName: string | null;
}

async function fetchClasses(names: string[]): Promise<[string, WikiBrawlerFacts][]> {
  if (names.length === 0) return [];

  const found = await Promise.all(
    names.map(async (name): Promise<[string, WikiBrawlerFacts] | null> => {
      /*
       * Title-cased before asking. The official API shouts its names — "COSMO"
       * — and a brawler with no artwork-mirror entry takes its name from
       * there, which is precisely the brawler this lookup exists for. The raw
       * name is kept as a second attempt for anything the casing rule mangles.
       */
      const wiki =
        (await getBrawlerWiki(titleCase(name)).catch(() => null)) ??
        (await getBrawlerWiki(name).catch(() => null));
      const real = (value: string | null | undefined) => {
        const trimmed = value?.trim();
        // The wiki carries its own "Unknown" for a brawler nobody has written
        // up yet, and echoing it would undo the point of asking.
        return trimmed && !/unknown/i.test(trimmed) ? trimmed : null;
      };
      const className = real(wiki?.stats.className);
      const rarityName = real(wiki?.stats.rarityName);
      if (!className && !rarityName) return null;
      return [name.toLowerCase(), { className, rarityName }];
    }),
  );

  return found.filter((entry): entry is [string, WikiBrawlerFacts] => entry !== null);
}

/**
 * Keyed by lowercased name, holding only what was recovered.
 *
 * An unreachable wiki yields an empty map and every caller falls back to the
 * behaviour it had before: no chip, rather than a wrong one.
 */
export const getWikiBrawlerFacts = cached('wiki-brawler-facts', fetchClasses, REVALIDATE);
