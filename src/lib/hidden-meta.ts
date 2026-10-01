import 'server-only';

import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import {
  RANKED_MAP_WINDOW_DAYS,
  type ScoredBrawler,
  getRankedMapPicks,
  getScoredRoster,
} from '@/lib/stats';
import type { Tier } from '@/types/stats';

/**
 * The four questions a tier list does not answer.
 *
 * A tier list answers "who is strong". These answer "who is strong that
 * nobody plays", "who does everybody play that is not strong", and the two
 * map-specific versions of the same idea. All four fall out of numbers the
 * site already computes -- the ranking carries a win rate and a pick rate per
 * brawler, and the map picks carry each brawler's map score beside its overall
 * form, which is precisely the gap a "hidden gem" is made of.
 *
 * Every threshold here is a PERCENTILE of the live distribution rather than a
 * fixed number. A hard cut like "usage under 1%" means something different in
 * a 60-brawler roster than in a 107-brawler one, and something different again
 * after a balance patch moves everybody. Percentiles keep the question stable
 * while the answers move, which is the behaviour this page needs: it should
 * still find the four most interesting brawlers on a quiet week, and it should
 * not find forty of them after a patch.
 */

/**
 * The floor, and why it is this high.
 *
 * Every list here is a selected extreme -- the highest score among the least
 * played, the widest map gap out of hundreds of map-brawler pairs -- and
 * selecting a maximum out of many small samples produces extremes by
 * construction rather than by merit. That is the same trap `/comps` documents
 * at length, where thousands of 25-battle samples made every top comp sit at a
 * flat 100%.
 *
 * 300 decided battles matches the floor `compute_getDailyDiscoveries` already
 * applies before it will announce anything, so the two features cannot
 * contradict each other about whether a brawler is worth mentioning.
 */
const MIN_SAMPLE = 300;

/** Map-brawler pairs are thinner than roster-wide rows, so they get their own. */
const MIN_MAP_SAMPLE = 60;

/**
 * How big a map gap has to be before it is worth a word.
 *
 * `score` here is a shrunk win rate, so an edge is in win-rate points: 0.03 is
 * three points better or worse on that map than the brawler manages anywhere
 * else. Below that it is a wobble, and calling it a trap would be inventing a
 * finding -- especially on the negative side, where shrinkage toward the prior
 * keeps edges small and the largest one on a quiet week is barely two points.
 *
 * The same 0.03 that `compute_getDailyDiscoveries` already requires before it
 * will announce a map surprise, so the two cannot disagree.
 */
const MIN_EDGE = 0.03;

/** How many entries each section shows. */
const SHOWN = 6;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * q)));
  return sorted[i];
}

export interface HiddenPick {
  brawlerId: number;
  brawlerName: string;
  imageUrl: string | null;
  rarityColor: string | null;
  tier: Tier | null;
  metaScore: number;
  winRate: number | null;
  usageRate: number | null;
  sampleSize: number;
}

export interface MapEdgePick extends HiddenPick {
  mapName: string;
  mode: string;
  /** The map score minus the brawler's overall form, in score points. */
  edge: number;
  mapScore: number;
  overallScore: number;
}

export interface HiddenMeta {
  /** Strong, and hardly anybody picks them. */
  sleepers: HiddenPick[];
  /** Everybody picks them, and the results do not justify it. */
  overrated: HiddenPick[];
  /** Far better on one map than their overall form suggests. */
  gems: MapEdgePick[];
  /** Fine overall, poor on a map that is in rotation right now. */
  traps: MapEdgePick[];
  /**
   * Every rated brawler, for the radar.
   *
   * The four lists above are six rows each, selected out of this. Shipping the
   * whole set is what lets the chart show the distribution they were chosen
   * from -- a sleeper three battles from the cut and one in a class of its own
   * are the same row in a list, and visibly different points on a plot.
   */
  points: HiddenPick[];
  /** What the percentiles resolved to today, so the page can show its working. */
  cuts: { lowUsage: number; highUsage: number; strong: number; weak: number };
  rated: number;
  windowDays: number;
}

