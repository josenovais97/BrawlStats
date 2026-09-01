import 'server-only';

import { getBrawlerWiki } from '@/lib/brawler-wiki';
import { cached } from '@/lib/cached';
import { titleCase } from '@/lib/format';

/**
 * Classes for the brawlers the artwork mirror does not classify.
 *
 * This began as a gap-filler: Brawlify reported `class: "Unknown"` for every
 * brawler released since Meeple, so a fifth of the roster showed no class chip
 * and the index's class filter silently returned incomplete lists.
 *
 * On 2026-09-01 it became the only source. The mirror started returning the
 * brawler's tagline in `class.name` instead of its class, so `realBrawlerClass`
 * now rejects every value it sends and the whole roster arrives here. The
 * wiki has all of them — checked, with no name mismatches — which is what
 * makes a sweep viable rather than a table of special cases.
 *
 * Cached for a day: a brawler's class changes when a brawler is added and at
 * no other time. If the mirror is ever fixed, this shrinks back to the handful
 * it cannot classify without anything here changing.
 */

/** A class is settled data; a day is generous and keeps this off the hot path. */
const REVALIDATE = 86_400;

export interface WikiBrawlerFacts {
  className: string | null;
  rarityName: string | null;
}

async function fetchClasses(names: string[]): Promise<[string, WikiBrawlerFacts][]> {
  if (names.length === 0) return [];

  /*
   * Bounded concurrency, because this is now the whole roster rather than the
   * twenty it was written for. `Promise.all` over 108 names is up to 216
   * simultaneous requests at the wiki — enough to look like something worth
   * rate-limiting, and the fallback for a throttled response is a brawler with
   * no class, which is the exact problem this exists to fix.
   *
   * Eight at a time finishes a cold sweep in a few seconds, and the result is
   * cached for a day, so this runs about once per deploy.
   */
  const CONCURRENCY = 8;
  const found: ([string, WikiBrawlerFacts] | null)[] = [];
  for (let i = 0; i < names.length; i += CONCURRENCY) {
    const batch = await Promise.all(
      names.slice(i, i + CONCURRENCY).map(lookup),
    );
    found.push(...batch);
  }

  return found.filter((entry): entry is [string, WikiBrawlerFacts] => entry !== null);
}

async function lookup(name: string): Promise<[string, WikiBrawlerFacts] | null> {
  /*
   * Title-cased before asking. The official API shouts its names — "COSMO" —
   * and a brawler with no artwork-mirror entry takes its name from there, which
   * is precisely the brawler this lookup exists for. The raw name is kept as a
   * second attempt for anything the casing rule mangles.
   */
  const wiki =
    (await getBrawlerWiki(titleCase(name)).catch(() => null)) ??
    (await getBrawlerWiki(name).catch(() => null));

  const real = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    // The wiki carries its own "Unknown" for a brawler nobody has written up
    // yet, and echoing it would undo the point of asking.
    return trimmed && !/unknown/i.test(trimmed) ? trimmed : null;
  };

  const className = real(wiki?.stats.className);
  const rarityName = real(wiki?.stats.rarityName);
  if (!className && !rarityName) return null;
  return [name.toLowerCase(), { className, rarityName }];
}

/**
 * Keyed by lowercased name, holding only what was recovered.
 *
 * An unreachable wiki yields an empty map and every caller falls back to the
 * behaviour it had before: no chip, rather than a wrong one.
 */
export const getWikiBrawlerFacts = cached('wiki-brawler-facts', fetchClasses, REVALIDATE);
