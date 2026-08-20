import 'server-only';

import { cache } from 'react';

import { brawlerIconUrl, getBrawlerMap } from '@/lib/brawlapi';
import {
  MIN_SAMPLE_FOR_TIER,
  assignTierFromScore,
  getLatestBrawlerStats,
  getMetaIndex,
  metaScore,
  normalizeWinRate,
} from '@/lib/stats';
import { TIER_ORDER } from '@/lib/tiers';
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

/**
 * Brawlers the two tier lists disagree about most.
 *
 * This is the site's one genuinely uncopyable fact. Ranked and the trophy
 * ladder are different games — one drafts and bans between comparable
 * opponents, the other does not — and BrawlZone scores them from two separate
 * halves of its own sample. Every competitor publishes a single list, because
 * a single list is all you can build from a source that does not split.
 *
 * So the disagreement is the product, stated as data rather than as a claim.
 * A brawler that is S in Ranked and C on ladder is a fact about the game that
 * one list structurally cannot show you.
 *
 * Only brawlers rated in both lists count: an unrated tier is missing
 * evidence, not a disagreement, and reading it as one would manufacture the
 * very gap this is meant to reveal.
 */
export interface MetaSplit {
  brawlerId: number;
  name: string;
  imageUrl: string;
  ranked: { tier: Tier; score: number };
  trophy: { tier: Tier; score: number };
  /** Positions apart on the S-D scale. Always at least 1. */
  gap: number;
  /** Which list rates it higher. */
  favours: 'ranked' | 'trophy';
}

export const getMetaSplit = cache(async (limit = 3): Promise<MetaSplit[]> => {
  const [ranked, trophy, brawlerMeta] = await Promise.all([
    getMetaIndex('ranked', 7),
    getMetaIndex('trophy', 7),
    getBrawlerMap().catch(() => new Map()),
  ]);

  const rank = (tier: Tier) => TIER_ORDER.indexOf(tier);
  const out: MetaSplit[] = [];

  for (const [brawlerId, r] of ranked) {
    const t = trophy.get(brawlerId);
    if (!r.tier || !t?.tier || r.metaScore === null || t.metaScore === null) continue;

    const gap = Math.abs(rank(r.tier) - rank(t.tier));
    if (gap < 1) continue;

    const meta = brawlerMeta.get(brawlerId);
    out.push({
      brawlerId,
      name: r.brawlerName,
      imageUrl: meta?.imageUrl ?? brawlerIconUrl(brawlerId),
      ranked: { tier: r.tier, score: r.metaScore },
      trophy: { tier: t.tier, score: t.metaScore },
      gap,
      // A lower index is a better tier, so the smaller rank wins.
      favours: rank(r.tier) < rank(t.tier) ? 'ranked' : 'trophy',
    });
  }

  return out
    // Biggest disagreement first, then the better-sampled of equal gaps.
    .sort((a, b) => b.gap - a.gap || b.ranked.score - a.ranked.score)
    .slice(0, limit);
});
