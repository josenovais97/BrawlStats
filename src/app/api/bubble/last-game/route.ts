import { getBattleLog } from '@/lib/bs-api';
import { draftAutopsy } from '@/lib/draft-autopsy';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { okResponse } from '@/lib/route-helpers';
import {
  getBrawlerPairings,
  getCounterScores,
  getLadderMapForm,
  getMetaIndex,
  getRankedMapPicks,
  getRoleCompositions,
  RANKED_MAP_WINDOW_DAYS,
  type CounterScore,
  type MapForm,
  type ScoredBrawler,
} from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';

/**
 * The Bubble panel's review of your last Ranked game (2026-11-06).
 *
 * The same reading as the profile page's "What went wrong" card
 * (lib/draft-autopsy), on the newest soloRanked/teamRanked battle, win or
 * loss: each draft's chance and the worst matchup on the board. Fetched only
 * when the player opens the drawer under their name, so a panel open costs no
 * extra API call. No roster is read, so no "better pick" (that would need a
 * profile call too).
 */

export const dynamic = 'force-dynamic';

const RANKED = new Set(['soloRanked', 'teamRanked']);

export async function GET(request: Request) {
  const tag = normalizeTag(new URL(request.url).searchParams.get('tag'));
  if (!tag) return Response.json({ error: 'no tag' }, { status: 400 });

  const log = await getBattleLog(tag)
    .then((r) => r.items)
    .catch(() => null);
  if (!log) return okResponse({ game: null }, 60);

  const entry = log.find(
    (e) =>
      RANKED.has(e.battle.type ?? '') &&
      (e.battle.result === 'victory' || e.battle.result === 'defeat') &&
      (e.battle.teams?.length ?? 0) >= 2 &&
      Boolean(e.event?.map),
  );
  if (!entry) return okResponse({ game: null }, 60);

  const myTeam = entry.battle.teams?.find((team) => team.some((p) => normalizeTag(p.tag) === tag)) ?? [];
  const myIds = myTeam.map((p) => p.brawler?.id).filter((id): id is number => id !== undefined);
  const theirIds = (entry.battle.teams ?? [])
    .flat()
    .filter((p) => !myTeam.some((mate) => mate.tag === p.tag))
    .map((p) => p.brawler?.id)
    .filter((id): id is number => id !== undefined);
  if (myIds.length === 0 || theirIds.length === 0) return okResponse({ game: null }, 60);

  const [rankedMaps, form, pairs, shapes, catalogue, counters, countered, meta] = await Promise.all([
    // Per map, the same read (and cache) as the draft helper's.
    getRankedMapPicks(60, RANKED_MAP_WINDOW_DAYS, { mapName: entry.event?.map ?? '' }).catch(() => []),
    getLadderMapForm().catch(() => new Map<string, MapForm[]>()),
    Promise.all(myIds.map(async (id) => [id, await getBrawlerPairings(id).catch(() => null)] as const)),
    getRoleCompositions().catch(() => null),
    getBrawlerCatalog().catch(() => null),
    getCounterScores(theirIds).catch(() => new Map<number, CounterScore>()),
    getCounterScores(myIds).catch(() => new Map<number, CounterScore>()),
    getMetaIndex('ranked', 7).catch(() => new Map<number, ScoredBrawler>()),
  ]);

  /*
   * A Ranked game is read against Ranked results on its map (the lists the
   * Meta tab shows), where the profile card uses trophy games. Trophy form
   * fills in for a map Ranked has too little on.
   */
  const rankedMap = rankedMaps.find((m) => m.mapName === entry.event?.map);
  const mapRows: MapForm[] =
    rankedMap && rankedMap.picks.length >= 6
      ? rankedMap.picks.map((p) => ({ brawlerId: p.brawlerId, battles: p.decidedSampleSize, winRate: p.winRate, adjusted: p.score }))
      : (form.get(entry.event?.map ?? '') ?? []);

  const review = draftAutopsy({
    entry,
    tag,
    mapForm: new Map<number, MapForm>(mapRows.map((row) => [row.brawlerId, row])),
    pairings: new Map(pairs.filter((p): p is [number, NonNullable<(typeof p)[1]>] => p[1] !== null)),
    counters,
    countered,
    overall: new Map(
      [...meta.values()]
        .filter((e) => e.normalizedWinRate !== null)
        .map((e) => [e.brawlerId, e.normalizedWinRate!] as const),
    ),
    roles: new Map((catalogue?.all ?? []).map((b) => [b.id, b.className])),
    shapes,
    roster: [],
  });

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
