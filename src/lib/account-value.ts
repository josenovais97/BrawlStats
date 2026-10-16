import type { AccountValueDistribution } from '@/lib/stats';

/**
 * Where an account's coin value sits among the players we sample, 0..1.
 *
 * The distribution is 101 cut points; this interpolates between the two that
 * bracket the value, so 1,650,000 coins between the 50th (1.60M) and 51st
 * (1.66M) percentile reads as about 50.8%, not a step. Values beyond either
 * end clamp to 0 and 1.
 */
export function valuePercentile(coins: number, dist: AccountValueDistribution): number {
  const { cuts } = dist;
  if (cuts.length < 2) return 0;
  if (coins <= cuts[0]) return 0;
  if (coins >= cuts[cuts.length - 1]) return 1;
  let lo = 0;
  let hi = cuts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cuts[mid] <= coins) lo = mid;
    else hi = mid;
  }
  const span = cuts[hi] - cuts[lo];
  const within = span > 0 ? (coins - cuts[lo]) / span : 0;
  return (lo + within) / (cuts.length - 1);
}

/**
 * "Top 3%" rather than "better than 97%" from the 90th percentile up, where
 * the small number is the one people repeat; "more than 62% of players" below.
 */
export function standingLabel(p: number): { top: boolean; value: number } {
  if (p >= 0.9) return { top: true, value: Math.max(1, Math.round((1 - p) * 100)) };
  return { top: false, value: Math.round(p * 100) };
}
