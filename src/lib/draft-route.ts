import { notFound } from 'next/navigation';

import { slugify } from '@/lib/slugs';

/**
 * The URL scheme for the draft helper.
 *
 *   /draft                                     nothing picked yet
 *   /draft/gem-grab/hard-rock-mine             map picked
 *   /draft/gem-grab/hard-rock-mine/3-12-45     map picked, enemies named
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
}

export function draftHref({
  mode,
  map,
  enemies = [],
}: {
  mode?: string;
  map?: string;
  enemies?: number[];
}): string {
  if (!mode || !map) return '/draft';

  const segments = ['draft', slugify(mode), slugify(map)];
  if (enemies.length > 0) {
    segments.push(enemies.map((id) => id - ID_BASE).join('-'));
  }
  return `/${segments.join('/')}`;
}

/**
 * Reads the draft state out of the path.
 *
 * Ids are validated only for shape here; whether a brawler exists is settled
 * against the real catalogue by the page, the same as before. A segment that
 * is not a state this tool has 404s rather than silently dropping to the empty
 * board, which would make a mistyped link look like a working one.
 */
export function resolveDraftRoute(state: string[] | undefined): DraftRoute {
  const segments = state ?? [];

  if (segments.length === 0) return { enemies: [] };
  if (segments.length === 1 || segments.length > 3) notFound();

  const [modeSlug, mapSlug, rawEnemies] = segments;

  const enemies = (rawEnemies ?? '')
    .split('-')
    .filter(Boolean)
    .map((value) => ID_BASE + Number(value))
    .filter((id) => Number.isFinite(id) && id > ID_BASE)
    .slice(0, MAX_ENEMIES);

  // A third segment that parsed to nothing is a typo, not an empty enemy list.
  if (rawEnemies !== undefined && enemies.length === 0) notFound();

  return { modeSlug: slugify(modeSlug), mapSlug: slugify(mapSlug), enemies };
}
