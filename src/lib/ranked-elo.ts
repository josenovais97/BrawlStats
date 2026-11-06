/**
 * Where each Ranked rank starts, in elo.
 *
 * The game publishes no table. Read off 15,000 sampled profiles on
 * 2026-11-06 (lowest elo seen at each rank name; every boundary came out on a
 * round number with thousands of players at most ranks): 250 a division up to
 * Silver, 500 from Gold to Mythic, 750 through Legendary, 1,000 through
 * Masters, Pro from 11,250.
 */
export const RANK_ELO_FLOORS: readonly (readonly [name: string, floor: number])[] = [
  ['BRONZE I', 0], ['BRONZE II', 250], ['BRONZE III', 500],
  ['SILVER I', 750], ['SILVER II', 1000], ['SILVER III', 1250],
  ['GOLD I', 1500], ['GOLD II', 2000], ['GOLD III', 2500],
  ['DIAMOND I', 3000], ['DIAMOND II', 3500], ['DIAMOND III', 4000],
  ['MYTHIC I', 4500], ['MYTHIC II', 5000], ['MYTHIC III', 5500],
  ['LEGENDARY I', 6000], ['LEGENDARY II', 6750], ['LEGENDARY III', 7500],
  ['MASTERS I', 8250], ['MASTERS II', 9250], ['MASTERS III', 10250],
  ['PRO', 11250],
];

export interface RankProgress {
  /** "Mythic II" */
  rank: string;
  elo: number;
  /** Null at Pro, the top. */
  next: string | null;
  toNext: number | null;
  /** 0-1 through the current rank. */
  share: number;
}

const titled = (name: string) =>
  name
    .toLowerCase()
    .split(' ')
    .map((w) => (/^i+$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

/** Progress through the rank an elo falls in; null without an elo. */
export function rankProgress(elo: number | null | undefined): RankProgress | null {
  if (elo === null || elo === undefined || !Number.isFinite(elo) || elo < 0) return null;
  let index = 0;
  for (let i = 0; i < RANK_ELO_FLOORS.length; i++) if (elo >= RANK_ELO_FLOORS[i][1]) index = i;
  const [name, floor] = RANK_ELO_FLOORS[index];
  const next = RANK_ELO_FLOORS[index + 1];
  return {
    rank: titled(name),
    elo,
    next: next ? titled(next[0]) : null,
    toNext: next ? next[1] - elo : null,
    share: next ? (elo - floor) / (next[1] - floor) : 1,
  };
}

/** "MYTHIC II" -> "MYTHIC": the rank an elo-rate row is kept under. */
export function rankGroup(elo: number): string {
  let name = RANK_ELO_FLOORS[0][0];
  for (const [n, floor] of RANK_ELO_FLOORS) if (elo >= floor) name = n;
  return name.split(' ')[0];
}

/**
 * Running sums for a least-squares fit of `delta = win * wins - loss * losses`
 * over many (elo change, Ranked wins, Ranked losses) observations, one per
 * player per day (2026-11-06). The battle log carries no elo change for
 * Ranked games (`trophyChange` is null on every soloRanked entry), so the only
 * way to know what a win is worth is to watch the profile's elo move.
 */
export interface EloSums {
  n: number;
  sww: number;
  swl: number;
  sll: number;
  swy: number;
  sly: number;
}

export interface EloRate {
  /** Elo gained per Ranked win. */
  win: number;
  /** Elo lost per Ranked loss, as a positive number. */
  loss: number;
  n: number;
}

/** Below this many player-days a rank's fit is not shown. */
export const MIN_ELO_OBSERVATIONS = 150;

/** Solves the fit; null when thin, degenerate or nonsensical. */
export function solveEloRate(s: EloSums): EloRate | null {
  if (s.n < MIN_ELO_OBSERVATIONS) return null;
  const det = s.sww * s.sll - s.swl * s.swl;
  if (!(det > 0)) return null;
  const win = (s.swy * s.sll - s.sly * s.swl) / det;
  const lossCoef = (s.sww * s.sly - s.swl * s.swy) / det;
  if (!(win > 0) || win > 200) return null;
  return { win, loss: Math.max(0, -lossCoef), n: s.n };
}

/** One player-day's contribution, or null when it would only add noise. */
export function eloObservation(delta: number, wins: number, losses: number): EloSums | null {
  const games = wins + losses;
  if (games === 0 || games > 60) return null;
  // A season reset or a missed day moves elo far more than games can.
  if (Math.abs(delta) > 60 * games + 50) return null;
  return { n: 1, sww: wins * wins, swl: wins * losses, sll: losses * losses, swy: wins * delta, sly: losses * delta };
}

/** Straight wins to the next rank at this rank's rate; null when unknown or at Pro. */
export function winsToNext(progress: RankProgress | null, rates: Record<string, EloRate> | null | undefined): number | null {
  if (!progress || progress.toNext === null || !rates) return null;
  const rate = rates[rankGroup(progress.elo)];
  if (!rate) return null;
  return Math.max(1, Math.ceil(progress.toNext / rate.win));
}
