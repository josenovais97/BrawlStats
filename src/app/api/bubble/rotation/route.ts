import { createHash } from 'node:crypto';

import { getGameModeMap, modeLabel } from '@/lib/brawlapi';
import { titleCaseLabel } from '@/lib/format';
import { getRankedMapPicks } from '@/lib/stats';
import type { BAGameMode } from '@/types/brawlapi';

/**
 * The live Ranked rotation and its best picks, for the app to poll.
 *
 * **The same bytes for every device, by construction.** Nothing here is keyed
 * on a player: the app holds its own roster and works out which of these picks
 * it can field *on the phone*. That is the whole design. A personalised
 * endpoint would put an uncached upstream player fetch behind a background job
 * running on every install, which is the read pattern this project has been
 * burned by twice — and a notification nobody asked to be woken for is the
 * worst possible thing to spend a free tier on.
 *
 * As written, one ISR entry serves every install. Ten users and ten thousand
 * cost the same.
 *
 * `revision` is what makes a poll cheap to act on. It changes only when the
 * set of live maps changes, so the app can compare one string and go back to
 * sleep — the rotation is the event, not the request.
 */

/*
 * An hour, against a two-hour data cache underneath (`READ_CACHE_SECONDS`).
 * Deliberately shorter than the thing it wraps rather than longer: the figure
 * that matters is how soon a *rotation change* can reach a phone, and a route
 * that revalidated more slowly than its own data would sit on an answer it
 * already had. See AGENTS.md trap 2 — the effective number is the shortest
 * cache inside the route, so this one cannot be read as a promise on its own.
 */
export const revalidate = 3600;

/** Enough that an account missing the top pick still has an answer. */
const PICKS_PER_MAP = 5;

export async function GET() {
  const [maps, modeMeta] = await Promise.all([
    getRankedMapPicks(PICKS_PER_MAP).catch(() => []),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
  ]);

  const rotation = maps.map((map) => ({
    mode: map.mode,
    modeLabel: modeLabel(modeMeta, map.mode),
    map: titleCaseLabel(map.mapName),
    picks: map.picks.slice(0, PICKS_PER_MAP).map((pick) => ({
      id: pick.brawlerId,
      name: titleCaseLabel(pick.brawlerName),
    })),
  }));

  /*
   * Over the map set only, never the picks.
   *
   * The picks drift every time the sampler adds battles, so hashing them would
   * change the revision several times a day and the app would announce a "new
   * rotation" that is the same maps in a slightly different order. What a
   * reader is being told about is which maps are live.
   */
  const revision = createHash('sha256')
    .update(rotation.map((r) => `${r.mode}/${r.map}`).join('|'))
    .digest('hex')
    .slice(0, 16);

  return Response.json({ revision, maps: rotation });
}
