import type { Locale } from '@/lib/i18n';
import { CLOSERS, JOKES, TITLES, formatIn, jokeLines, varsFor, type Joke, type Line } from '@/lib/roast-jokes';
import type { Tier } from '@/types/stats';
import type { BSBattleLogEntry, BSPlayer } from '@/types/brawlstars';

/**
 * "Roast my account": a scripted roast built from a player's real numbers.
 *
 * No AI at runtime, on purpose: every line is one we wrote (much of the
 * audience is young, so nothing here can surprise us), it costs nothing per
 * roast however far it spreads, and each line carries its own Spanish and
 * Portuguese. What keeps it from feeling canned is that every joke is gated on
 * a fact about this account and quotes that account's numbers.
 *
 * Deterministic per tag and day: refreshing gives the same roast, so a
 * screenshot is the roast, not one roll of many. Tomorrow it may pick
 * different lines.
 */

export const RANKED_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'MYTHIC', 'LEGENDARY', 'MASTERS', 'PRO'] as const;
export type RankedTier = (typeof RANKED_TIERS)[number];

export interface RankedStanding {
  tier: RankedTier;
  /** 0 = Bronze .. 7 = Pro, for comparing two ranks. */
  index: number;
  /** "LEGENDARY II" as the API spells it. */
  raw: string;
}

export interface RoastBrawler {
  name: string;
  trophies: number;
  power: number;
  prestige: number;
  maxWinStreak: number;
  className: string | null;
  tier: Tier | null;
}

/** Everything a joke may look at, derived once from the API payloads. */
export interface RoastFacts {
  name: string;
  trophies: number;
  expLevel: number;
  owned: number;
  rosterSize: number;
  /** Brawlers at power 11. */
  maxed: number;
  /** Brawlers at power 1 or 2: unlocked and left there. */
  untouched: number;
  /** Power 11 brawlers with no star power. */
  maxedNoStarPower: number;
  wins3v3: number;
  winsSolo: number;
  winsDuo: number;
  hasClub: boolean;
  clubName: string | null;
  /** The club's name brags too ("Brawl Killers"). */
  braggingClub: boolean;
  rankedNow: RankedStanding | null;
  rankedBest: RankedStanding | null;
  /** Most played in the recent log when it is clear, else most trophies. */
  main: RoastBrawler | null;
  /** The highest max win streak on any brawler. */
  bestStreak: { brawler: string; streak: number } | null;
  log: RecentGames | null;
  /** A name that brags: PRO, GOD, KING... */
  braggingName: boolean;
  /** Decorated with fancy Unicode letters or symbols. */
  fancyName: boolean;
}

export interface RecentGames {
  games: number;
  /** Games with a win or a loss: 3v3 and Ranked, not Showdown or draws. */
  decided: number;
  wins: number;
  /** Consecutive losses ending with the most recent game. */
  lossStreak: number;
  showdown: number;
  friendly: number;
  ranked: number;
  rankedWins: number;
  starPlayer: number;
  /** The most played brawler and how many games, over the whole log. */
  topBrawler: { name: string; games: number } | null;
  /** The top brawler was played strictly more than the runner-up. */
  topBrawlerLead: boolean;
}

export interface RoastContext {
  rosterSize: number;
  classOf?: (brawlerName: string) => string | null;
  tierOf?: (brawlerId: number) => Tier | null;
}

/* --------------------------------- facts ---------------------------------- */

export function parseRanked(raw: string | null | undefined): RankedStanding | null {
  if (!raw) return null;
  const word = raw.trim().split(/\s+/)[0]?.toUpperCase();
  const index = RANKED_TIERS.indexOf(word as RankedTier);
  return index < 0 ? null : { tier: RANKED_TIERS[index], index, raw: raw.trim() };
}

const BRAG_WORDS = [
  'pro', 'god', 'king', 'queen', 'legend', 'boss', 'master', 'best', 'goat', 'killer', 'hacker', 'beast',
  'insane', 'savage', 'demon', 'elite', 'toxic', 'sniper', 'ninja', 'monster', 'slayer', 'killers',
];

/**
 * "xXProGamerXx", "KingSlayer", "BOSS_77" brag; "Viking", "Problem" and
 * "GODZILLA" do not. A word counts where its case starts and ends it:
 * lowercase between non-letters, Capitalised before a non-lowercase letter,
 * CAPITALS between non-capitals.
 */
