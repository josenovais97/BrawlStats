/**
 * The meta as a picture: every rated brawler placed by how often it is taken
 * against how well it does.
 *
 * The four lists on `/hidden-meta` are the four corners of this plot. They
 * already answer "who is strong that nobody plays" and "who does everybody
 * play that is not strong" — what they cannot show is the shape of the
 * distribution those answers were selected out of, or how close the runners-up
 * came. A sleeper three battles from the cut reads identically to one in a
 * class of its own when both are a row in a list.
 *
 * **The quadrant lines are not drawn by eye.** They are the same percentile
 * cuts `getHiddenMeta` already computes, so a brawler sits in the "sleepers"
 * corner of this chart exactly when it is eligible for the sleepers list
 * beside it. A chart that disagreed with the list under it would be worse than
 * no chart, and the only way to guarantee it cannot is to take the numbers
 * rather than reproduce them.
 *
 * Three bands per axis rather than two, for the same reason the cuts are
 * percentiles: between `weak` and `strong` is a middle where no claim is being
 * made, and a 2x2 grid would have to pretend a line down the centre means
 * something. Most of the roster lives in that middle, and saying so is the
 * honest version of this picture.
 */

export interface RadarPoint {
  brawlerId: number;
  brawlerName: string;
  imageUrl: string | null;
  metaScore: number;
  usageRate: number | null;
  winRate: number | null;
  sampleSize: number;
}

export interface RadarCuts {
  lowUsage: number;
  highUsage: number;
  strong: number;
  weak: number;
}

/**
 * Which of the nine cells a brawler falls in.
 *
 * `sleeper` and `overrated` are the two the page names, and their definitions
 * here are character-for-character the filters in `getHiddenMeta` — see the
 * test that holds them together.
 */
export type RadarCell = 'sleeper' | 'overrated' | 'meta' | 'dead' | 'middle';

export function cellOf(point: RadarPoint, cuts: RadarCuts): RadarCell {
  const usage = point.usageRate ?? 0;
  const score = point.metaScore;

  if (usage <= cuts.lowUsage && score >= cuts.strong) return 'sleeper';
  if (usage >= cuts.highUsage && score <= cuts.weak) return 'overrated';
  if (usage >= cuts.highUsage && score >= cuts.strong) return 'meta';
  if (usage <= cuts.lowUsage && score <= cuts.weak) return 'dead';
  return 'middle';
}

export interface RadarScale {
  min: number;
  max: number;
  /** 0-1 across the plot. */
  at: (value: number) => number;
}

/**
 * Square-root on the usage axis.
 *
 * Pick rate is skewed: measured on the live roster it runs from about 0.1% to
 * a couple of percent, so on a linear axis two thirds of the roster — and
 * every sleeper, by definition — piles into the left-hand sixth of the chart
 * and overlaps into one blob. A square root spreads the crowded low end
 * without the dishonesty of a log axis, where equal distances stop meaning
 * equal differences at all.
 *
 * The axis is still labelled in real percentages, so the reader is never asked
 * to interpret the transform.
 */
function sqrtScale(min: number, max: number): RadarScale {
  const lo = Math.sqrt(Math.max(0, min));
  const hi = Math.sqrt(Math.max(0, max));
  const span = hi - lo;
  return {
    min,
    max,
    at: (value) =>
      span === 0 ? 0.5 : (Math.sqrt(Math.max(0, value)) - lo) / span,
  };
}

function linearScale(min: number, max: number): RadarScale {
  const span = max - min;
  return { min, max, at: (value) => (span === 0 ? 0.5 : (value - min) / span) };
}

/**
 * Domains that always contain every point *and* every cut line.
 *
 * The cut lines are percentiles of the same data, so they are inside the
 * range by construction today — but a future change to how either is computed
 * could put one outside it, and a quadrant divider drawn off the edge of the
 * chart turns the whole picture into a lie that still renders. Including them
 * explicitly costs one `Math.min`.
 */
export function radarScales(
  points: RadarPoint[],
  cuts: RadarCuts,
): { x: RadarScale; y: RadarScale } | null {
  if (points.length === 0) return null;

  const usages = points.map((p) => p.usageRate ?? 0);
  const scores = points.map((p) => p.metaScore);

  const xMin = Math.min(...usages, cuts.lowUsage);
  const xMax = Math.max(...usages, cuts.highUsage);
  const yMin = Math.min(...scores, cuts.weak);
  const yMax = Math.max(...scores, cuts.strong);

  /* A flat 4% of the span, so no point is drawn on the frame itself. */
  const pad = (lo: number, hi: number) => (hi - lo) * 0.04 || 0.001;

  return {
    x: sqrtScale(Math.max(0, xMin - pad(xMin, xMax)), xMax + pad(xMin, xMax)),
    y: linearScale(yMin - pad(yMin, yMax), yMax + pad(yMin, yMax)),
  };
}

/**
 * Bubble radius from sample size, so the noisy points look noisy.
 *
 * This is the part a scatter plot of win rates most needs and most often
 * leaves out. Everything here clears 300 decided battles, but a brawler at the
 * floor has a far wider true interval than one with five thousand, and drawn
 * as identical dots the two make equally confident claims. Square root again,
 * because area is what the eye reads as quantity.
 */
export function radiusFor(sampleSize: number, max: number, min = 4, span = 9): number {
  if (max <= 0) return min;
  return min + span * Math.sqrt(Math.min(1, sampleSize / max));
}

/**
 * Whether this point is one of the ones the page names, and so worth a face.
 *
 * Measured on the live roster: 51 of 85 brawlers sit in the middle, 15 are out
 * of favour, and only 19 are in a corner the page makes a claim about. Drawing
 * a portrait on all 85 would be unreadable -- the smallest bubbles are eight
 * pixels across and a face at that size is a smudge -- and drawing one on the
 * out-of-favour fifteen spends the chart's attention on its least interesting
 * answer. Nineteen faces is the number that fits.
 */
export function isNamed(cell: RadarCell): boolean {
  return cell === 'sleeper' || cell === 'overrated' || cell === 'meta';
}

/**
 * Radius for a point that carries a portrait.
 *
 * Still scaled by sample, so a named brawler with five thousand battles is
 * visibly a bigger claim than one at the floor -- but floored at a size a face
 * survives. Without the floor the chart would be honest and illegible, which
 * on a picture whose whole job is to be read at a glance is the wrong trade.
 */
export function portraitRadius(sampleSize: number, max: number): number {
  return radiusFor(sampleSize, max, 13, 7);
}
