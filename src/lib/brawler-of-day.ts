import { getOfficialBrawlers } from '@/lib/bs-api';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import {
  type BrawlerAbilityChoices,
  getBrawlerAbilityChoices,
  getBrawlerBuild,
} from '@/lib/stats';
import type { BrawlerBuild } from '@/types/stats';
import type { BSAccessory } from '@/types/brawlstars';

/**
 * One brawler per day, and which one is a function of the date.
 *
 * The rotation is `days since epoch % roster size`, which means every brawler
 * gets a turn before any gets a second one -- about a 108-day cycle. A random
 * pick would have repeated inside a fortnight by the birthday problem, and a
 * post that repeats a brawler people saw last week is a post that reads as
 * automated.
 *
 * Deterministic from the date and nothing else, because two separate routes
 * have to agree on the answer: the manifest the posting job reads and the
 * image route that renders it. Anything stateful here -- a counter, a "last
 * posted" row -- would be a second source of truth for the same question.
 */

/**
 * How far to walk when the day's brawler has nothing worth posting.
 *
 * A long-established brawler has almost no first-buyers left, because nearly
 * every owner has bought both options -- so its split is a handful of holdouts
 * and the page says so rather than showing it. Those make a bad post, so the
 * rotation steps past them. Bounded because each step is a database read, and
 * an unbounded search on a day when the sampler has not run would walk the
 * entire roster.
 */
const MAX_WALK = 14;

export interface BrawlerOfDay {
  brawlerId: number;
  name: string;
  slug: string;
  /** The catalogue's portrait, which is documented to actually resolve. */
  imageUrl: string;
  choices: BrawlerAbilityChoices;
  build: BrawlerBuild | null;
  starPowerNames: Map<number, string>;
  gadgetNames: Map<number, string>;
  gearNames: Map<number, string>;
}

/** The catalog is keyed slug -> brawler; this asks the question the other way. */
function slugOf(catalog: { bySlug: Map<string, { id: number }> }, id: number): string {
  for (const [slug, entry] of catalog.bySlug) {
    if (entry.id === id) return slug;
  }
  return String(id);
}

/** Whole days since the epoch, from a YYYY-MM-DD string. */
function dayIndex(date: string): number {
  const ms = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : 0;
}

/**
 * Whether this brawler's split is worth a post.
 *
 * `low` confidence means the people who own exactly one option are a small,
 * self-selected group -- indicative at best, and not something to put a win
 * rate on in a post that cannot carry the caveat the page does. Two options
 * are needed for there to be a choice at all.
 */
function worthPosting(choices: BrawlerAbilityChoices | null): choices is BrawlerAbilityChoices {
  if (!choices) return false;
  if (choices.confidence === 'low') return false;
  return choices.starPowers.length > 1 || choices.gadgets.length > 1;
}

export async function brawlerOfDay(date: string): Promise<BrawlerOfDay | null> {
  const catalog = await getBrawlerCatalog().catch(() => null);
  if (!catalog || catalog.current.length === 0) return null;

  // Sorted by id so the rotation is stable: ordering by name would reshuffle
  // the whole cycle the first time the mirror renames anything.
  const roster = [...catalog.current].sort((a, b) => a.id - b.id);
  const start = dayIndex(date) % roster.length;

  for (let step = 0; step < Math.min(MAX_WALK, roster.length); step += 1) {
    const entry = roster[(start + step) % roster.length];
    const choices = await getBrawlerAbilityChoices(entry.id).catch(() => null);
    if (!worthPosting(choices)) continue;

    const [build, official] = await Promise.all([
      getBrawlerBuild(entry.id).catch(() => null),
      getOfficialBrawlers()
        .then((r) => r.items.find((b) => b.id === entry.id))
        .catch(() => undefined),
    ]);

    const names = (items: BSAccessory[] | undefined) =>
      new Map((items ?? []).map((i) => [i.id, i.name]));

    return {
      brawlerId: entry.id,
      name: entry.name,
      slug: slugOf(catalog, entry.id),
      imageUrl: entry.imageUrl,
      choices,
      build,
      starPowerNames: names(official?.starPowers),
      gadgetNames: names(official?.gadgets),
      gearNames: names(official?.gears),
    };
  }

  return null;
}
