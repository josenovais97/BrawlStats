import 'server-only';

import { MAX_POWER_LEVEL, coinsBetweenLevels } from '@/lib/progression';
import type { BSPlayerBrawler } from '@/types/brawlstars';
import type { ModeBestPicks } from '@/types/stats';

/**
 * The cheapest set of upgrades that buys the most Ranked coverage.
 *
 * The profile already says which brawlers are strong and which are unfinished.
 * What it never answered is the question a player actually has when they open
 * their coin balance: *which* of the twenty half-levelled brawlers should they
 * finish, and what does finishing them buy.
 *
 * Coverage is the unit, not win rate. A roster that fields a top-three pick in
 * six of six live modes is meaningfully better than one that fields it in four,
 * and that difference survives a ban — whereas "your average brawler is 0.4
 * points stronger" is a number with no decision attached to it.
 *
 * Greedy rather than exhaustive, and the choice matters. Picking the best set
 * of three from a hundred candidates is a knapsack problem; picking the single
 * upgrade that adds most coverage per coin, three times over, is a loop. The
 * greedy answer is not provably optimal, but it is explainable — every step can
 * be justified to the reader as "this one, because it covered a mode nothing
 * else did" — and an optimiser nobody can follow is a slot machine.
 */

/** Power level at which a brawler is a real Ranked option. */
const READY_POWER = 9;

/** Depth of a mode's pick list that counts as covering it. */
const COVERAGE_DEPTH = 3;

/**
 * A mode is *ban-safe* when two of its top picks are ready.
 *
 * One good pick is a plan; the same plan after the enemy bans it is nothing.
 * Two is the smallest number that survives the first ban, which is why this is
 * counted separately rather than folded into coverage.
 */
const BAN_SAFE_PICKS = 2;

export interface UpgradeStep {
  brawlerId: number;
  name: string;
  power: number;
  coins: number;
  /** Modes this upgrade newly covers, named so the step explains itself. */
  covers: string[];
  /** Modes it makes ban-safe without newly covering. */
  secures: string[];
}

export interface RosterPlan {
  steps: UpgradeStep[];
  totalCoins: number;
  modes: number;
  coveredBefore: number;
  coveredAfter: number;
  banSafeBefore: number;
  banSafeAfter: number;
}

/** How many upgrades a plan is allowed to ask for before it stops being a plan. */
const MAX_STEPS = 3;

function countCoverage(
  picksByMode: Map<string, ModeBestPicks>,
  modes: string[],
  ready: Set<number>,
): { covered: number; banSafe: number; perMode: Map<string, number> } {
  let covered = 0;
  let banSafe = 0;
  const perMode = new Map<string, number>();

  for (const mode of modes) {
    const picks = picksByMode.get(mode)?.picks ?? [];
    const have = picks
      .slice(0, COVERAGE_DEPTH)
      .filter((pick) => ready.has(pick.brawlerId)).length;
    perMode.set(mode, have);
    if (have >= 1) covered += 1;
    if (have >= BAN_SAFE_PICKS) banSafe += 1;
  }

  return { covered, banSafe, perMode };
}

/**
 * Builds the plan.
 *
 * Candidates are owned brawlers below `READY_POWER` that appear in some live
 * mode's top picks. Unowned brawlers are excluded deliberately: an unlock is
 * not a spend a player can make on demand, so a plan that opens with "unlock
 * Amber" is a plan they cannot start today.
 */
export function rosterPlan({
  brawlers,
  picksByMode,
  modes,
  modeLabels,
}: {
  brawlers: BSPlayerBrawler[];
  picksByMode: Map<string, ModeBestPicks>;
  /** Modes in the live Ranked rotation. */
  modes: string[];
  /** Mode key to display name, so a step can name what it bought. */
  modeLabels: Map<string, string>;
}): RosterPlan | null {
  if (modes.length === 0) return null;

  const owned = new Map(brawlers.map((b) => [b.id, b]));
  const ready = new Set(brawlers.filter((b) => b.power >= READY_POWER).map((b) => b.id));

  const start = countCoverage(picksByMode, modes, ready);

  /* Only brawlers that would actually change a mode if finished. */
  const candidates = new Set<number>();
  for (const mode of modes) {
    for (const pick of picksByMode.get(mode)?.picks.slice(0, COVERAGE_DEPTH) ?? []) {
      const mine = owned.get(pick.brawlerId);
      if (mine && mine.power < READY_POWER) candidates.add(pick.brawlerId);
    }
  }
  if (candidates.size === 0) return null;

  const steps: UpgradeStep[] = [];
  const chosen = new Set(ready);
  let current = start;

  for (let step = 0; step < MAX_STEPS; step += 1) {
    let best: { id: number; gain: number; coins: number } | null = null;

    for (const id of candidates) {
      if (chosen.has(id)) continue;
      const mine = owned.get(id);
      if (!mine) continue;

      const next = countCoverage(picksByMode, modes, new Set([...chosen, id]));
      /*
       * Coverage is worth more than ban safety, and both are worth more than
       * nothing — a brawler that changes neither is not an upgrade this plan
       * should recommend, whatever its win rate.
       */
      const gain =
        (next.covered - current.covered) * 10 + (next.banSafe - current.banSafe);
      if (gain <= 0) continue;

      const coins = coinsBetweenLevels(mine.power, MAX_POWER_LEVEL);
      // Ties go to the cheaper brawler: same benefit, less money.
      if (!best || gain > best.gain || (gain === best.gain && coins < best.coins)) {
        best = { id, gain, coins };
      }
    }

    if (!best) break;

    const mine = owned.get(best.id)!;
    const after = countCoverage(picksByMode, modes, new Set([...chosen, best.id]));

    const covers: string[] = [];
    const secures: string[] = [];
    for (const mode of modes) {
      const had = current.perMode.get(mode) ?? 0;
      const has = after.perMode.get(mode) ?? 0;
      const label = modeLabels.get(mode) ?? mode;
      if (had === 0 && has >= 1) covers.push(label);
      else if (had < BAN_SAFE_PICKS && has >= BAN_SAFE_PICKS) secures.push(label);
    }

    steps.push({
      brawlerId: best.id,
      name: mine.name,
      power: mine.power,
      coins: best.coins,
      covers,
      secures,
    });

    chosen.add(best.id);
    current = after;
  }

  if (steps.length === 0) return null;

  return {
    steps,
    totalCoins: steps.reduce((sum, s) => sum + s.coins, 0),
    modes: modes.length,
    coveredBefore: start.covered,
    coveredAfter: current.covered,
    banSafeBefore: start.banSafe,
    banSafeAfter: current.banSafe,
  };
}
