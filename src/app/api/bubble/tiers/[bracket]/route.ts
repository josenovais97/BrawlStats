import type { NextRequest } from 'next/server';

import type { PanelEntry, PanelMapPick } from '@/components/bubble/panel-tiers';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { BrawlApiError } from '@/lib/errors';
import { bracketBySlug } from '@/lib/rank-brackets';
import { errorResponse, okResponse } from '@/lib/route-helpers';
import { getBracketMapPicks, getBracketRoster, getFilterableModes, type ScoredBrawler } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

/**
 * GET /api/bubble/tiers/mythic -- the panel's Meta lists for one bracket.
 *
 *   { bracket, lists: { all: { days, entries }, gemGrab: { days, entries }, ... },
 *     maps: { 'gemGrab|Hard Rock Mine': [picks], ... } }
 *
 * A mode missing from `lists` is too thin at this rank; the panel shows its
 * all-ranks list and says so. Fetched when a bracket is picked rather than
 * shipped with the page: four brackets times every mode would quadruple an
 * overlay opened on mobile data, and most players only ever want their own.
 *
 * Same scoring and fallbacks as the website's bracket pages (`getBracketRoster`).
 */

export const revalidate = 600;

function shape(scored: ScoredBrawler[], meta: Map<number, BABrawler>): PanelEntry[] {
  return scored
    .filter((e) => e.tier !== null)
    .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
    .map((e) => ({
      brawlerId: e.brawlerId,
      brawlerName: e.brawlerName,
      metaScore: e.metaScore,
      tier: e.tier!,
      imageUrl: meta.get(e.brawlerId)?.imageUrl ?? brawlerIconUrl(e.brawlerId),
    }));
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ bracket: string }> }) {
  try {
    const bracket = bracketBySlug((await params).bracket);
    if (!bracket) return errorResponse(new BrawlApiError('notFound', 'Not a rank bracket'));

    const [modes, meta] = await Promise.all([
      getFilterableModes(30, 150, 'ranked').catch(() => []),
      getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    ]);

    const lists: Record<string, { days: number; entries: PanelEntry[] }> = {};
    // One after another: each is a cached read, and the panel's page runs its
    // own reads the same way so neither needs more than one connection.
    for (const key of [undefined, ...modes.map((m) => m.mode)]) {
      const roster = await getBracketRoster(bracket.id, key).catch(() => null);
      if (roster) lists[key ?? 'all'] = { days: roster.days, entries: shape(roster.scored, meta) };
    }

    // Map picks at this rank: each map's all-ranks picks adjusted for the
    // rank, then pulled toward the rank's own battles there. Twenty deep, as
    // the page's all-ranks picks are.
    const maps: Record<string, PanelMapPick[]> = {};
    for (const map of await getBracketMapPicks(bracket.id, 20).catch(() => [])) {
      maps[`${map.mode}|${map.mapName}`] = map.picks.map((pick) => ({
        brawlerId: pick.brawlerId,
        brawlerName: pick.brawlerName,
        imageUrl: meta.get(pick.brawlerId)?.imageUrl ?? brawlerIconUrl(pick.brawlerId),
        score: pick.score,
        overallScore: pick.overallScore,
        battles: pick.decidedSampleSize,
        pickRate: pick.pickRate,
        allBattles: pick.allRanksSampleSize,
      }));
    }

    return okResponse({ bracket: bracket.slug, lists, maps }, 600);
  } catch (error) {
    return errorResponse(error);
  }
}