const BRAG = new RegExp(
  BRAG_WORDS.map((w) => {
    const cap = w[0].toUpperCase() + w.slice(1);
    return `(?:^|[^a-zA-Z])${w}(?:$|[^a-z])|${cap}(?:$|[^a-z])|(?:^|[^A-Z])${w.toUpperCase()}(?:$|[^A-Z])`;
  }).join('|'),
);

/**
 * Letters from the Mathematical Alphanumeric block ("𝐊𝐧𝐢𝐠𝐡𝐭"), small caps,
 * or decoration like ꨄ, 么 and 彡 -- the names that took longer to type than
 * to play.
 */
const FANCY = /[\u{1D400}-\u{1D7FF}ᴀ-ᴫꧠ-꫿么彡★☆♡♥☬-☯]/u;

export function buildFacts(
  player: BSPlayer,
  log: BSBattleLogEntry[] | null,
  ctx: RoastContext,
): RoastFacts {
  const brawlers = player.brawlers ?? [];
  const recent = log && log.length > 0 ? summariseLog(player.tag, log) : null;

  const toRoast = (b: (typeof brawlers)[number]): RoastBrawler => ({
    name: b.name,
    trophies: b.trophies,
    power: b.power,
    prestige: b.prestigeLevel ?? 0,
    maxWinStreak: b.maxWinStreak ?? 0,
    className: ctx.classOf?.(b.name) ?? null,
    tier: ctx.tierOf?.(b.id) ?? null,
  });

  const byTrophies = [...brawlers].sort(
    (a, b) => b.trophies - a.trophies || b.highestTrophies - a.highestTrophies,
  );
  /*
   * Who the main is: the clear favourite of the recent log when there is one.
   * Trophies stopped answering this with prestige, which resets a brawler to
   * 1,000 -- a grinder's top six can sit within twenty trophies of each other.
   * Without a log, prestige first, then trophies.
   */
  const recentMain =
    recent?.topBrawler && recent.topBrawler.games >= 4 && recent.topBrawlerLead
      ? brawlers.find((b) => b.name === recent.topBrawler!.name)
      : undefined;
  const byPrestige = [...byTrophies].sort((a, b) => (b.prestigeLevel ?? 0) - (a.prestigeLevel ?? 0));
  const main = recentMain ?? byPrestige[0];

  const streakHolder = [...brawlers].sort((a, b) => (b.maxWinStreak ?? 0) - (a.maxWinStreak ?? 0))[0];

  return {
    name: player.name,
    trophies: player.trophies,
    expLevel: player.expLevel,
    owned: brawlers.length,
    rosterSize: Math.max(ctx.rosterSize, brawlers.length),
    maxed: brawlers.filter((b) => b.power >= 11).length,
    untouched: brawlers.filter((b) => b.power <= 2).length,
    maxedNoStarPower: brawlers.filter((b) => b.power >= 11 && (b.starPowers?.length ?? 0) === 0).length,
    wins3v3: player['3vs3Victories'] ?? 0,
    winsSolo: player.soloVictories ?? 0,
    winsDuo: player.duoVictories ?? 0,
    hasClub: Boolean(player.club?.tag),
    clubName: player.club?.tag ? (player.club.name ?? null) : null,
    braggingClub: Boolean(player.club?.tag && player.club.name && BRAG.test(player.club.name.normalize('NFKC'))),
    rankedNow: parseRanked(player.rankedRankName),
    rankedBest: parseRanked(player.highestAllTimeRankedRankName ?? player.highestSeasonRankedRankName),
    main: main ? toRoast(main) : null,
    bestStreak:
      streakHolder && (streakHolder.maxWinStreak ?? 0) > 0
        ? { brawler: streakHolder.name, streak: streakHolder.maxWinStreak ?? 0 }
        : null,
    log: recent,
    braggingName: BRAG.test(player.name.normalize('NFKC')),
    fancyName: FANCY.test(player.name),
  };
}

const SHOWDOWN = /showdown/i;

