import { playerIconUrl } from '@/lib/brawlapi';
import { getPlayer } from '@/lib/bs-api';
import { normalizeTag } from '@/lib/tags';
import { recordLookup } from '@/lib/stats';

/**
 * What one account can actually field, for the overlay.
 *
 * The bubble shows the global meta: it names the best pick on a map whether or
 * not you own it. This is the missing half — the ids, power levels and
 * hypercharge ownership that let the panel say "and here is your best pick",
 * and dim the ones you cannot take.
 *
 * Deliberately thin. The full player payload carries battle logs, club, skins
 * and a dozen counters, and the overlay needs three fields per brawler. Sending
 * the rest would be tens of kilobytes over mobile data, mid-match, for nothing.
 *
 * **Called once a day, not once a draft.** The panel caches the answer in its
 * own storage and refreshes in the background, because a roster changes when
 * you level a brawler and not between two games. That matters: a player fetch
 * is an uncached upstream call, which is exactly the shape of read AGENTS.md
 * warns about — one per panel open would put a live API call on the hot path
 * of a feature that exists to be opened constantly.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('tag');
  const tag = normalizeTag(raw);
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });

  let player;
  try {
    player = await getPlayer(tag);
  } catch {
    // The panel treats any failure as "no account configured" and falls back
    // to the global list, so the distinction between a bad tag and an upstream
    // outage is not worth a taxonomy here.
    return Response.json({ error: 'lookup failed' }, { status: 404 });
  }

  /*
   * The same enrolment the profile page performs. A tag typed into the overlay
   * is a real account someone cares about, and widening the sampling pool is
   * the whole reason the tier list has numbers — so it would be strange to
   * take the lookup and not the sample.
   *
   * Safe to call on every request: it upserts one row per tag per day.
   */
  recordLookup({
    tag: normalizeTag(player.tag),
    name: player.name,
    trophies: player.trophies,
    highestTrophies: player.highestTrophies,
    brawlerCount: player.brawlers.length,
    iconId: player.icon?.id,
    rankedElo: player.rankedElo,
    rankedRankName: player.rankedRankName,
    highestRankedElo: player.highestAllTimeRankedElo,
    highestRankedRankName: player.highestAllTimeRankedRankName,
    roster: player.brawlers.map((b) => ({ id: b.id, power: b.power })),
  }).catch(() => {
    /* Never let the sampling side-effect fail the reply. */
  });

  return Response.json(
    {
      tag: normalizeTag(player.tag),
      name: player.name,
      /*
       * For the app's account card. It confirms the tag belongs to the person
       * typing it — a name and a face are checkable at a glance where a string
       * of characters is not, and a tag with one wrong character is otherwise
       * a silent mistake that just makes every filter look broken.
       */
      iconUrl: playerIconUrl(player.icon?.id),
      trophies: player.trophies,
      brawlers: player.brawlers.map((b) => ({
        id: b.id,
        power: b.power,
        // `hyperCharges` is absent for a brawler with none, and an empty array
        // for one that has the ability but has not unlocked it. Both mean the
        // same thing to the filter: you cannot field a hypercharge.
        hypercharge: (b.hyperCharges?.length ?? 0) > 0,
      })),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
