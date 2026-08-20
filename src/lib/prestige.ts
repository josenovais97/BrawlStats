/**
 * Which prestige badge an account has earned.
 *
 * `totalPrestigeLevel` is the sum across every brawler, so it runs into the
 * hundreds — it is not a 0–6 rank. The game awards a new badge at each
 * milestone and a total almost always sits *between* two of them, so the badge
 * to show is the highest milestone reached rather than the number itself.
 *
 * Descending order is what makes that work: the first threshold at or below
 * the total is the one earned.
 */
export const PRESTIGE_TIERS = [200, 100, 50, 25, 1] as const;

export type PrestigeTier = (typeof PRESTIGE_TIERS)[number];

/**
 * The milestone badge for a total, or null when there is nothing to show.
 *
 * Null rather than the lowest badge below 1: the API reports 0 for an account
 * that has never prestiged, and awarding it the first badge would be inventing
 * a milestone it has not reached.
 */
export function prestigeTier(total: number | undefined | null): PrestigeTier | null {
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 1) return null;
  return PRESTIGE_TIERS.find((tier) => total >= tier) ?? null;
}
