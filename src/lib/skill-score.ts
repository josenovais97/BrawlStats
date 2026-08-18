/**
 * Skill Score: one 0-10 number for how good an account's *player* is, as
 * distinct from how much has been poured into it.
 *
 * ---------------------------------------------------------------------------
 * The distinction is the whole point. Trophies, power levels and hypercharges
 * measure time and money; a level-500 account with every brawler maxed has
 * proved persistence, not skill. Ranked is the only mode where matchmaking
 * pairs comparable opponents, so it carries the most weight here, and the
 * investment side is deliberately capped at a minority share.
 *
 * The score is anchored to absolute, game-grounded values rather than to
 * percentiles of our own sample. Our sampled pool is seeded from the global
 * trophy leaderboard — its 25th percentile sits at 177,000 trophies and Masters
 * ranked — so scoring against it would rate a genuinely strong account as
 * below average. See lib/stats.ts for the one place percentile anchoring *is*
 * correct: there the sample is the population being ranked.
 * ---------------------------------------------------------------------------
 */

import type { BSPlayer } from '@/types/brawlstars';

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/**
 * Compresses the top of every band so both ends of the ladder stay separable.
 *
 * Straight linear anchoring cannot do both jobs at once. Anchored to the top of
 * the ladder, a Diamond player scored 2.1 out of 10; pulled in far enough to
 * fix that, 37 of 60 sampled top-500 accounts came out "Elite" and several hit
 * a flat 10. The ceilings below are therefore set out at genuine top-of-ladder
 * values, and this exponent lifts the lower range back into the middle of the
 * scale — so Gold reads about 0.33 and Masters about 0.81 on the same axis.
 */
const CURVE = 0.6;

/** Maps a value onto 0-1 between two absolute anchors, along the curve above. */
function band(value: number, floor: number, ceiling: number): number {
  return clamp01((value - floor) / (ceiling - floor)) ** CURVE;
}

/** Straight-line version, for the flag maths where a residual must stay linear. */
function linear(value: number, floor: number, ceiling: number): number {
  return clamp01((value - floor) / (ceiling - floor));
}

/**
 * Ranked standing, mapped to where each tier actually sits in the population
 * rather than to raw elo.
 *
 * Elo was the wrong axis for two reasons. It is not linear in skill — the gap
 * between Bronze and Gold is a fraction of the gap between Legendary and
 * Masters — and the tiers overlap in elo anyway: measured across our sample,
 * Masters I accounts ranged from 8,263 to 11,237 while Legendary III reached
 * 8,621, because peak rank and peak elo can come from different seasons. A
 * linear elo band consequently rated Masters at about 0.81, which undersells
 * what reaching it takes.
 *
 * These values are anchored to published tier distributions instead: roughly
 * 1% of Ranked players reach Masters and about 5% reach Legendary. So Masters
 * sits near the ceiling, Legendary just below it, and the lower tiers spread
 * across the bottom half where most of the population actually is.
 */
const RANK_TIERS: { name: string; value: number }[] = [
  { name: 'BRONZE', value: 0.1 },
  { name: 'SILVER', value: 0.2 },
  { name: 'GOLD', value: 0.34 },
  { name: 'DIAMOND', value: 0.5 },
  { name: 'MYTHIC', value: 0.68 },
  { name: 'LEGENDARY', value: 0.85 },
  { name: 'MASTERS', value: 0.95 },
  { name: 'PRO', value: 1 },
];

const DIVISIONS: Record<string, number> = { I: 1, II: 2, III: 3 };

/**
 * "MASTERS II" -> 0.967. Divisions interpolate toward the next tier, so a
 * Masters III outranks a Masters I without needing an elo tiebreak.
 */
function rankValue(rankName: string | undefined): number | null {
  if (!rankName) return null;

  const [tierWord, divisionWord] = rankName.trim().toUpperCase().split(/\s+/);
  const index = RANK_TIERS.findIndex((t) => t.name === tierWord);
  if (index === -1) return null;

  const tier = RANK_TIERS[index];
  const next = RANK_TIERS[index + 1];
  if (!next) return tier.value;

  const division = DIVISIONS[divisionWord ?? 'I'] ?? 1;
  return tier.value + ((division - 1) / 3) * (next.value - tier.value);
}

/**
 * Fallback elo anchors, for the rare payload carrying elo but no rank name.
 * Deliberately generous at the top for the same reason as the table above.
 */
