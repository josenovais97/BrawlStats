import { unstable_cache } from 'next/cache';

import { getClub, getPlayer } from '@/lib/bs-api';
import { clubScan } from '@/lib/club-scan';
import { USABLE_POWER, getMetaIndex } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';

/**
 * What a club can field between them, read from thirty live rosters.
 *
 * **The most expensive request on this site, by a factor of thirty**, and the
 * reasons it is allowed to exist are all about bounding that:
 *
 * - *It is asked for, never rendered.* The club page does not call this. A
 *   button does, which means a crawler, a drive-by visit and an unfurl all cost
 *   nothing — the trap-5 shape is a route that spends upstream budget on
 *   somebody who did not want the answer.
 * - *Twelve hours of cache.* A club asked for twice is one scan. Only distinct
 *   clubs cost anything, and there are not many distinct clubs anyone cares
 *   about.
 * - *Its own rate-limit prefix*, listed before `/club/` so it is budgeted as
 *   itself. See `hot-path-limit`.
 * - *`/club/` is blocked for crawlers at the edge*, which covers this path too.
 *
 * It lives under `/club/scan/` rather than `/club/<tag>/scan` for the third of
 * those: the limiter matches static prefixes, and a tag in the middle of the
 * path cannot be matched by one. No club tag can read "scan" — S, C, A and N
 * are not in the game's tag alphabet — so the segment cannot collide.
 */

export const dynamic = 'force-dynamic';

/** A full club. The game's own cap, so this is "all of them" rather than a cut. */
const MAX_MEMBERS = 30;

/**
 * Profiles in flight at once.
 *
 * Thirty at once is a burst no considerate client sends, and sequential would
 * make one scan take half a minute. Six is roughly the rate the sampler already
 * sustains against the same API.
 */
const CONCURRENCY = 6;

async function scan(tag: string) {
  const club = await getClub(tag);
  const members = (club.members ?? []).slice(0, MAX_MEMBERS);

  const meta = await getMetaIndex('ranked', 7);
  const topTier = [...meta.values()]
    .filter((b) => b.tier === 'S' || b.tier === 'A')
    .map((b) => ({ brawlerId: b.brawlerId, brawlerName: b.brawlerName }));

  const read: Array<{
    tag: string;
    name: string;
    trophies: number;
    roster: Array<{ id: number; power: number; hypercharge: boolean }>;
  }> = [];
  let missed = 0;

  for (let i = 0; i < members.length; i += CONCURRENCY) {
    const batch = await Promise.all(
      members.slice(i, i + CONCURRENCY).map(async (member) => {
        try {
          /*
           * One retry. Measured while load-testing this route: thirteen of
           * twenty-nine members came back unreadable at once, which is not
           * thirteen private accounts -- it is the upstream API shedding load.
           * A read is safe to repeat and the second attempt costs one call
           * against a scan that would otherwise be wrong for twelve hours.
           */
          const player = await getPlayer(normalizeTag(member.tag)).catch(() =>
            getPlayer(normalizeTag(member.tag)),
          );
          return {
            tag: normalizeTag(member.tag),
            name: member.name,
            trophies: member.trophies,
            roster: player.brawlers.map((b) => ({
              id: b.id,
              power: b.power,
              // Absent for a brawler with none, empty for one that has the
              // ability but has not unlocked it. Both mean "cannot field it".
              hypercharge: (b.hyperCharges?.length ?? 0) > 0,
            })),
          };
        } catch {
          /*
           * One unreadable member costs its own row and never the scan. A
           * private or renamed account is ordinary, and the count is reported
           * so the coverage figure is not quietly computed over a smaller club
           * than the one on screen.
           */
          return null;
        }
      }),
    );
    for (const row of batch) {
      if (row) read.push(row);
      else missed += 1;
    }
  }

  return {
    name: club.name,
    size: members.length,
    scan: clubScan({ members: read, topTier, usablePower: USABLE_POWER, missed }),
  };
}

/**
 * Above this, the scan describes a different club from the one on screen.
 *
 * A handful of private or renamed accounts is ordinary and is reported rather
 * than hidden. A quarter of the club missing is not that -- it is the upstream
 * API refusing, and the coverage figures are then computed over whoever
 * happened to answer.
 */
const MAX_MISSED_SHARE = 0.25;

/** Carries the partial result past `unstable_cache`, which does not cache a throw. */
interface PartialScan {
  partialScan: true;
  result: Awaited<ReturnType<typeof scan>>;
}

/*
 * Matched on a field rather than with `instanceof`. The throw crosses the cache
 * wrapper, and a guard that depends on the prototype surviving that is a guard
 * that fails by falling through to "lookup failed" -- which looks exactly like
 * a club that does not exist.
 */
function isPartialScan(error: unknown): error is PartialScan {
  return typeof error === 'object' && error !== null && 'partialScan' in error;
}

/**
 * Twelve hours.
 *
 * Long for this site, and the right length for the question: a club's rosters
 * change when somebody levels a brawler, which is not something that happens
 * between two readings of the same page. The tier list underneath moves on its
 * own schedule, so a scan that is half a day old is still describing the same
 * club against very nearly the same meta.
 */
const cachedScan = unstable_cache(
  async (tag: string) => {
    const result = await scan(tag);
    /*
     * A degraded scan is still shown, but never remembered.
     *
     * Twelve hours is a long time to be wrong, and the first person to press
     * the button during an upstream hiccup would otherwise decide what every
     * later visitor sees until tomorrow. `unstable_cache` does not cache a
     * rejected promise, so throwing is how a result gets past it -- the
     * handler catches this and answers with the data anyway.
     */
    if (result.size > 0 && (result.scan?.missed ?? 0) / result.size > MAX_MISSED_SHARE) {
      throw { partialScan: true, result } satisfies PartialScan;
    }
    return result;
  },
  ['club-scan'],
  { revalidate: 43_200 },
);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tag: string }> },
) {
  const tag = normalizeTag((await params).tag);
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });

  try {
    const result = await cachedScan(tag);
    if (!result.scan) {
      // No tier list to measure against. Our gap, not a verdict on the club.
      return Response.json({ error: 'no meta' }, { status: 503 });
    }
    return Response.json(result);
  } catch (error) {
    // Too much of the club was unreadable to keep, but what came back is still
    // worth showing — with `partial` so the page can offer to try again rather
    // than presenting a quarter-empty club as the answer.
    if (isPartialScan(error) && error.result.scan) {
      return Response.json(
        { ...error.result, partial: true },
        { headers: { 'cache-control': 'no-store' } },
      );
    }
    return Response.json({ error: 'lookup failed' }, { status: 404 });
  }
}