export async function getHiddenMeta(windowDays = 7): Promise<HiddenMeta | null> {
  const [roster, mapPicks, catalog] = await Promise.all([
    getScoredRoster(windowDays, undefined, 'ranked').catch(() => [] as ScoredBrawler[]),
    getRankedMapPicks(8, RANKED_MAP_WINDOW_DAYS).catch(() => []),
    getBrawlerCatalog().catch(() => null),
  ]);

  const rated = roster.filter(
    (b) =>
      b.tier !== null &&
      b.metaScore !== null &&
      b.usageRate !== null &&
      b.decidedSampleSize >= MIN_SAMPLE,
  );
  if (rated.length < 12) return null;

  const usages = rated.map((b) => b.usageRate as number).sort((a, b) => a - b);
  const scores = rated.map((b) => b.metaScore as number).sort((a, b) => a - b);

  const cuts = {
    lowUsage: quantile(usages, 0.3),
    highUsage: quantile(usages, 0.75),
    strong: quantile(scores, 0.7),
    weak: quantile(scores, 0.4),
  };

  const dress = (b: ScoredBrawler): HiddenPick => ({
    brawlerId: b.brawlerId,
    brawlerName: b.brawlerName,
    imageUrl: catalog?.byId.get(b.brawlerId)?.imageUrl ?? null,
    rarityColor: catalog?.byId.get(b.brawlerId)?.rarityColor ?? null,
    tier: b.tier,
    metaScore: b.metaScore ?? 0,
    winRate: b.normalizedWinRate,
    usageRate: b.usageRate,
    sampleSize: b.decidedSampleSize,
  });

  const sleepers = rated
    .filter((b) => (b.usageRate as number) <= cuts.lowUsage && (b.metaScore as number) >= cuts.strong)
    .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
    .slice(0, SHOWN)
    .map(dress);

  const overrated = rated
    .filter((b) => (b.usageRate as number) >= cuts.highUsage && (b.metaScore as number) <= cuts.weak)
    .sort((a, b) => (b.usageRate ?? 0) - (a.usageRate ?? 0))
    .slice(0, SHOWN)
    .map(dress);

  /*
   * Map edges. `overallScore` is the brawler's form across every ranked
   * battle and `score` is its form on this map, so the difference is the
   * map-specific part of the claim with the brawler's general strength taken
   * out -- which is what stops this list being a second copy of the tier list.
   *
   * Only maps currently in rotation: a gem on a map nobody can queue is
   * trivia, and the point of the section is something to do tonight.
   */
  const edges: MapEdgePick[] = [];
  for (const map of mapPicks) {
    for (const pick of map.picks) {
      if (pick.decidedSampleSize < MIN_MAP_SAMPLE) continue;
      const overall = roster.find((b) => b.brawlerId === pick.brawlerId);
      edges.push({
        brawlerId: pick.brawlerId,
        brawlerName: pick.brawlerName,
        imageUrl: catalog?.byId.get(pick.brawlerId)?.imageUrl ?? null,
        rarityColor: catalog?.byId.get(pick.brawlerId)?.rarityColor ?? null,
        tier: overall?.tier ?? null,
        metaScore: overall?.metaScore ?? 0,
        winRate: pick.winRate,
        usageRate: pick.pickRate,
        sampleSize: pick.decidedSampleSize,
        mapName: map.mapName,
        mode: map.mode,
        edge: pick.score - pick.overallScore,
        mapScore: pick.score,
        overallScore: pick.overallScore,
      });
    }
  }

  // One entry per brawler in each direction. Without this a single brawler
  // that happens to suit four maps in the same mode fills the whole section
  // and the page says one thing four times.
  const firstPerBrawler = (list: MapEdgePick[]) => {
    const seen = new Set<number>();
    const out: MapEdgePick[] = [];
    for (const e of list) {
      if (seen.has(e.brawlerId)) continue;
      seen.add(e.brawlerId);
      out.push(e);
      if (out.length >= SHOWN) break;
    }
    return out;
  };

  const gems = firstPerBrawler(
    [...edges].sort((a, b) => b.edge - a.edge).filter((e) => e.edge >= MIN_EDGE),
  );
  const traps = firstPerBrawler(
    [...edges].sort((a, b) => a.edge - b.edge).filter((e) => e.edge <= -MIN_EDGE),
  );

  return {
    sleepers,
    overrated,
    gems,
    traps,
    points: rated.map(dress),
    cuts,
    rated: rated.length,
    windowDays,
  };
}
