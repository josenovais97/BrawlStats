import 'server-only';

import { cache } from 'react';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { getMetaIndex, type ScoredBrawler } from '@/lib/stats';
import { TIER_ORDER } from '@/lib/tiers';
import type { Tier } from '@/types/stats';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';

/**
 * The current top of the meta: the head of the Ranked tier list, unchanged.
 *
 * Not merely scored the same way — read from the same query. It used to score
 * the daily snapshot table itself, and the snapshot table is not split by
 * format: its rows mix Ranked battles with ladder ones. So a brawler that is
 * enormous on ladder and ordinary in Ranked rode the ladder half onto a podium
 * captioned "top 3 in Ranked", pushing out the brawler the Ranked list
 * actually had in third. That is the kind of disagreement a visitor finds by
 * clicking through to the list and seeing different names.
 *
 * Shared because the landing page shows this in four places — the hero podium,
 * the meta snapshot, the tier-list tool preview, and the roster module of the
 * product preview — and each one fetching for itself would be four copies of
 * the same ranking with four chances to disagree.
 *
 * `cache` here and on `getMetaIndex` makes it one aggregation per request no
 * matter how many callers there are, and the Ranked window is already being
 * computed for `getMetaSplit` further down the page.
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
    const [index, brawlerMeta] = await Promise.all([
      getMetaIndex('ranked', 7),
      getBrawlerArtMap().catch(() => new Map()),
    ]);

    return [...index.values()]
      /*
       * Rated only, and in the list's own order. `scoreBrawlers` leaves `tier`
       * null below the sample floor, which is the same line the tier list draws
       * between a brawler it has ranked and one it has merely seen.
       */
      .filter(isRated)
      .sort((a, b) => b.metaScore - a.metaScore)
      .slice(0, limit)
      .map((entry) => {
        const meta = brawlerMeta.get(entry.brawlerId);
        return {
          brawlerId: entry.brawlerId,
          name: entry.brawlerName,
          imageUrl: meta?.imageUrl ?? brawlerIconUrl(entry.brawlerId),
          portraitUrl:
            meta?.imageUrl2 ?? meta?.imageUrl ?? brawlerIconUrl(entry.brawlerId),
          tier: entry.tier,
          score: entry.metaScore,
          winRate: entry.normalizedWinRate,
          pickRate: entry.usageRate,
          sampleSize: entry.decidedSampleSize,
        };
      });
  },
);

/** Narrows to the entries that carry both a tier and a score. */
function isRated(
  entry: ScoredBrawler,
): entry is ScoredBrawler & { tier: Tier; metaScore: number } {
  return entry.tier !== null && entry.metaScore !== null;
}

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
    getBrawlerArtMap().catch(() => new Map()),
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