const ELO_FLOOR = 1_000;
const ELO_CEILING = 11_000;

/**
 * Ranked is scored on the all-time peak alone.
 *
 * Ranked resets roughly every three months and drops everyone to the 750 floor,
 * so current standing measures how much of *this season* someone has played,
 * not how good they are. Blending it in produced exactly the wrong answer on
 * the accounts that matter most: a player with a peak of Pro sitting at Silver
 * I mid-reset scored 0.72 on this component instead of 1.00, docking a
 * top-0.1% account more than a point for not having re-climbed yet.
 *
 * Reaching a tier is not undone by the calendar, so the peak is the claim and
 * the current season is left to the Ranked leaderboard, which is where "who is
 * on top right now" belongs.
 */

/**
 * Average trophies per owned brawler, which is trophy performance with roster
 * size divided out — total trophies mostly measures how many brawlers you
 * unlocked. 150 is a casual account; 1,600 is a committed pusher, with the
 * top of our sample (about 2,100) saturating above it.
 */
const AVG_BRAWLER_FLOOR = 150;
const AVG_BRAWLER_CEILING = 2_400;


/**
 * Weights. Ranked leads because it is the only skill-isolating signal; mastery
 * is capped at 15% precisely because it is the one component money can buy.
 *
 * There used to be a fourth, "efficiency" — trophies per account level — meant
 * to separate skill from grind. It was removed after being measured: across a
 * 60-player sample it moved the score by 0.29 points on average while
 * reordering 51 of 60 players, and it pushed in the wrong direction. Account
 * level is a lifetime counter with no decay, so it penalised exactly the
 * strongest, longest-serving players and rewarded thin accounts that had
 * pushed trophies without investing. Perter (#2R8QLCUG0) — Pro, 11,729 elo,
 * every brawler at power 11 — scored 100% on all three remaining components
 * and 72% on efficiency, which alone cost him 0.4 points.
 *
 * Nothing was lost by dropping it. Separating skill from grind is Ranked's
 * job, and elo does it properly because matchmaking normalises it; efficiency
 * was a weak proxy for something already measured well.
 */
const WEIGHTS = {
  ranked: 0.55,
  trophies: 0.3,
  mastery: 0.15,
} as const;

export type SkillComponentKey = keyof typeof WEIGHTS;

/**
 * Ceiling for an account with no Ranked record.
 *
 * Redistributing Ranked's weight across the other three keeps them spread —
 * without it every trophy-only account would bunch at the bottom — but on its
 * own it *rewards* never queueing: a top-three global account with zero elo
 * maxed the three remaining components and came out at a flat 10.0, on a score
 * whose whole premise is that Ranked is the skill signal.
 *
 * So the redistribution stays and the result is capped. The cap sits at the top
 * of "Skilled": a huge trophy account with no Ranked record has demonstrably
 * played a great deal of Brawl Stars, and has demonstrably not shown the one
 * thing this number is mostly about.
 */
const NO_RANKED_CAP = 6.5;

export interface SkillComponent {
  key: SkillComponentKey;
  label: string;
  /** 0-1 before weighting. */
  value: number;
  /** Share of the final score this contributed, in points out of 10. */
  points: number;
  /** The underlying number, for showing the reader what was measured. */
  detail: string;
}

export type SkillTier =
  | 'Beginner'
  | 'Casual'
  | 'Competent'
  | 'Skilled'
  | 'Expert'
  | 'Elite';

const TIERS: { tier: SkillTier; min: number }[] = [
  { tier: 'Elite', min: 8.5 },
  { tier: 'Expert', min: 7 },
  { tier: 'Skilled', min: 5.5 },
  { tier: 'Competent', min: 4 },
  { tier: 'Casual', min: 2.5 },
  { tier: 'Beginner', min: 0 },
];

/**
 * Flagging works off *expected* elo rather than off the scored components.
 *
 * A smurf is not "good at the game" — it is "good at the game on an account too
 * young to explain it", and the scored `ranked` component cannot see that:
 * Mythic sits low on an absolute 2,500-12,000 band, so a Mythic level-28
 * account and a Mythic level-400 account score the same there. What separates
 * them is that only one of them is surprising.
 *
 * So investment is mapped to the peak elo an account that size normally
 * reaches, and the flag is the residual. The floor is roughly Silver, i.e.
 * where a brand-new account lands; the span is what a fully progressed account
 * typically converts to.
 */
