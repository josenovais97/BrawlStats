import 'server-only';

import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { draftAutopsy, type DraftAutopsy } from '@/lib/draft-autopsy';
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
import type { BSBattleLogEntry, BSPlayerBrawler } from '@/types/brawlstars';

/**
 * Reading one Ranked game for the Bubble (2026-11-06, shared 2026-11-09):
 * the panel drawer's "Last game" line (api/bubble/last-game) and the
 * post-game review the bubble pulses for (api/bubble/review).
 *
 * The same reading as the profile page's "What went wrong" card
 * (lib/draft-autopsy), against Ranked results on the game's map.
 */

const RANKED = new Set(['soloRanked', 'teamRanked']);

/** Decided Ranked games with both teams and a map, newest first (the log's order). */
export function rankedGames(log: BSBattleLogEntry[]): BSBattleLogEntry[] {
  return log.filter(
    (e) =>
      RANKED.has(e.battle.type ?? '') &&
      (e.battle.result === 'victory' || e.battle.result === 'defeat') &&
      (e.battle.teams?.length ?? 0) >= 2 &&
      Boolean(e.event?.map),
  );
}

export interface ReviewedGame {
  myIds: number[];
  theirIds: number[];
  /** Brawler ids in the same order as the teams, with whose is whose. */
  mine: { id: number; tag: string }[];
  theirs: { id: number; tag: string }[];
  review: DraftAutopsy | null;
}

/**
 * The draft reading for one game. With the player's roster, the "better
 * pick" is a swap they could actually have made (a brawler at power 11).
 */
export async function reviewGame(
  entry: BSBattleLogEntry,
  tag: string,
  roster: BSPlayerBrawler[] = [],
  opts: { ownPickOnly?: boolean } = {},
): Promise<ReviewedGame | null> {
  const me = normalizeTag(tag);
  const myTeam = entry.battle.teams?.find((team) => team.some((p) => normalizeTag(p.tag) === me)) ?? [];
  const mine = myTeam
    .filter((p) => p.brawler?.id !== undefined)
    .map((p) => ({ id: p.brawler!.id, tag: normalizeTag(p.tag) ?? '' }));
  const theirs = (entry.battle.teams ?? [])
    .flat()
    .filter((p) => !myTeam.some((mate) => mate.tag === p.tag) && p.brawler?.id !== undefined)
    .map((p) => ({ id: p.brawler!.id, tag: normalizeTag(p.tag) ?? '' }));
  const myIds = mine.map((p) => p.id);
  const theirIds = theirs.map((p) => p.id);
  if (myIds.length === 0 || theirIds.length === 0) return null;

  const mapName = entry.event?.map ?? '';
  const [rankedMaps, form, pairs, shapes, catalogue, counters, countered, meta] = await Promise.all([
    // Per map, the same read (and cache) as the draft helper's.
    getRankedMapPicks(60, RANKED_MAP_WINDOW_DAYS, { mapName }).catch(() => []),
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
  const rankedMap = rankedMaps.find((m) => m.mapName === mapName);
  const mapRows: MapForm[] =
    rankedMap && rankedMap.picks.length >= 6
      ? rankedMap.picks.map((p) => ({ brawlerId: p.brawlerId, battles: p.decidedSampleSize, winRate: p.winRate, adjusted: p.score }))
      : (form.get(mapName) ?? []);

  const review = draftAutopsy({
    entry,
    tag: me ?? tag,
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
    roster,
    swapOnly: opts.ownPickOnly ? mine.find((p) => p.tag === me)?.id : undefined,
  });

  return { myIds, theirIds, mine, theirs, review };
}
