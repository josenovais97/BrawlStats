import { getBattleLog } from '@/lib/bs-api';
import { rankedGames, reviewGame } from '@/lib/bubble-review';
import { okResponse } from '@/lib/route-helpers';
import { normalizeTag } from '@/lib/tags';

/**
 * The Bubble panel's review of your last Ranked game (2026-11-06).
 *
 * The newest soloRanked/teamRanked battle, win or loss: each draft's chance
 * and the worst matchup on the board (lib/bubble-review). Fetched only when
 * the player opens the drawer under their name, so a panel open costs no
 * extra API call. No roster is read, so no "better pick" (that would need a
 * profile call too; the post-game review, api/bubble/review, has one).
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const tag = normalizeTag(new URL(request.url).searchParams.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });

  const log = await getBattleLog(tag)
    .then((r) => r.items)
    .catch(() => null);
  if (!log) return okResponse({ game: null }, 60);

  const entry = rankedGames(log)[0];
  if (!entry) return okResponse({ game: null }, 60);
  const read = await reviewGame(entry, tag);
  if (!read) return okResponse({ game: null }, 60);
  const { review, myIds, theirIds } = read;

  return okResponse(
    {
      game: {
        battleTime: entry.battleTime,
        mapName: entry.event?.map ?? null,
        mode: entry.event?.mode ?? entry.battle.mode ?? null,
        result: entry.battle.result,
        myIds,
        theirIds,
        winChance: review?.winChance ?? null,
        worst: review?.worstMatchup
          ? { brawlerId: review.worstMatchup.brawlerId, againstId: review.worstMatchup.againstId, edge: review.worstMatchup.edge }
          : null,
      },
    },
    60,
  );
}