const EXPECTED_ELO_FLOOR = 800;
const EXPECTED_ELO_SPAN = 8_500;

/** Elo above expectation, in points, that counts as one unit of surprise. */
const ELO_SURPRISE_UNIT = 2_500;

/**
 * Surprise needed to flag, and the investment ceiling for calling it a smurf.
 *
 * The ceiling does most of the work. A smurf is specifically a *young* account
 * playing above its age; a level-140 account with 70 brawlers is an ordinary
 * established one, and at an earlier 0.55 ceiling it got called a smurf merely
 * for being good at Ranked. 0.40 keeps the label on accounts that are actually
 * too small to explain the results.
 */
const SMURF_SURPRISE = 0.8;
const SMURF_MAX_INVESTMENT = 0.4;
const AHEAD_SURPRISE = 0.9;
const AHEAD_MAX_INVESTMENT = 0.85;

/**
 * The mirror image: heavy investment that has not converted into results.
 *
 * Held to a deliberately strict bar. An early cut fired on 30% of a sample of
 * top-500 accounts, which makes it a description of the sample rather than a
 * remark about the player.
 */
const COLLECTOR_SHORTFALL = 1.1;
const COLLECTOR_MIN_INVESTMENT = 0.8;

export type AccountFlag =
  | { kind: 'smurf'; label: string; detail: string }
  | { kind: 'ahead'; label: string; detail: string }
  | { kind: 'collector'; label: string; detail: string };

export interface SkillScore {
  /** 0-10, one decimal. */
  score: number;
  tier: SkillTier;
  components: SkillComponent[];
  /** True when the player has no Ranked elo; weights are redistributed. */
  rankedUnavailable: boolean;
  /** True when NO_RANKED_CAP actually bit, so the UI can say the score is held down. */
  capped: boolean;
  flag: AccountFlag | null;
}

export function computeSkillScore(player: BSPlayer): SkillScore {
  const brawlers = player.brawlers;
  const owned = Math.max(brawlers.length, 1);

  /* ------------------------------ ranked ------------------------------ */

  const peakElo = player.highestAllTimeRankedElo ?? 0;
  const currentElo = player.rankedElo ?? 0;
  // Zero elo means the account has never actually played a Ranked match, even
  // when the payload still carries a Bronze I rank name.
  const rankedUnavailable = peakElo === 0 && currentElo === 0;

  // Peak first, current only as a fallback for payloads missing the all-time
  // name — never blended in. See the note above NO_RANKED_CAP's neighbours.
  const peakRank = rankValue(player.highestAllTimeRankedRankName);
  const currentRank = rankValue(player.rankedRankName);

  const rankedValue = rankedUnavailable
    ? 0
    : (peakRank ??
      currentRank ??
      // No rank name at all: fall back to the elo band on the peak elo.
      band(Math.max(peakElo, currentElo), ELO_FLOOR, ELO_CEILING));

  /* ----------------------------- trophies ----------------------------- */

  const avgBrawlerTrophies = player.trophies / owned;
  const trophyValue = band(avgBrawlerTrophies, AVG_BRAWLER_FLOOR, AVG_BRAWLER_CEILING);

  /* ------------------------------ mastery ----------------------------- */

  // Fractions of the *owned* roster, not of the whole game: a player with 40
  // brawlers all at power 11 has mastered what they have, and unlocking more
  // is the progression page's subject rather than this one's.
  const maxed = brawlers.filter((b) => b.power === 11).length / owned;
  const hypercharged =
    brawlers.filter((b) => (b.hyperCharges?.length ?? 0) > 0).length / owned;
  // Hypercharges are the scarcer, later-game half, so they carry more of it.
  const masteryValue = clamp01(maxed * 0.45 + hypercharged * 0.55);

  /* ------------------------------ combine ----------------------------- */

  const raw: { key: SkillComponentKey; label: string; value: number; detail: string }[] = [
    {
      key: 'ranked',
      label: 'Ranked',
      value: rankedValue,
      detail: rankedUnavailable
        ? 'No Ranked elo on record'
        : `${
            player.highestAllTimeRankedRankName
              ? `peak ${titleCase(player.highestAllTimeRankedRankName)}`
              : 'Ranked'
          } · ${Math.max(peakElo, currentElo).toLocaleString('en-US')} elo`,
    },
    {
      key: 'trophies',
      label: 'Trophy push',
      value: trophyValue,
      detail: `${Math.round(avgBrawlerTrophies).toLocaleString('en-US')} avg per brawler`,
    },
    {
      key: 'mastery',
      label: 'Mastery',
      value: masteryValue,
      detail: `${Math.round(maxed * 100)}% at power 11 · ${Math.round(
        hypercharged * 100,
      )}% hypercharged`,
    },
  ];

  // A player who has never touched Ranked is not thereby unskilled, so its
  // weight is redistributed across the rest rather than scored as zero.
  const active = rankedUnavailable ? raw.filter((c) => c.key !== 'ranked') : raw;
  const totalWeight = active.reduce((sum, c) => sum + WEIGHTS[c.key], 0);

  const rawPoints = active.map((c) => ((c.value * WEIGHTS[c.key]) / totalWeight) * 10);
  const rawScore = rawPoints.reduce((sum, p) => sum + p, 0);

  const ceiling = rankedUnavailable ? NO_RANKED_CAP : 10;
  const score = Math.round(Math.min(rawScore, ceiling) * 10) / 10;
  const capped = rawScore > ceiling;

  // Scaled so the per-component points still add up to the headline number.
  // Unscaled they summed to 9.9 under a displayed 6.5, which reads as a bug in
  // the arithmetic rather than as a cap. The ratios between components — the
  // part that actually explains the score — are unchanged.
  const scale = capped && rawScore > 0 ? ceiling / rawScore : 1;

  const components: SkillComponent[] = active.map((c, index) => ({
    ...c,
    points: rawPoints[index] * scale,
  }));

  return {
    score,
    tier: TIERS.find((t) => score >= t.min)?.tier ?? 'Beginner',
    components,
    rankedUnavailable,
    capped,
    flag: detectFlag({ player, masteryValue, rankedUnavailable }),
  };
}