function summariseLog(tag: string, log: BSBattleLogEntry[]): RecentGames {
  const me = tag.toUpperCase();
  const counts = new Map<string, number>();
  let decided = 0;
  let wins = 0;
  let showdown = 0;
  let friendly = 0;
  let ranked = 0;
  let rankedWins = 0;
  let starPlayer = 0;

  for (const { event, battle } of log) {
    const mine = findMe(me, battle);
    if (mine) counts.set(mine, (counts.get(mine) ?? 0) + 1);
    if (battle.type === 'friendly') friendly += 1;
    if (SHOWDOWN.test(battle.mode ?? event.mode ?? '')) showdown += 1;
    if (battle.starPlayer?.tag?.toUpperCase() === me) starPlayer += 1;
    if (battle.result === 'victory' || battle.result === 'defeat') {
      decided += 1;
      if (battle.result === 'victory') wins += 1;
      // "soloRanked"/"teamRanked" are Ranked; plain "ranked" is trophy road.
      if (battle.type === 'soloRanked' || battle.type === 'teamRanked') {
        ranked += 1;
        if (battle.result === 'victory') rankedWins += 1;
      }
    }
  }

  // The log is newest first.
  let lossStreak = 0;
  for (const { battle } of log) {
    if (battle.result === 'defeat') lossStreak += 1;
    else if (battle.result === 'victory') break;
  }

  const [top, second] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    games: log.length,
    decided,
    wins,
    lossStreak,
    showdown,
    friendly,
    ranked,
    rankedWins,
    starPlayer,
    topBrawler: top ? { name: top[0], games: top[1] } : null,
    topBrawlerLead: Boolean(top && (!second || top[1] > second[1])),
  };
}

function findMe(me: string, battle: BSBattleLogEntry['battle']): string | null {
  const everyone = [...(battle.teams?.flat() ?? []), ...(battle.players ?? [])];
  const found = everyone.find((p) => p.tag?.toUpperCase() === me);
  return found?.brawler?.name ?? found?.brawlers?.[0]?.name ?? null;
}

/* --------------------------------- score ---------------------------------- */

/**
 * 0-10, about how the account plays rather than how much was spent on it:
 * best Ranked rank, recent win rate, trophies and how much of the roster is
 * maxed. A part with no data drops out and the rest are re-weighted, so a
 * player who never touched Ranked is scored on the other three.
 */
export function roastScore(f: RoastFacts): number {
  const parts: [number, number][] = [];
  if (f.rankedBest) parts.push([0.35, (f.rankedBest.index / 7) * 10]);
  if (f.log && f.log.decided >= 8) {
    const wr = f.log.wins / f.log.decided;
    parts.push([0.25, clamp(((wr - 0.35) / 0.35) * 10, 0, 10)]);
  }
  parts.push([0.2, clamp((Math.log10(1 + f.trophies) / Math.log10(1 + 180_000)) * 10, 0, 10)]);
  if (f.rosterSize > 0) parts.push([0.2, (f.maxed / f.rosterSize) * 10]);
  const weight = parts.reduce((s, [w]) => s + w, 0);
  const raw = parts.reduce((s, [w, v]) => s + w * v, 0) / weight;
  return Math.round(clamp(raw, 0.1, 9.9) * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/* --------------------------------- roast ---------------------------------- */

export interface Roast {
  score: number;
  title: string;
  lines: string[];
  closer: string;
}

export const ROAST_LINES = 5;

/** FNV-1a then a mulberry32 stream: same tag + day, same roast. */
export function seededRandom(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function roast(f: RoastFacts, lang: Locale, seed: string): Roast {
  const rand = seededRandom(seed);
  const score = roastScore(f);

  /*
   * Specific beats generic: a joke's priority says how sharp it is for this
   * account, the jitter only reorders jokes of about the same sharpness. One
   * joke per topic, so a roast never makes the same point twice.
   */
  const ranked = JOKES.map((joke) => ({ joke, p: joke.when(f), lines: jokeLines(joke, f) }))
    .filter((c): c is { joke: Joke; p: number; lines: Line[] } => typeof c.p === 'number' && c.p > 0 && c.lines.length > 0)
    .map((c) => ({ ...c, order: c.p + rand() * 1.5 }))
    .sort((a, b) => b.order - a.order);

  const vars = varsFor(f, lang);
  const topics = new Set<string>();
  const lines: string[] = [];
  for (const c of ranked) {
    if (lines.length >= ROAST_LINES) break;
    if (topics.has(c.joke.topic)) continue;
    topics.add(c.joke.topic);
    lines.push(fill(pick(c.lines, rand), lang, vars));
  }

  const band = TITLES.find((t) => score >= t.min) ?? TITLES[TITLES.length - 1];
  const closers = CLOSERS.find((c) => score >= c.min) ?? CLOSERS[CLOSERS.length - 1];
  return {
    score,
    title: band.title[lang],
    lines,
    closer: fill(pick(closers.lines, rand), lang, vars),
  };
}

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)];
}

function fill(line: Line, lang: Locale, vars: Record<string, string | number>): string {
  return line[lang].replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key];
    if (v === undefined) return whole;
    return typeof v === 'number' ? formatIn(v, lang) : v;
  });
}
