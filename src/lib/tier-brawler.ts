/**
 * What the tier list's brawler panel shows (2026-11-10), as the
 * /api/tier-brawler/[id] route sends it. Types only, so the client panel can
 * import them.
 */

export interface TierBrawlerRef {
  id: number;
  name: string;
  icon: string;
  winRate: number;
  /** Points above (or below) this brawler's own win rate. */
  edge: number;
  games: number;
}

export interface TierBrawlerSlice {
  name: string;
  mode: string;
  modeName: string;
  modeIcon: string | null;
  image: string | null;
  winRate: number;
  /** Win rate re-centred on the slice's own average: 0.5 is average there. */
  score: number;
  games: number;
}

export interface TierBrawlerPart {
  name: string;
  icon: string;
  share: number;
}

export interface TierBrawlerDetail {
  id: number;
  name: string;
  art: string | null;
  icon: string;
  className: string | null;
  trend: { date: string; winRate: number | null; pickRate: number | null }[];
  modes: TierBrawlerSlice[];
  bestMaps: TierBrawlerSlice[];
  worstMaps: TierBrawlerSlice[];
  strong: TierBrawlerRef[];
  weak: TierBrawlerRef[];
  mates: TierBrawlerRef[];
  build: { starPower: TierBrawlerPart | null; gadget: TierBrawlerPart | null; gears: TierBrawlerPart[] };
}
