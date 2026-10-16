import { TIER_ORDER } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

export interface Disagreement {
  id: number;
  mine: Tier;
  data: Tier;
  /** Rows apart, positive when the player rated it higher than the data. */
  gap: number;
}

export interface Agreement {
  /** Brawlers placed that the measured list also rates. */
  compared: number;
  /** 0..100: 100 per exact match, 67 one row off, 33 two off, 0 beyond. */
  score: number;
  /** The biggest disagreements first, at most `limit`. */
  biggest: Disagreement[];
}

const rank = (tier: Tier) => TIER_ORDER.indexOf(tier);

/**
 * How closely a hand-made tier list matches the measured Ranked tiers.
 *
 * Scored by distance rather than exact hits, so putting an S brawler in A is a
 * near miss rather than a miss. The disagreements are the part people argue
 * about, so they come back sorted by how far apart the two answers are.
 */
export function tierAgreement(
  placed: Record<number, Tier>,
  data: Map<number, Tier | null>,
  limit = 3,
): Agreement {
  let total = 0;
  let compared = 0;
  const all: Disagreement[] = [];
  for (const [key, mine] of Object.entries(placed)) {
    const id = Number(key);
    const measured = data.get(id);
    if (!measured) continue;
    compared += 1;
    const gap = rank(measured) - rank(mine);
    total += Math.max(0, 1 - Math.abs(gap) / 3);
    if (gap !== 0) all.push({ id, mine, data: measured, gap });
  }
  all.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || a.id - b.id);
  return { compared, score: compared ? Math.round((total / compared) * 100) : 0, biggest: all.slice(0, limit) };
}
