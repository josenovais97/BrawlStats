import { getGameModeIdMap, getMaps } from '@/lib/brawlapi';
import { slugify } from '@/lib/slugs';
import type { BAGameMode, BAMap } from '@/types/brawlapi';

/**
 * The map catalogue, resolved into something routable.
 *
 * brawlapi lists every map ever published — around 1,200, five sixths of them
 * flagged `disabled`. The ~400 that are not are the *catalogue of maps still in
 * the game*, which is emphatically not the same as "in rotation": every one of
 * them reports `lastActive: 0`, so the field cannot tell them apart either.
 * Calling all 400 "currently in rotation" was simply wrong, and the pages that
 * say so now say what this list actually is.
 *
 * What genuinely *is* in rotation comes from two other sources, and the maps
 * index labels them separately: the official event rotation (live right now)
 * and the wiki's published Ranked pool (this season's competitive maps).
 *
 * A map's mode is joined by numeric id rather than by name. The `gameMode`
 * object hanging off a map is a partial one and does not carry `scHash`, which
 * is the string our own battle samples are keyed on — so without the join
 * there is no way to ask "how did brawlers do on this map".
 */
export interface GameMap {
  map: BAMap;
  mode: BAGameMode | undefined;
  /** URL segment for the mode, e.g. "gem-grab". */
  modeSlug: string;
  /** URL segment for the map, e.g. "hard-rock-mine". */
  mapSlug: string;
  /**
   * The mode id our own battle samples use, e.g. "gemGrab". Undefined when the
   * mode could not be joined, which leaves the map page to its artwork.
   */
  scHash: string | undefined;
  /**
   * True for a map brawlapi flags `disabled` — retired from the game rather
   * than merely out of this week's rotation.
   *
   * Never true for anything `getActiveMaps` returns; only `resolveMap` can
   * produce one, and only when the URL asks for it by name.
   */
  retired: boolean;
}

/**
 * The map catalogue, optionally including maps retired from the game.
 *
 * Retired maps are excluded by default and that is right for every *listing*:
 * the index, the mode pages and the sitemap should offer maps you can go and
 * play. It was wrong for the *route*, which is a different question — see
 * `resolveMap`.
 */
async function buildCatalogue(includeRetired: boolean): Promise<GameMap[]> {
  const [maps, modes] = await Promise.all([
    getMaps().catch(() => [] as BAMap[]),
    getGameModeIdMap().catch(() => new Map<number, BAGameMode>()),
  ]);

  const seen = new Set<string>();

  return maps
    .filter((map) => includeRetired || !map.disabled)
    // Live maps first, so that when a slug exists in both states the dedup
    // below keeps the playable one and `retired` is never set on a map you
    // could still queue into.
    .sort((a, b) => Number(Boolean(a.disabled)) - Number(Boolean(b.disabled)))
    .map((map) => {
      const mode = map.gameMode.id ? modes.get(map.gameMode.id) : undefined;
      return {
        map,
        mode,
        modeSlug: slugify(mode?.name ?? map.gameMode.name),
        mapSlug: slugify(map.name),
        scHash: mode?.scHash,
        retired: Boolean(map.disabled),
      };
    })
    /*
     * One entry per map, keyed on what the URL is built from.
     *
     * The source publishes the same map more than once — "Skull Creek" appears
     * twice under Trio Showdown with different numeric ids — and two records
     * that resolve to the same route would render the same page twice in the
     * index and emit a duplicate sitemap URL. The first wins; they are the same
     * map either way.
     */
    .filter((entry) => {
      const key = `${entry.modeSlug}/${entry.mapSlug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.map.name.localeCompare(b.map.name));
}

export async function getActiveMaps(): Promise<GameMap[]> {
  return buildCatalogue(false);
}

/**
 * Resolves a `/maps/[mode]/[map]` pair, retired maps included.
 *
 * Both halves are matched, not just the map: map names repeat across modes
 * (there is a "Double Trouble" in three of them), which is the whole reason
 * the mode is in the path.
 *
 * Retired maps resolve on purpose. This used to consult the live catalogue
 * only, so the day Supercell disabled a map its page began returning 404 — and
 * these are the most-indexed pages on the site, one per map, each ranking for
 * "<map> best brawlers". Every rotation therefore converted accumulated search
 * ranking into dead URLs, which Search Console duly reported.
 *
 * A retired map is not a URL that names nothing: people still search it, the
 * layout and the wiki notes still describe it, and the mode's own picks still
 * answer the question the page exists to answer. So the page keeps working and
 * says the map has been retired. A genuinely unknown slug still 404s, which is
 * the case a 404 is actually for.
 *
 * Listings are unaffected — they call `getActiveMaps`, so the index and the
 * sitemap continue to offer only maps you can go and play.
 */
export async function resolveMap(
  modeSlug: string,
  mapSlug: string,
): Promise<GameMap | undefined> {
  const wantedMode = slugify(modeSlug);
  const wantedMap = slugify(mapSlug);
  const matches = (entry: GameMap) =>
    entry.modeSlug === wantedMode && entry.mapSlug === wantedMap;

  // Live catalogue first: it is the common case and the smaller list.
  const active = await buildCatalogue(false);
  return active.find(matches) ?? (await buildCatalogue(true)).find(matches);
}

/** Active maps grouped by mode, in rotation-size order. */
export function groupByMode(maps: GameMap[]): { mode: string; label: string; maps: GameMap[] }[] {
  const groups = new Map<string, { mode: string; label: string; maps: GameMap[] }>();

  for (const entry of maps) {
    const key = entry.modeSlug;
    const group = groups.get(key) ?? {
      mode: key,
      label: entry.mode?.name ?? entry.map.gameMode.name,
      maps: [],
    };
    group.maps.push(entry);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => b.maps.length - a.maps.length);
}
