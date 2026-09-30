import { getGameModeMap, modeLabel } from '@/lib/brawlapi';
import { getPlayer } from '@/lib/bs-api';
import { bubblePlan } from '@/lib/bubble-plan';
import { rosterCoverage, rosterPlan } from '@/lib/roster-optimizer';
import { getBestPicksByMode, getRankedMapPicks } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';
import type { BAGameMode } from '@/types/brawlapi';

/**
 * What to upgrade next, for the app's launcher screen.
 *
 * The same answer the profile page gives, from the same optimiser, for a reader
 * who has the app open and not a browser. It is the one thing the app can say
 * that the overlay cannot: the bubble answers "what do I pick in this draft",
 * and this answers "what do I spend coins on before the next one" — a question
 * that is asked between sessions, which is exactly when the app is in front of
 * somebody and the panel is not.
 *
 * **Separate from `/api/bubble/roster` on purpose.** That route is deliberately
 * thin because the *panel* refreshes it over mobile data mid-match, and folding
 * this in would push three cached aggregate reads and a payload nobody in a
 * draft wants onto that path. Two callers with two different appetites get two
 * routes.
 *
 * Cost is one uncached upstream player fetch plus cached reads shared with
 * every profile view, and the app calls it once per launch — which is far
 * rarer than a panel open. It is not a hot path, but it is not free either, so
 * it stays out of anything that renders per request.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const tag = normalizeTag(new URL(request.url).searchParams.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });

  let player;
  try {
    player = await getPlayer(tag);
  } catch {
    return Response.json({ error: 'lookup failed' }, { status: 404 });
  }

  /*
   * Exactly the inputs the profile's own plan uses. Any divergence here would
   * show up as the app and the site recommending different upgrades for the
   * same account, which is worse than either being wrong on its own.
   */
  const rankedMaps = await getRankedMapPicks(3).catch(() => []);
  const modes = [...new Set(rankedMaps.map((m) => m.mode))];
  const [picksByMode, modeMeta] = await Promise.all([
    getBestPicksByMode(15).catch(() => new Map()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
  ]);

  const payload = bubblePlan({
    plan: rosterPlan({
      brawlers: player.brawlers,
      picksByMode,
      modes,
      modeLabels: new Map(modes.map((mode) => [mode, modeLabel(modeMeta, mode)])),
    }),
    coverage: rosterCoverage({ brawlers: player.brawlers, picksByMode, modes }),
  });

  // Null is "we have nothing worth showing", not an error — the app hides the
  // card, which is the same thing it does when the request fails outright.
  if (!payload) return Response.json({ error: 'no rotation' }, { status: 503 });

  return Response.json(payload, { headers: { 'cache-control': 'no-store' } });
}
