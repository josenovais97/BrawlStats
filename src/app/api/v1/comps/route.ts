import { getGameModeMap } from '@/lib/brawlapi';
import { errorResponse, okResponse } from '@/lib/route-helpers';
import { getTeamComps } from '@/lib/stats';

/**
 * GET /api/v1/comps — the team comps behind /comps, as JSON.
 *
 * Versioned under `/v1` because this one is meant to be depended on from
 * outside, unlike the unversioned routes beside it that exist to feed this
 * site's own client components and change whenever a component does.
 *
 * Two things keep it from becoming a cost. It reads `getTeamComps`, which is a
 * two-hour cached read shared with the pages, so a request costs a serialise
 * rather than a scan of 250k rows. And the response is itself cached for the
 * same two hours, which is the rhythm the underlying data actually moves at —
 * the sampler runs every two hours, so a shorter cache would serve the same
 * numbers while doing more work to produce them.
 *
 * Brawler ids rather than names, deliberately: names are display strings that
 * change casing and punctuation between sources, and the id is the game's own
 * stable key. `/api/rankings` and the game API both use it.
 */
export const revalidate = 7200;

export async function GET() {
  try {
    const [modes, modeMeta] = await Promise.all([
      getTeamComps(),
      getGameModeMap().catch(() => new Map()),
    ]);

    return okResponse(
      {
        windowDays: 14,
        modes: modes.map((mode) => ({
          mode: mode.mode,
          name: modeMeta.get(mode.mode)?.name ?? mode.mode,
          baselineWinRate: mode.baseline,
          sampleSize: mode.sampleSize,
          comps: mode.comps.map((comp) => ({
            brawlerIds: comp.brawlerIds,
            battles: comp.battles,
            players: comp.players,
            winRate: comp.winRate,
            edge: comp.edge,
          })),
        })),
      },
      7200,
    );
  } catch (err) {
    return errorResponse(err);
  }
}
