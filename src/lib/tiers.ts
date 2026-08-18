/**
 * Tier presentation constants.
 *
 * Split out of `lib/stats.ts` because that module is `server-only` and these
 * are needed by client components — the player's brawler grid renders a tier
 * chip per tile. Nothing here touches the database, so there is no reason for
 * it to be server-bound.
 */

import type { Tier } from '@/types/stats';

export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D'];

export const TIER_COLOR: Record<Tier, string> = {
  S: '#ff5c72',
  A: '#ff9f45',
  B: '#ffc53d',
  C: '#7ad97a',
  D: '#7fb3ff',
};
