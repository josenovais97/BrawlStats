import 'server-only';

import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { draftAutopsy, draftChance, type DraftAutopsy } from '@/lib/draft-autopsy';
import { bracketForTier, lobbyTier } from '@/lib/rank-brackets';
import {
  getBracketMapPicks,
  getBracketRoster,
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
  /*
   * Read at the rank the game was played at (2026-11-26): in a Ranked game
   * each brawler's `trophies` is its player's rank tier, and the lobby's rank
   * is their median, as the sampler files it (lib/aggregation).
   */
  const players = (entry.battle.teams ?? []).flat();
  const bracket = bracketForTier(lobbyTier(players.map((p) => p.brawler?.trophies), players.length))?.id;
  const [inputs, pairs, shapes, catalogue] = await Promise.all([
    draftInputs(mapName, myIds, theirIds, bracket),
    Promise.all(myIds.map(async (id) => [id, await getBrawlerPairings(id).catch(() => null)] as const)),
    getRoleCompositions().catch(() => null),
    getBrawlerCatalog().catch(() => null),
  ]);

  const review = draftAutopsy({
    entry,
    tag: me ?? tag,
    mapForm: inputs.mapForm,
    pairings: new Map(pairs.filter((p): p is [number, NonNullable<(typeof p)[1]>] => p[1] !== null)),
    counters: inputs.counters,
    countered: inputs.countered,
    overall: inputs.overall,
    roles: new Map((catalogue?.all ?? []).map((b) => [b.id, b.className])),
    shapes,
    roster,
    swapOnly: opts.ownPickOnly ? mine.find((p) => p.tag === me)?.id : undefined,
  });

  return { myIds, theirIds, mine, theirs, review };
}

/**
 * The draft board's live chance (Bubble 1.43): the same inputs as a review,
 * for line-ups still being picked on `mapName`.
 */
export async function draftChanceFor(
  mapName: string,
  myIds: number[],
  theirIds: number[],
  bracket?: number,
): Promise<{ chance: number; mapped: number } | null> {
  if (myIds.length === 0 || theirIds.length === 0) return null;
  const inputs = await draftInputs(mapName, myIds, theirIds, bracket);
  return draftChance({ myIds, theirIds, ...inputs });
}

/**
 * What a draft is read against: the map's Ranked picks, each brawler's
 * overall Ranked form and the matchups both ways.
 *
 * With `bracket`, at that rank (2026-11-26): the draft board's chance and the
 * review used every rank's games, so a Masters player was read partly against
 * Bronze lobbies while the draft suggestions beside it already answered for
 * their rank. Anything too thin at the rank keeps its every-rank answer, as in
 * the suggestions: the map when it has fewer than six picks there, a brawler's
 * form or matchup when the rank has too few of its games.
 *
 * A Ranked game is read against Ranked results on its map (the lists the Meta
 * tab shows), where the profile card uses trophy games. Trophy form fills in
 * for a map Ranked has too little on.
 */
async function draftInputs(mapName: string, myIds: number[], theirIds: number[], bracket?: number) {
  const [rankedMaps, rankMaps, form, counters, countered, meta, rankRoster] = await Promise.all([
    // Per map, the same read (and cache) as the draft helper's.
    getRankedMapPicks(60, RANKED_MAP_WINDOW_DAYS, { mapName }).catch(() => []),
    bracket ? getBracketMapPicks(bracket, 60).catch(() => []) : Promise.resolve([]),
    getLadderMapForm().catch(() => new Map<string, MapForm[]>()),
    getCounterScores(theirIds, 21, bracket).catch(() => new Map<number, CounterScore>()),
    getCounterScores(myIds, 21, bracket).catch(() => new Map<number, CounterScore>()),
    getMetaIndex('ranked', 7).catch(() => new Map<number, ScoredBrawler>()),
    bracket ? getBracketRoster(bracket).catch(() => null) : Promise.resolve(null),
  ]);
  const enough = (m: { mapName: string; picks: unknown[] }) => m.mapName === mapName && m.picks.length >= 6;
  const rankedMap = rankMaps.find(enough) ?? rankedMaps.find(enough);
  const mapRows: MapForm[] = rankedMap
    ? rankedMap.picks.map((p) => ({ brawlerId: p.brawlerId, battles: p.decidedSampleSize, winRate: p.winRate, adjusted: p.score }))
    : (form.get(mapName) ?? []);

  const overall = new Map<number, number>();
  for (const e of [...meta.values(), ...(rankRoster?.scored ?? [])]) {
    if (e.normalizedWinRate !== null) overall.set(e.brawlerId, e.normalizedWinRate);
  }
  return {
    mapForm: new Map<number, MapForm>(mapRows.map((row) => [row.brawlerId, row])),
    overall,
    counters,
    countered,
  };
}
