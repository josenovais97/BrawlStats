/**
 * Tier presentation constants.
 *
 * Split out of `lib/stats.ts` because that module is `server-only` and these
 * are needed by client components — the player's brawler grid renders a tier
 * chip per tile. Nothing here touches the database, so there is no reason for
 * it to be server-bound.
 */

import type { Tier } from '@/types/stats';

export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];

/**
 * E and F continue the ramp rather than introducing a new hue.
 *
 * The scale runs warm at the top and cool at the bottom, so the two new tiers
 * carry on into deeper blues. F is deliberately the most muted colour on the
 * board: it is the one tier that says "do not pick this", and a loud colour
 * would give the worst brawlers the most visual weight on the page.
 */
export const TIER_COLOR: Record<Tier, string> = {
  S: '#ff5c72',
  A: '#ff9f45',
  B: '#ffc53d',
  C: '#7ad97a',
  D: '#7fb3ff',
  E: '#6a86c4',
  F: '#6b7594',
};
