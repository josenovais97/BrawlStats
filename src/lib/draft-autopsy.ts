import 'server-only';

import type { BrawlerPairings, CounterScore, MapForm, RoleComposition } from '@/lib/stats';
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

/**
 * Battles a pairing needs before it can be named as the reason for a loss.
 *
 * `MIN_SAMPLE_FOR_PAIRING` is 20, which is the right floor for a brawler page
 * listing several matchups where the reader can see them together and weigh
 * them. It is the wrong floor here, where one pairing is singled out as *the*
 * explanation for a specific defeat — measured on a live profile, a 23-battle
 * pairing produced "countered by Mico, 23.5 points below its usual record",
 * which is a coin-flip sample wearing the clothes of a verdict.
 *
 * The same small-sample trap the comps and the map form both hit. A claim gets
 * stronger scrutiny the more weight the page puts on it.
 */
const MIN_COUNTER_BATTLES = 100;

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

  /**
   * The draft's estimated chance of winning, 0-1, or null when the map has too
   * little data to say. See `winProbability` for how it is derived and what it
   * deliberately excludes.
   */
  winChance: number | null;

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

/**
 * Two measured win rates turned into one head-to-head chance.
 *
 * Each side's number is already a win rate: `MapForm.adjusted` is centred on
 * 0.5, so 0.56 means "this brawler wins 56% here against an average opponent".
 * Two such rates do not simply subtract into a probability — a 55% side facing
 * a 45% side is not 55% to win, it is better than that, because the opponent
 * is *also* below average.
 *
 * The standard way to combine them is the log-odds difference, which is what
 * Elo and Bradley-Terry both reduce to: convert each rate to log-odds, take
 * the gap, convert back. Two even sides give exactly 50%, which is the
 * property that makes the output readable as a probability at all.
 *
 * What it is not: a fitted model of *this match*. It knows the drafts and the
 * map. It knows nothing about aim, positioning, gadget timing or who is better
 * at the game, and those decide most matches. It is the draft's chance, not
 * yours, and the card says so.
 */
function winProbability(mine: number, theirs: number): number {
  // Clamped so a lopsided sample cannot produce an infinite log-odds.
  const clamp = (p: number) => Math.min(0.95, Math.max(0.05, p));
  const logit = (p: number) => Math.log(p / (1 - p));
  const delta = logit(clamp(mine)) - logit(clamp(theirs));
  return 1 / (1 + Math.exp(-delta));
}

/**
 * A side's expected win rate, and how much of it is really about this map.
 *
 * Map form is preferred and overall Ranked form is the fallback, because the
 * alternative was refusing to answer. `getLadderMapForm` only publishes a
 * brawler once it has thirty battles on that exact map in fourteen days, which
 * across roughly thirty Ranked maps is a bar most of any given six-player
 * line-up misses — so the card said "not enough sampled battles" on nearly
 * every battle it was shown for, which is not a caveat, it is a broken
 * feature.
 *
 * Falling back is not a fudge: map form *is* overall form adjusted for a map,
 * so when the map has nothing to say, overall form is exactly the right prior
 * — it is what the map estimate would be shrunk toward anyway. What changes is
 * the strength of the claim, and `mapped` reports that honestly so the card can
 * say whether it is talking about this map or about Ranked in general.
 */
function sideRate(
  ids: number[],
  form: Map<number, MapForm>,
  overall: Map<number, number>,
  counters: Map<number, CounterScore>,
): { rate: number; mapped: number; battles: number } | null {
  const rates: number[] = [];
  let mapped = 0;
  let battles = 0;

  for (const id of ids) {
    const onMap = form.get(id);
    if (onMap) {
      rates.push(onMap.adjusted);
      battles += onMap.battles;
      mapped += 1;
      continue;
    }
    const general = overall.get(id);
    if (general !== undefined) rates.push(general);
  }

  if (rates.length === 0) return null;

  const base = rates.reduce((a, b) => a + b, 0) / rates.length;

  /*
   * The matchup, folded in on the same scale.
   *
   * `CounterScore.edge` is already a delta in win rate — the brawler's rate
   * against those specific opponents minus its own overall rate — so it adds
   * directly to a rate. Brawlers with no pairing data contribute nothing
   * rather than dragging the average toward zero.
   */
  const edges = ids
    .map((id) => counters.get(id)?.edge)
    .filter((e): e is number => e !== undefined);
  const matchup = edges.length > 0 ? edges.reduce((a, b) => a + b, 0) / edges.length : 0;

  return { rate: base + matchup, mapped, battles };
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
  counters,
  countered,
  overall,
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
  /** How each of this account's brawlers fares against the enemy line-up. */
  counters?: Map<number, CounterScore>;
  /** The same from the other side, for the enemy's brawlers against ours. */
  countered?: Map<number, CounterScore>;
  /** Overall Ranked form per brawler, used where this map has nothing. */
  overall?: Map<number, number>;
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

  const general = overall ?? new Map<number, number>();
  const myRate = sideRate(myIds, mapForm, general, counters ?? new Map());
  const theirRate = sideRate(theirIds, mapForm, general, countered ?? new Map());
  const winChance =
    myRate !== null && theirRate !== null
      ? winProbability(myRate.rate, theirRate.rate)
      : null;

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
      if (weak.decidedSampleSize < MIN_COUNTER_BATTLES) continue;
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
  const supportingBattles = (myRate?.battles ?? 0) + (theirRate?.battles ?? 0);
  const measured = (myRate?.mapped ?? 0) + (theirRate?.mapped ?? 0);

  /*
   * Confidence now grades the claim rather than gating it.
   *
   * It used to decide whether the card said anything at all, which meant a
   * draft the data could describe perfectly well in general terms was reported
   * as unknowable. It describes how much of the estimate is this map talking:
   * high when most of the line-up has real map data behind it, low when the
   * number is mostly overall Ranked form. The card words itself accordingly
   * instead of refusing.
   */
  const confidence: DraftAutopsy['confidence'] =
    measured >= 4 && supportingBattles >= 400
      ? 'high'
      : measured >= 2 && supportingBattles >= 100
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
    winChance,
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
