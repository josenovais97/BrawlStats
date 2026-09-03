import 'server-only';

import type { BrawlerPairings, MapForm, RoleComposition } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';
import type { BSBattleLogEntry, BSBattlePlayer, BSPlayerBrawler } from '@/types/brawlstars';

/**
 * Why one specific battle went the way it did — as far as the data can say.
 *
 * The honest scope is the whole design here. The API reports who was drafted,
 * on what map, and who won. It says nothing about aim, positioning, gadget
 * timing, or whether someone disconnected, and no amount of statistics
 * recovers those. So this explains the *draft* and refuses to imply anything
 * else: a losing team with a favourable draft is told the draft was fine, which
 * is a more useful answer than inventing a reason.
 *
 * Everything below is a comparison against a measured population, and every
 * claim carries the number of battles behind it. A verdict a reader cannot
 * check is indistinguishable from a guess dressed up in a percentage.
 */

/** Under this a per-brawler map figure is not worth putting in a sentence. */
const MIN_MAP_SAMPLE = 30;

/** A matchup edge smaller than this is inside the noise of a pairing sample. */
const MIN_COUNTER_EDGE = 0.04;

/** Points of expected advantage below which a draft was not the problem. */
const DRAFT_DECIDED_IT = 4;

export interface DraftSide {
  brawlerIds: number[];
  /** Mean map-adjusted edge, in points. Null when nothing was sampled here. */
  edge: number | null;
  /** Brawlers on this side that the map has enough data for. */
  measured: number;
}

export interface CounterMismatch {
  /** The player's brawler that was outmatched. */
  brawlerId: number;
  /** The enemy brawler that beats it. */
  againstId: number;
  /** How far below its own average that pairing runs, in points. */
  edge: number;
  battles: number;
}

export interface DraftAutopsy {
  battleTime: string;
  mapName: string | null;
  mode: string;
  result: 'victory' | 'defeat' | 'draw';
  trophyChange: number;

  mine: DraftSide;
  theirs: DraftSide;
  /** Positive means this account's draft was the stronger one. */
  advantage: number | null;

  /** The worst matchup on the board for this account. */
  worstMatchup: CounterMismatch | null;
  /** The enemy pick that contributed most to their side's edge. */
  keyEnemy: { brawlerId: number; edge: number } | null;
  /** The team's role shape, when every brawler on it has a class. */
  shape: RoleComposition | null;

  /** A swap from this account's own maxed roster that would have helped most. */
  betterPick: {
    outId: number;
    inId: number;
    /** Points the expected edge would have improved by. */
    gain: number;
  } | null;

  /** What the verdict rests on, so the reader can weigh it. */
  confidence: 'high' | 'medium' | 'low';
  supportingBattles: number;
}

function participants(entry: BSBattleLogEntry): BSBattlePlayer[] {
  const { teams, players } = entry.battle;
  if (teams) return teams.flat();
  if (players) return players;
  return [];
}

/** Mean edge of a side, over the brawlers this map actually has data for. */
function sideEdge(ids: number[], form: Map<number, MapForm>): DraftSide {
  const measured = ids.map((id) => form.get(id)).filter((f): f is MapForm => f !== undefined);
  if (measured.length === 0) return { brawlerIds: ids, edge: null, measured: 0 };
  const mean =
    measured.reduce((sum, f) => sum + (f.adjusted - 0.5), 0) / measured.length;
  return { brawlerIds: ids, edge: mean * 100, measured: measured.length };
}

/**
 * Reads one battle against the map, the matchups and the roster.
 *
 * Returns null for anything it cannot speak to: a mode without teams, a battle
 * whose map was never sampled, or a log entry missing the player. Silence is
 * the correct output when there is nothing measured to say.
 */
