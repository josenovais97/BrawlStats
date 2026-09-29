/**
 * Guess the brawler: one puzzle a day, five clues per guess.
 *
 * Pure logic, no I/O, so it can be tested without a database — the data layer
 * lives in `brawldle-data.ts` beside it. Everything here is a function of a
 * date string and two brawlers.
 *
 * The categories are deliberately limited to what the site can produce for the
 * WHOLE roster cheaply. Health, movement speed and attack range would all make
 * good clues and all live in the wiki infobox, which is fetched one page per
 * brawler — 107 requests to answer one guess. Rarity, class, release order,
 * tier and pick rate are all available in bulk from reads the site already
 * does, so a guess costs nothing new.
 */

export const RARITY_ORDER = [
  'Common',
  'Rare',
  'Super Rare',
  'Epic',
  'Mythic',
  'Legendary',
  'Ultra Legendary',
] as const;

export const TIER_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;

export const MOVEMENT_SCALE = ['Very Slow', 'Slow', 'Normal', 'Fast', 'Very Fast'] as const;
export const RANGE_SCALE = ['Very Short', 'Short', 'Normal', 'Long', 'Very Long'] as const;
export const RELOAD_SCALE = ['Very Slow', 'Slow', 'Normal', 'Fast', 'Very Fast'] as const;

/** Everything a guess is judged on. */
export interface BrawldleBrawler {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  rarity: string | null;
  className: string | null;
  /** Tier from the live ranked list, or null when it has too few battles. */
  tier: string | null;
  /** Named tiers off the wiki infobox. Null when the page could not be read. */
  movement: string | null;
  range: string | null;
  reload: string | null;
}

export type Verdict = 'hit' | 'near' | 'miss';
export type Direction = 'up' | 'down' | null;

export interface Clue {
  key: 'rarity' | 'class' | 'movement' | 'range' | 'reload' | 'released' | 'tier';
  label: string;
  /** What the guess had, as shown to the player. */
  value: string;
  verdict: Verdict;
  /**
   * Which way the answer lies, for the ordered clues. `up` means the answer is
   * higher than the guess.
   *
   * Null on an exact hit and on the unordered clues, where an arrow would be
   * meaningless — there is no direction from Marksman to Tank.
   */
  direction: Direction;
}

export interface GuessResult {
  brawler: BrawldleBrawler;
  correct: boolean;
  clues: Clue[];
}

/** Whole days since the epoch, from a YYYY-MM-DD string. */
export function dayIndex(date: string): number {
  const ms = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : 0;
}

/**
 * fmix32, the avalanche step from MurmurHead3.
 *
 * `brawlerOfDay` picks with a plain `dayIndex % length`, and reusing that here
 * would make the puzzle and the build-of-the-day post the same brawler on the
 * same day — the answer published in a carousel eight hours before the puzzle
 * resets. Mixing first decorrelates them.
 *
 * The same finaliser `snapshot-sample` needs, and for a related reason: the
 * low bits of a simple counter are too regular to slice directly.
 */
