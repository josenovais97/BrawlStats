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
}

export async function getActiveMaps(): Promise<GameMap[]> {
  const [maps, modes] = await Promise.all([
    getMaps().catch(() => [] as BAMap[]),
    getGameModeIdMap().catch(() => new Map<number, BAGameMode>()),
  ]);

  const seen = new Set<string>();

  return maps
    .filter((map) => !map.disabled)
    .map((map) => {
      const mode = map.gameMode.id ? modes.get(map.gameMode.id) : undefined;
      return {
        map,
        mode,
        modeSlug: slugify(mode?.name ?? map.gameMode.name),
        mapSlug: slugify(map.name),
        scHash: mode?.scHash,
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

/**
 * Resolves a `/maps/[mode]/[map]` pair.
 *
 * Both halves are matched, not just the map: map names repeat across modes
 * (there is a "Double Trouble" in three of them), which is the whole reason
 * the mode is in the path.
 */
export async function resolveMap(
  modeSlug: string,
  mapSlug: string,
): Promise<GameMap | undefined> {
  const all = await getActiveMaps();
  const wantedMode = slugify(modeSlug);
  const wantedMap = slugify(mapSlug);
  return all.find(
    (entry) => entry.modeSlug === wantedMode && entry.mapSlug === wantedMap,
  );
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