export function draftAutopsy({
  entry,
  tag,
  mapForm,
  pairings,
  roles,
  shapes,
  roster,
}: {
  entry: BSBattleLogEntry;
  tag: string;
  /** Per-brawler form on this battle's map. */
  mapForm: Map<number, MapForm>;
  /** Pairings for each of the player's brawlers in this battle. */
  pairings: Map<number, BrawlerPairings>;
  /** Brawler id to class name, for the team shape. */
  roles: Map<number, string | null>;
  shapes: { comps: RoleComposition[]; baseline: number } | null;
  roster: BSPlayerBrawler[];
}): DraftAutopsy | null {
  const me = normalizeTag(tag);
  const teams = entry.battle.teams;
  if (!teams || teams.length < 2) return null;

  const myTeam = teams.find((team) => team.some((p) => normalizeTag(p.tag) === me));
  if (!myTeam) return null;

  const myIds = myTeam.map((p) => p.brawler?.id).filter((id): id is number => id !== undefined);
  const theirIds = participants(entry)
    .filter((p) => !myTeam.some((mate) => mate.tag === p.tag))
    .map((p) => p.brawler?.id)
    .filter((id): id is number => id !== undefined);

  if (myIds.length === 0 || theirIds.length === 0) return null;

  const mine = sideEdge(myIds, mapForm);
  const theirs = sideEdge(theirIds, mapForm);
  const advantage =
    mine.edge !== null && theirs.edge !== null ? mine.edge - theirs.edge : null;

  /*
   * The worst matchup on the board: for each of our brawlers, is any enemy one
   * it measurably loses to? Read from the same pairing roll-up the brawler
   * pages use, so this cannot disagree with them.
   */
  let worstMatchup: CounterMismatch | null = null;
  for (const id of myIds) {
    const pairing = pairings.get(id);
    if (!pairing) continue;
    for (const weak of pairing.weakAgainst) {
      if (!theirIds.includes(weak.brawlerId)) continue;
      if (-weak.edge < MIN_COUNTER_EDGE) continue;
      if (!worstMatchup || weak.edge < worstMatchup.edge / 100) {
        worstMatchup = {
          brawlerId: id,
          againstId: weak.brawlerId,
          edge: weak.edge * 100,
          battles: weak.decidedSampleSize,
        };
      }
    }
  }

  /* Which enemy pick carried their side. */
  let keyEnemy: DraftAutopsy['keyEnemy'] = null;
  for (const id of theirIds) {
    const form = mapForm.get(id);
    if (!form || form.battles < MIN_MAP_SAMPLE) continue;
    const edge = (form.adjusted - 0.5) * 100;
    if (!keyEnemy || edge > keyEnemy.edge) keyEnemy = { brawlerId: id, edge };
  }

  /* The team's role shape, only when every brawler on it has a class. */
  let shape: RoleComposition | null = null;
  if (shapes && myIds.length === 3) {
    const named = myIds.map((id) => roles.get(id) ?? null);
    if (named.every((role): role is string => role !== null)) {
      const key = [...named].sort().join(' + ');
      shape = shapes.comps.find((comp) => comp.roles.slice().sort().join(' + ') === key) ?? null;
    }
  }

  /*
   * A swap the account could actually have made.
   *
   * Restricted to brawlers owned at max power, because a recommendation the
   * player could not have played is a criticism rather than advice. Scored on
   * the same map form as everything else: swap one of ours out, put a candidate
   * in, and see how the side's mean edge moves.
   */
  let betterPick: DraftAutopsy['betterPick'] = null;
  if (mine.edge !== null) {
    const maxed = roster.filter((b) => b.power >= 11 && !myIds.includes(b.id));
    for (const outId of myIds) {
      for (const candidate of maxed) {
        const swapped = myIds.map((id) => (id === outId ? candidate.id : id));
        const next = sideEdge(swapped, mapForm);
        if (next.edge === null || next.measured < mine.measured) continue;
        const gain = next.edge - mine.edge;
        if (gain <= 0) continue;
        if (!betterPick || gain > betterPick.gain) {
          betterPick = { outId, inId: candidate.id, gain };
        }
      }
    }
  }

  /*
   * Confidence is about evidence, not about how strong the verdict sounds.
   * A side where only one brawler was sampled produces a number, and that
   * number should not be presented like one built from six.
   */
  const supportingBattles = [...myIds, ...theirIds]
    .map((id) => mapForm.get(id)?.battles ?? 0)
    .reduce((sum, n) => sum + n, 0);
  const measured = mine.measured + theirs.measured;
  const confidence: DraftAutopsy['confidence'] =
    measured >= 5 && supportingBattles >= 600
      ? 'high'
      : measured >= 3 && supportingBattles >= 200
        ? 'medium'
        : 'low';

  return {
    battleTime: entry.battleTime,
    mapName: entry.event?.map ?? null,
    mode: entry.event?.mode ?? '',
    result:
      entry.battle.result === 'victory'
        ? 'victory'
        : entry.battle.result === 'defeat'
          ? 'defeat'
          : 'draw',
    trophyChange: entry.battle.trophyChange ?? 0,
    mine,
    theirs,
    advantage,
    worstMatchup,
    keyEnemy,
    shape,
    betterPick,
    confidence,
    supportingBattles,
  };
}

/** Whether the draft, rather than the play, is a defensible explanation. */
export function draftWasTheProblem(autopsy: DraftAutopsy): boolean {
  return autopsy.advantage !== null && autopsy.advantage <= -DRAFT_DECIDED_IT;
}