function fmix32(input: number): number {
  let h = input >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * The day's answer.
 *
 * A pure function of the date and the roster, so the page, the guess endpoint
 * and any future share card all reach the same brawler without sharing state —
 * the same reasoning as `brawlerOfDay`. Anything stateful would be a second
 * source of truth for one question.
 *
 * The roster must be sorted by id by the caller. Ordering by name would
 * reshuffle every future puzzle the first time the mirror renamed anything.
 */
export function answerFor(date: string, roster: BrawldleBrawler[]): BrawldleBrawler | null {
  if (roster.length === 0) return null;
  return roster[fmix32(dayIndex(date)) % roster.length];
}

function ordinal(list: readonly string[], value: string | null): number | null {
  if (!value) return null;
  const i = list.indexOf(value);
  return i === -1 ? null : i;
}

/**
 * An ordered clue: exact, one step away, or further.
 *
 * `near` at exactly one step is what makes the board readable. Without it a
 * player learns only "not this", and with a wider band the yellow stops
 * meaning anything.
 */
function ordered(
  key: Clue['key'],
  label: string,
  value: string,
  guess: number | null,
  answer: number | null,
): Clue {
  if (guess === null || answer === null) {
    // Unranked brawlers have no tier and no pick rate. Saying so is better
    // than guessing at one, and it cannot be a hit or a near.
    return { key, label, value: value || '—', verdict: 'miss', direction: null };
  }
  if (guess === answer) return { key, label, value, verdict: 'hit', direction: null };
  return {
    key,
    label,
    value,
    verdict: Math.abs(guess - answer) === 1 ? 'near' : 'miss',
    direction: answer > guess ? 'up' : 'down',
  };
}

/**
 * How close a release is before it counts as near.
 *
 * Brawler ids are assigned in release order, so the gap between two ids is
 * roughly how many brawlers shipped between them. Five is about half a year of
 * releases — close enough to be a useful nudge, far enough that it is not
 * nearly the answer.
 */
const RELEASE_NEAR = 5;

export function compareGuess(guess: BrawldleBrawler, answer: BrawldleBrawler): GuessResult {
  const rarity = ordered(
    'rarity',
    'Rarity',
    guess.rarity ?? '—',
    ordinal(RARITY_ORDER, guess.rarity),
    ordinal(RARITY_ORDER, answer.rarity),
  );

  const className: Clue = {
    key: 'class',
    label: 'Class',
    value: guess.className ?? '—',
    // No arrow: there is no direction from Marksman to Tank, and drawing one
    // would invite a player to read an ordering that does not exist.
    verdict: guess.className && guess.className === answer.className ? 'hit' : 'miss',
    direction: null,
  };

  const guessRank = guess.id;
  const answerRank = answer.id;
  const released: Clue = {
    key: 'released',
    label: 'Released',
    value: `#${guess.id - 16_000_000 + 1}`,
    verdict:
      guessRank === answerRank
        ? 'hit'
        : Math.abs(guessRank - answerRank) <= RELEASE_NEAR
          ? 'near'
          : 'miss',
    direction: guessRank === answerRank ? null : answerRank > guessRank ? 'up' : 'down',
  };

  const tier = ordered(
    'tier',
    'Tier',
    guess.tier ?? 'Unranked',
    ordinal(TIER_ORDER, guess.tier),
    ordinal(TIER_ORDER, answer.tier),
  );

  const movement = ordered(
    'movement',
    'Movement',
    guess.movement ?? '—',
    ordinal(MOVEMENT_SCALE, guess.movement),
    ordinal(MOVEMENT_SCALE, answer.movement),
  );
  const range = ordered(
    'range',
    'Range',
    guess.range ?? '—',
    ordinal(RANGE_SCALE, guess.range),
    ordinal(RANGE_SCALE, answer.range),
  );
  const reload = ordered(
    'reload',
    'Reload',
    guess.reload ?? '—',
    ordinal(RELOAD_SCALE, guess.reload),
    ordinal(RELOAD_SCALE, answer.reload),
  );

  /*
   * Order matters and is fixed: the board reads left to right and the share
   * grid is a row of squares in this same order, so a viewer comparing two
   * pasted grids is comparing the same columns.
   */
  return {
    brawler: guess,
    correct: guess.id === answer.id,
    clues: [rarity, className, movement, range, reload, released, tier],
  };
}

/** The emoji grid people paste into a chat. Order matches the board. */
export function shareGrid(results: GuessResult[], date: string): string {
  const square: Record<Verdict, string> = { hit: '🟩', near: '🟨', miss: '🟥' };
  const rows = results.map((r) => r.clues.map((c) => square[c.verdict]).join(''));
  const solved = results.length > 0 && results[results.length - 1].correct;
  const score = solved ? `${results.length}/∞` : 'X';
  return [`BrawlZone Daily ${date} — ${score}`, ...rows, 'brawlzone.net/daily-challenge'].join('\n');
}
