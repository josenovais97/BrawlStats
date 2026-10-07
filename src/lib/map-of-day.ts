import { getGameModeMap, getMapMap } from '@/lib/brawlapi';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { getActiveMaps } from '@/lib/game-maps';
import { slugify } from '@/lib/slugs';
import { RANKED_MAP_WINDOW_DAYS, getRankedMapPicks } from '@/lib/stats';
import type { RankedMapPicks } from '@/types/stats';

/**
 * One Ranked map a day, with its ten best brawlers.
 *
 * Replaced the daily tier-list carousel on 2026-10-07. A roster-wide tier list
 * barely moves from one day to the next, so posting it daily meant posting the
 * same list most days -- and the findings and hidden-meta carousels already
 * cover "who is strong overall". "What do I pick on *this* map" is a different
 * question, it is the one players have in the draft, and a rotation through the
 * pool gives every day a different answer.
 *
 * The ranking is exactly what `/maps/[mode]/[map]` serves: `getRankedMapPicks`
 * with the page's own window and count. A post whose top ten disagrees with the
 * page it advertises makes the site look wrong to the one person who checks.
 */

/** Brawlers per post. The map page shows the same ten. */
export const MAP_POST_PICKS = 10;

/**
 * Which maps are worth a post.
 *
 * A full ten, and a map sampled well enough that its own record carries weight
 * rather than the prior. A thin map's top ten is mostly each brawler's overall
 * form restated, which is a tier list with a map's name on it -- the thing this
 * post replaced.
 */
function postable(row: RankedMapPicks): boolean {
  return row.picks.length >= MAP_POST_PICKS && row.confidence !== 'low';
}

/**
 * The order the pool is posted in: modes interleaved, so tomorrow is never the
 * same mode as today while another mode is still waiting.
 *
 * Built from the pool alone, never from history, so the post for any date can
 * be re-derived from that date and the current pool -- the manifest and each
 * slide image are separate requests and have to land on the same map without
 * sharing state. The cost is that a season change, which changes the pool,
 * re-deals the sequence; a map can then come up again sooner than a full
 * cycle. That is a fair price for a rotation nothing has to remember.
 *
 * Greedy: at each step, the mode with the most maps still to place, other than
 * the one just placed. Ties go alphabetically so the order is stable.
 */
export function rotation(pool: RankedMapPicks[]): RankedMapPicks[] {
  const byMode = new Map<string, RankedMapPicks[]>();
  for (const row of [...pool].sort((a, b) => a.mapName.localeCompare(b.mapName))) {
    const list = byMode.get(row.mode) ?? [];
    list.push(row);
    byMode.set(row.mode, list);
  }

  const out: RankedMapPicks[] = [];
  let last: string | null = null;
  while (out.length < pool.length) {
    const modes = [...byMode.entries()]
      .filter(([, maps]) => maps.length > 0)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    const next = modes.find(([mode]) => mode !== last) ?? modes[0];
    out.push(next[1].shift() as RankedMapPicks);
    last = next[0];
  }
  return out;
}

/** Whole days since the Unix epoch, for a YYYY-MM-DD date. */
export function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

export interface MapPostEntry {
  brawlerId: number;
  name: string;
  imageUrl: string | null;
  rarityColor: string | null;
  /** Baseline-adjusted, shrunk win rate on this map: what the list is sorted by. */
  score: number;
  /** How far this map moves the brawler from its usual Ranked form. */
  edge: number;
  /** Decided Ranked battles on this map. */
  battles: number;
}

export interface MapPost {
  date: string;
  /** The mode id our samples use, e.g. "gemGrab". */
  mode: string;
  modeName: string;
  /** The mode's own colour, from the artwork source. */
  modeColor: string;
  modeIconUrl: string | null;
  mapName: string;
  mapArtUrl: string | null;
  /** `/maps/<mode>/<map>`, when the map is in the catalogue. */
  mapPath: string | null;
  picks: MapPostEntry[];
  /** Decided Ranked battles on this map in the window. */
  sampleSize: number;
  windowDays: number;
  /** Where today sits in the rotation, for "map 4 of 26". */
  position: number;
  poolSize: number;
}

export async function mapOfDay(date: string): Promise<MapPost | null> {
  const [rows, modes, mapsById, catalogue, catalog] = await Promise.all([
    getRankedMapPicks(MAP_POST_PICKS, RANKED_MAP_WINDOW_DAYS).catch(() => []),
    getGameModeMap().catch(() => new Map()),
    getMapMap().catch(() => new Map()),
    getActiveMaps().catch(() => []),
    getBrawlerCatalog().catch(() => null),
  ]);

  // An empty pool is a quiet day, not a failure: the job reads a zero-slide
  // manifest as "nothing to post", the same as every other carousel.
  const order = rotation(rows.filter(postable));
  if (order.length === 0) return null;

  const index = ((dayNumber(date) % order.length) + order.length) % order.length;
  const row = order[index];

  const mode = modes.get(row.mode.toLowerCase());
  const listed = catalogue.find(
    (m) => m.scHash === row.mode && m.mapSlug === slugify(row.mapName),
  );
  // Art by event id first: that is how `/ranked` finds it, and it covers maps
  // whose catalogue name is spelled differently from the battle log's.
  const art = (row.eventId ? mapsById.get(row.eventId) : undefined) ?? listed?.map;

  return {
    date,
    mode: row.mode,
    modeName: mode?.name ?? row.mode,
    modeColor: mode?.color ?? '#35d0ff',
    modeIconUrl: mode?.imageUrl ?? null,
    mapName: row.mapName,
    mapArtUrl: art?.imageUrl ?? null,
    mapPath: listed ? `/maps/${listed.modeSlug}/${listed.mapSlug}` : null,
    picks: row.picks.slice(0, MAP_POST_PICKS).map((p) => ({
      brawlerId: p.brawlerId,
      name: p.brawlerName,
      imageUrl: catalog?.byId.get(p.brawlerId)?.imageUrl ?? null,
      rarityColor: catalog?.byId.get(p.brawlerId)?.rarityColor ?? null,
      score: p.score,
      edge: p.score - p.overallScore,
      battles: p.decidedSampleSize,
    })),
    sampleSize: row.sampleSize,
    windowDays: RANKED_MAP_WINDOW_DAYS,
    position: index + 1,
    poolSize: order.length,
  };
}
