import { slugify } from '@/lib/slugs';

/**
 * The URL scheme for the draft helper.
 *
 *   /draft                                      nothing picked yet
 *   /draft/gem-grab/hard-rock-mine              map picked
 *   /draft/gem-grab/hard-rock-mine/3-12         map picked, enemies named
 *   /draft/gem-grab/hard-rock-mine/3-12/45      enemies and allies
 *   /draft/gem-grab/hard-rock-mine/x/45         allies only, no enemy known yet
 *
 * A Ranked draft alternates picks, so "I know one of theirs and one of ours"
 * and "I know one of ours and none of theirs" are both real states and both
 * need spelling. `x` is the empty marker rather than an empty segment, because
 * a path cannot carry `//`, and rather than `0`, because Shelly's short id
 * *is* zero.
 *
 * The page already described itself this way — "every state is its own URL, so
 * a draft can be shared or kept open on a second screen" — it just spelled
 * those URLs with `?map=&mode=&enemy=`, and a server component that reads
 * `searchParams` cannot be cached at all. In the path, each state is a page
 * that renders once and is served from cache to everyone who opens it after.
 *
 * Enemies only exist alongside a map, which matches the interface: the enemy
 * step does not appear until a map is chosen, so there is no reachable state
 * this cannot spell.
 */

/** Ids are written relative to this, which every brawler id starts from. */
const ID_BASE = 16_000_000;

/** How many enemy picks a Ranked draft can have. */
export const MAX_ENEMIES = 3;

export interface DraftRoute {
  modeSlug?: string;
  mapSlug?: string;
  enemies: number[];
  allies: number[];
}

/** Spelled in a path segment when a side has nobody named yet. */
const EMPTY_SIDE = 'x';

function encodeSide(ids: number[]): string {
  return ids.length > 0 ? ids.map((id) => id - ID_BASE).join('-') : EMPTY_SIDE;
}

function decodeSide(raw: string | undefined): number[] {
  if (!raw || raw === EMPTY_SIDE) return [];
  return raw
    .split('-')
    .filter(Boolean)
    .map((value) => ID_BASE + Number(value))
    /*
     * `>=`, not `>`. Shelly is brawler 16000000, so her short id is 0 and
     * `ID_BASE + 0` is exactly ID_BASE — a strict comparison dropped her from
     * every draft silently, which is the worst way for the most-owned brawler
     * in the game to be missing.
     */
    .filter((id) => Number.isFinite(id) && id >= ID_BASE)
    .slice(0, MAX_ENEMIES);
}

export function draftHref({
  mode,
  map,
  enemies = [],
  allies = [],
}: {
  mode?: string;
  map?: string;
  enemies?: number[];
  allies?: number[];
}): string {
  if (!mode || !map) return '/draft';

  const segments = ['draft', slugify(mode), slugify(map)];
  // Trailing empties are omitted, so the common states keep the short URLs
  // they had before allies existed and old links stay canonical.
  if (allies.length > 0) segments.push(encodeSide(enemies), encodeSide(allies));
  else if (enemies.length > 0) segments.push(encodeSide(enemies));

  return `/${segments.join('/')}`;
}

/**
 * Reads the draft state out of the path.
 *
 * Ids are validated only for shape here; whether a brawler exists is settled
 * against the real catalogue by the page, the same as before.
 *
 * Returns null rather than calling `notFound()` so this stays a pure function
 * of its argument: importing `next/navigation` pulls React client context in
 * with it, which cannot load outside a request and made the whole module
 * untestable. The page turns a null into a 404 — a segment that is not a state
 * this tool has must not silently drop to the empty board, which would make a
 * mistyped link look like it worked.
 */
export function resolveDraftRoute(state: string[] | undefined): DraftRoute | null {
  const segments = state ?? [];

  if (segments.length === 0) return { enemies: [], allies: [] };
  if (segments.length === 1 || segments.length > 4) return null;

  const [modeSlug, mapSlug, rawEnemies, rawAllies] = segments;

  const enemies = decodeSide(rawEnemies);
  const allies = decodeSide(rawAllies);

  /*
   * A side segment that parsed to nothing is a typo, not an empty side —
   * `x` is how an empty side is spelled, and it decodes without complaint.
   */
  if (rawEnemies !== undefined && rawEnemies !== EMPTY_SIDE && enemies.length === 0) return null;
  if (rawAllies !== undefined && rawAllies !== EMPTY_SIDE && allies.length === 0) return null;
  // `/x` alone says "no enemies" on a URL that already means that.
  if (rawEnemies === EMPTY_SIDE && rawAllies === undefined) return null;

  return { modeSlug: slugify(modeSlug), mapSlug: slugify(mapSlug), enemies, allies };
}
