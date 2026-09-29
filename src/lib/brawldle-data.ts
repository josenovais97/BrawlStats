import 'server-only';

import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { getCombatTiers } from '@/lib/brawler-combat-tiers';
import type { BrawldleBrawler } from '@/lib/brawldle';
import { slugify } from '@/lib/slugs';
import { getScoredRoster } from '@/lib/stats';

/**
 * The roster the puzzle is played against.
 *
 * Current brawlers only. A retired brawler is still a real answer to "name a
 * brawler" and would be a miserable one to guess, and its tier and pick rate
 * would both be null, so two of the five clues would be dead.
 *
 * Sorted by id, which is release order, because `answerFor` indexes into this
 * array. Sorting by name would reshuffle every future puzzle the first time
 * the artwork mirror renamed anything -- the same reason `brawlerOfDay` sorts
 * by id and says so.
 *
 * Tier and pick rate come from the live ranked list, so the puzzle's clues
 * move with the meta. That is deliberate: a brawler that climbed into S tier
 * this week should be guessable as an S-tier brawler this week. It also means
 * the clues agree with /tier-list/ranked, which matters because a player who
 * checks will find the same numbers.
 */
export async function brawldleRoster(): Promise<BrawldleBrawler[]> {
  const [catalog, scored] = await Promise.all([
    getBrawlerCatalog().catch(() => null),
    getScoredRoster(7, undefined, 'ranked').catch(() => []),
  ]);
  if (!catalog || catalog.current.length === 0) return [];

  const meta = new Map(scored.map((b) => [b.brawlerId, b]));
  // Three batched wiki requests for the whole roster, cached for a day.
  const tiers = await getCombatTiers(catalog.current.map((b) => b.name));

  return [...catalog.current]
    .sort((a, b) => a.id - b.id)
    .map((b) => {
      const m = meta.get(b.id);
      return {
        id: b.id,
        name: b.name,
        slug: slugify(b.name),
        imageUrl: b.imageUrl ?? null,
        rarity: b.rarityName,
        className: b.className,
        tier: m?.tier ?? null,
        movement: tiers.get(b.name.toLowerCase())?.movement ?? null,
        range: tiers.get(b.name.toLowerCase())?.range ?? null,
        reload: tiers.get(b.name.toLowerCase())?.reload ?? null,
      };
    });
}

/** Just enough for the picker: no clue values, no answer. */
export interface PickerEntry {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
}

/**
 * What the browser is allowed to know.
 *
 * The full roster with its clue values is deliberately NOT sent. A player who
 * opened the page source could otherwise diff every brawler against the
 * clues they already have and solve it without guessing -- and more simply,
 * the answer itself must not be sitting in the HTML. Guesses are judged
 * server-side for that reason; this is only what the autocomplete needs.
 */
export function pickerEntries(roster: BrawldleBrawler[]): PickerEntry[] {
  return roster.map((b) => ({ id: b.id, name: b.name, slug: b.slug, imageUrl: b.imageUrl }));
}
