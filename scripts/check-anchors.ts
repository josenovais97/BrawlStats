/*
 * Does the tier list's scale still fit the data it is scoring?
 *
 * `SCORE_ANCHORS` are deliberately absolute, so that a meta score means the
 * same thing from one week to the next. The cost of absolute numbers is that
 * they go stale silently: the population they were measured against moves, the
 * anchors do not, and the tier list keeps rendering a perfectly normal-looking
 * page that is quietly miscalibrated.
 *
 * That is not hypothetical. Measured on 2026-09-24, anchors set before the
 * sampling rate rose eighteenfold had put 42% of the Ranked roster in D and
 * 41% of the trophy roster in S or A, with fifteen brawlers clamped at a pick
 * ceiling the roster had outgrown and three tied at a perfect 10.0. Nothing
 * failed. Nobody was told.
 *
 * So this runs after every sampler run and says so when the distribution has
 * drifted back outside the scale. It never changes anything: rescaling on its
 * own would break the property the anchors exist for.
 */
import { SCORE_ANCHORS, TIER_WINDOWS, getBrawlerStatsForWindow, scoreBrawlers } from '../src/lib/stats';
import type { TierFormat } from '../src/lib/stats';

/** Share of the roster allowed to clamp at either extreme before it is a problem. */
const MAX_CLAMPED = 0.12;

/** Below this many rated brawlers the percentiles are describing noise. */
const MIN_ROSTER = 40;

function quantile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

async function checkFormat(format: TierFormat): Promise<string[]> {
  const problems: string[] = [];
  const anchors = SCORE_ANCHORS[format];

  for (const key of Object.keys(TIER_WINDOWS) as (keyof typeof TIER_WINDOWS)[]) {
    const rows = await getBrawlerStatsForWindow(TIER_WINDOWS[key].days, undefined, format);
    const scored = scoreBrawlers(rows, format).filter((b) => b.tier !== null);
    if (scored.length < MIN_ROSTER) continue;

    const wins = scored
      .map((b) => b.normalizedWinRate)
      .filter((w): w is number => w !== null)
      .sort((a, b) => a - b);
    const picks = scored
      .map((b) => b.usageRate)
      .filter((u): u is number => u !== null && u > 0)
      .sort((a, b) => a - b);
    if (wins.length < MIN_ROSTER || picks.length < MIN_ROSTER) continue;

    const where = `${format}/${key}`;
    const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

    // The anchors are meant to sit OUTSIDE the 5th-95th percentile. When the
    // percentile crosses them, the scale is narrower than the data.
    if (quantile(wins, 0.05) < anchors.winFloor) {
      problems.push(
        `${where}: 5th-percentile adjusted win rate ${pct(quantile(wins, 0.05))} is below winFloor ${pct(anchors.winFloor)}`,
      );
    }
    if (quantile(wins, 0.95) > anchors.winCeiling) {
      problems.push(
        `${where}: 95th-percentile adjusted win rate ${pct(quantile(wins, 0.95))} is above winCeiling ${pct(anchors.winCeiling)}`,
      );
    }
    if (quantile(picks, 0.05) < anchors.pickFloor) {
      problems.push(
        `${where}: 5th-percentile pick rate ${pct(quantile(picks, 0.05))} is below pickFloor ${pct(anchors.pickFloor)}`,
      );
    }
    if (quantile(picks, 0.95) > anchors.pickCeiling) {
      problems.push(
        `${where}: 95th-percentile pick rate ${pct(quantile(picks, 0.95))} is above pickCeiling ${pct(anchors.pickCeiling)}`,
      );
    }

    // And the symptom that is visible on the page: ties at the extremes.
    const clamped = scored.filter(
      (b) =>
        (b.usageRate !== null && b.usageRate >= anchors.pickCeiling) ||
        (b.usageRate !== null && b.usageRate > 0 && b.usageRate <= anchors.pickFloor) ||
        (b.normalizedWinRate !== null && b.normalizedWinRate >= anchors.winCeiling) ||
        (b.normalizedWinRate !== null && b.normalizedWinRate <= anchors.winFloor),
    ).length;
    if (clamped / scored.length > MAX_CLAMPED) {
      problems.push(
        `${where}: ${clamped} of ${scored.length} brawlers (${Math.round((clamped / scored.length) * 100)}%) sit on an anchor and cannot be told apart`,
      );
    }
  }

  return problems;
}

async function main(): Promise<number> {
  const problems = [
    ...(await checkFormat('ranked')),
    ...(await checkFormat('trophy')),
  ];

  if (problems.length === 0) {
    console.log('Meta-score anchors still bracket the distribution.');
    return 0;
  }

  for (const problem of problems) {
    console.error(`::warning::Meta-score anchor drift — ${problem}`);
  }
  console.error(
    '::warning::Re-measure and re-derive SCORE_ANCHORS in lib/stats.ts. A stale anchor renders a normal-looking tier list that is quietly miscalibrated.',
  );
  // A warning, not a failure: the tier list is still usable while drifting, and
  // failing the sampler over calibration would park the roll-up prune over a
  // cosmetic problem.
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`::warning::Anchor check threw: ${err instanceof Error ? err.message : err}`);
    process.exit(0);
  },
);
