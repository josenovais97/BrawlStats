/**
 * Opening a drop, for the simulator on /starr-drops (2026-10-29).
 *
 * Pure and client-safe: the page reads the wiki on the server and hands the
 * opener these plain shapes, already translated, so the browser carries no
 * wiki code and no dictionary for reward names.
 */

export interface OpenerReward {
  /** Display name, already in the page's language. */
  name: string;
  iconUrl: string | null;
  /** Within its rarity, 0-1. */
  chance: number;
}

export interface OpenerDrop {
  slug: string;
  /** "Starr Drop", translated. */
  name: string;
  image: string;
  /** Tint the image per rarity (our own Starr Drop art); off for wiki art. */
  tint: boolean;
  /** Commonest first, as the wiki writes them. */
  odds: { rarity: string; label: string; chance: number }[];
  /** Keyed by rarity. A rarity with no table opens to its rarity alone. */
  tables: Record<string, OpenerReward[]>;
}

export interface Roll {
  /** Index into `odds`: how many times the drop upgrades. */
  level: number;
  reward: OpenerReward | null;
  /** The chance of exactly this, from an unopened drop. */
  chance: number;
}

/** One of `items` by weight, with `r` in [0, 1). Null when nothing has weight. */
export function pickWeighted<T>(items: T[], weight: (item: T) => number, r: number): T | null {
  const total = items.reduce((sum, item) => sum + Math.max(weight(item), 0), 0);
  if (total <= 0) return null;
  let left = r * total;
  for (const item of items) {
    left -= Math.max(weight(item), 0);
    if (left < 0) return item;
  }
  return items[items.length - 1];
}

/**
 * A rarity by the drop's odds, then a reward by that rarity's table. The
 * wiki's tables are sometimes a row short of 100%; picking by weight
 * normalises them, which is the honest reading of an incomplete table.
 */
export function rollDrop(drop: OpenerDrop, rand: () => number = Math.random): Roll {
  const odd = pickWeighted(drop.odds, (o) => o.chance, rand()) ?? drop.odds[0];
  const level = drop.odds.indexOf(odd);
  const table = drop.tables[odd.rarity] ?? [];
  const reward = pickWeighted(table, (r) => r.chance, rand());
  const listed = table.reduce((sum, r) => sum + r.chance, 0);
  return { level, reward, chance: odd.chance * (reward && listed > 0 ? reward.chance / listed : 1) };
}

/** Rarer rarity wins; at the same rarity, the less likely reward. */
export function isBetter(a: Roll, b: Roll | null): boolean {
  if (!b) return true;
  return a.level > b.level || (a.level === b.level && a.chance < b.chance);
}
