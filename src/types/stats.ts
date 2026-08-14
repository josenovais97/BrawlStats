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
  /** Battles that reported a win or loss — the denominator behind winRate. */
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

export interface AggregationRunSummary {
  startedAt: string;
  finishedAt: string | null;
  playersSampled: number;
  battlesRecorded: number;
  brawlersUpdated: number;
  status: string;
  notes: string | null;
}