/**
 * Whether the account looks like something other than a normal progression.
 *
 * Deliberately a separate label rather than a score adjustment. A smurf is not
 * worse or better than its score says — the score is accurate about the player
 * and misleading about the account, and the honest fix is to say so rather
 * than to quietly move the number.
 */
function detectFlag({
  player,
  masteryValue,
  rankedUnavailable,
}: {
  player: BSPlayer;
  masteryValue: number;
  rankedUnavailable: boolean;
}): AccountFlag | null {
  // Without a Ranked history there is no performance signal independent of
  // account size, and every remaining number is investment. Nothing honest can
  // be said, so nothing is.
  if (rankedUnavailable) return null;

  const owned = Math.max(player.brawlers.length, 1);

  // What the account has *put in*: level and roster breadth, plus how far the
  // roster has been taken. None of this is performance.
  const investment = clamp01(
    linear(player.expLevel, 20, 300) * 0.45 +
      linear(owned, 15, 95) * 0.3 +
      masteryValue * 0.25,
  );

  const peakElo = Math.max(
    player.highestAllTimeRankedElo ?? 0,
    player.rankedElo ?? 0,
  );
  const expectedElo = EXPECTED_ELO_FLOOR + investment * EXPECTED_ELO_SPAN;
  const surprise = (peakElo - expectedElo) / ELO_SURPRISE_UNIT;

  if (surprise >= SMURF_SURPRISE && investment <= SMURF_MAX_INVESTMENT) {
    return {
      kind: 'smurf',
      label: 'Likely smurf',
      detail: `Peaked at ${peakElo.toLocaleString('en-US')} elo on a level ${player.expLevel} account with ${owned} brawlers — far above where accounts this size usually land. Either a second account, or someone who already knew the game.`,
    };
  }

  if (surprise >= AHEAD_SURPRISE && investment <= AHEAD_MAX_INVESTMENT) {
    return {
      kind: 'ahead',
      label: 'Ahead of the curve',
      detail: `Ranked results run well ahead of how far this account has been progressed.`,
    };
  }

  if (
    -surprise >= COLLECTOR_SHORTFALL &&
    investment >= COLLECTOR_MIN_INVESTMENT
  ) {
    return {
      kind: 'collector',
      label: 'Collector',
      detail:
        'A fully progressed account whose Ranked results sit well below what that investment usually converts to.',
    };
  }

  return null;
}

/** "MASTERS II" -> "Masters II". Roman numerals stay upper-case. */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .map((word) =>
      /^[ivx]+$/.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}
