/** Aggregated tier-list data, mirrored from the `brawler_stats` table. */

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

export interface BrawlerStatRow {
  brawlerId: number;
  brawlerName: string;
  /** ISO date (no time) of the snapshot this row belongs to. */
  snapshotDate: string;
  winRate: number | null;
  /** Mean win rate across the whole sample, used to cancel out cohort bias. */
  baselineWinRate: number | null;
  usageRate: number | null;
  avgTrophies: number | null;
  avgRank: number | null;
  /** Battles counted toward usage, including showdown placements. */
  sampleSize: number;
  /**
   * Competitive battles that reported a win or loss: the denominator behind
   * winRate. Smaller than `sampleSize`, which counts ladder play too.
   */
  decidedSampleSize: number;
  ownerSampleSize: number;
  windowDays: number;
}

export interface TierListEntry extends BrawlerStatRow {
  tier: Tier;
  /** winRate re-centred on the sample baseline, i.e. what a 50%-mean would be. */
  normalizedWinRate: number | null;
  /** Artwork, joined in from brawlapi. Absent if the brawler is unknown there. */
  imageUrl?: string;
  rarityName?: string;
  rarityColor?: string;
  className?: string;
}

export interface TierListSnapshot {
  snapshotDate: string;
  entries: TierListEntry[];
  totalBattles: number;
  /** True when no aggregation has run yet, so the UI can explain the emptiness. */
  isEmpty: boolean;
}

/** A brawler whose aggregated numbers moved between two snapshots. */
export interface MetaMover {
  brawlerId: number;
  brawlerName: string;
  /** Baseline-adjusted win rates, so cohort skill drift does not show up here. */
  winRateNow: number;
  winRateBefore: number;
  winRateDelta: number;
  usageNow: number | null;
  usageBefore: number | null;
  usageDelta: number | null;
  sampleSize: number;
  fromDate: string;
  toDate: string;
}

/** One detected difference between two brawler-catalogue snapshots. */
export interface CatalogChangeEntry {
  id: number;
  detectedOn: string;
  kind: string;
  brawlerId: number;
  brawlerName: string;
  itemId: number | null;
  itemName: string | null;
}

/** A player's position on a single brawler's global leaderboard (top 200). */
export interface BrawlerPlacement {
  brawlerId: number;
  brawlerName: string;
  rank: number;
  trophies: number;
  region: string;
}

export interface BuildOption {
  itemId: number;
  /**
   * 0–1 share of all unlocks of this kind for this brawler. Options of the
   * same kind sum to 1, so they can be compared directly.
   */
  share: number;
  /** 0–1 share of every sampled owner of the brawler. Context, not comparison. */
  unlockRate: number;
  owners: number;
}

/** Ability-ownership rates for one brawler. */
export interface BrawlerBuild {
  brawlerId: number;
  /** Sampled players who own this brawler. */
  sampleSize: number;
  starPowers: BuildOption[];
  gadgets: BuildOption[];
  gears: BuildOption[];
}

/** Where a trophy count sits within the sampled population. */
export interface TrophyStanding {
  /** 0–1 fraction of sampled players with fewer trophies. */
  percentile: number;
  population: number;
}

export interface AggregationRunSummary {
  startedAt: string;
  finishedAt: string | null;
  playersSampled: number;
  battlesRecorded: number;
  brawlersUpdated: number;
  status: string;
  notes: string | null;
}

/** One player's trophy movement between two consecutive daily snapshots. */
export interface TrophyGain {
  tag: string;
  name: string | null;
  /** Trophies on the newer snapshot. */
  trophies: number;
  /** Newer minus older. Always positive in the published list. */
  gain: number;
  /** ISO dates of the two snapshots being compared. */
  from: string;
  to: string;
  /** Days between them. Spans vary because sampling rotates through the pool. */
  days: number;
}

/** A brawler's record inside a single game mode. */
export interface ModePick {
  brawlerId: number;
  brawlerName: string;
  /** Baseline-adjusted, shrunk win rate. Comparable across modes. */
  score: number;
  /** Raw win rate within this mode. */
  winRate: number;
  /** Share of this mode's sampled battles. */
  pickRate: number;
  decidedSampleSize: number;
}

/** Best picks for one mode, plus the evidence behind them. */
export interface ModeBestPicks {
  mode: string;
  picks: ModePick[];
  /** Decided battles sampled in this mode, across all brawlers. */
  sampleSize: number;
  baselineWinRate: number;
}
