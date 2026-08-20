import 'server-only';

import { cache } from 'react';

import { brawlerIconUrl, getBrawlerMap } from '@/lib/brawlapi';
import {
  MIN_SAMPLE_FOR_TIER,
  assignTierFromScore,
  getLatestBrawlerStats,
  metaScore,
  normalizeWinRate,
} from '@/lib/stats';
import type { Tier } from '@/types/stats';

/**
 * The current top of the meta, scored exactly as the tier list scores it.
 *
 * Shared because the landing page now shows this in three places — the meta
 * snapshot, the tier-list tool preview, and the roster module of the product
 * preview — and each one fetching for itself would be three copies of the same
 * ranking with three chances to disagree.
 *
 * `cache` makes it one query per request no matter how many callers there are,
 * so the extra sections cost nothing upstream.
 */
export interface TopMetaBrawler {
  brawlerId: number;
  name: string;
  imageUrl: string;
  /** Portrait without the rarity frame, for the featured slot. */
  portraitUrl: string;
  tier: Tier;
  /** Out of 10, the same number the tier lists rank by. */
  score: number;
  /** Adjusted win rate, 0-1. Null below the sample floor. */
  winRate: number | null;
  /** Pick rate, 0-1. Null when the aggregate has not computed one. */
  pickRate: number | null;
  sampleSize: number;
}

export const getTopMetaBrawlers = cache(
  async (limit = 5): Promise<TopMetaBrawler[]> => {
    const [rows, brawlerMeta] = await Promise.all([
      getLatestBrawlerStats(),
      getBrawlerMap().catch(() => new Map()),
    ]);

    return rows
      .filter((row) => row.decidedSampleSize >= MIN_SAMPLE_FOR_TIER)
      .map((row) => {
        const normalized = normalizeWinRate(
          row.winRate,
          row.baselineWinRate,
          row.decidedSampleSize,
        );
        return { row, normalized, score: metaScore(normalized, row.usageRate) };
      })
      .filter((entry): entry is typeof entry & { score: number } => entry.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ row, normalized, score }) => {
        const meta = brawlerMeta.get(row.brawlerId);
        return {
          brawlerId: row.brawlerId,
          name: row.brawlerName,
          imageUrl: meta?.imageUrl ?? brawlerIconUrl(row.brawlerId),
          portraitUrl: meta?.imageUrl2 ?? meta?.imageUrl ?? brawlerIconUrl(row.brawlerId),
          tier: assignTierFromScore(score) ?? 'D',
          score,
          winRate: normalized,
          pickRate: row.usageRate,
          sampleSize: row.decidedSampleSize,
        };
      });
  },
);
