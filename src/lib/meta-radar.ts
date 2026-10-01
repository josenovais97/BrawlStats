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
 * Whether this point sits in a labelled corner.
 *
 * Every point carries a face now, so this no longer decides *whether* a
 * brawler is drawn as itself -- it decides emphasis: the corners get the
 * larger portrait, the coloured ring, the space reserved by the de-overlap
 * pass, and the top of the paint order.
 *
 * It went through two wrong answers first, both worth keeping written down.
 * The first left `dead` out because "out of favour" is the least interesting
 * of the four lists, which was a judgement about content applied to rendering
 * -- a labelled quadrant with no faces in it reads as broken, not as dull. The
 * second kept the unnamed middle as plain dots on the grounds that nobody
 * needs to identify them. Also wrong: a reader scanning for one brawler does
 * not know in advance which cell it is in, and a chart that can answer "where
 * am I" for 34 of 85 cannot answer it at all.
 */
export function isNamed(cell: RadarCell): boolean {
  return cell !== 'middle';
}

/**
 * Radius for a point in the unnamed middle.
 *
 * Smaller than a corner portrait and drawn under it, so the hierarchy survives
 * showing everybody: these are recognisable when looked for without competing
 * with the brawlers the chart is actually making a claim about.
 */
export function middleRadius(sampleSize: number, max: number): number {
  return radiusFor(sampleSize, max, 9, 5);
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

export interface Placeable {
  id: number;
  x: number;
  y: number;
  r: number;
  /**
   * The cell this point belongs to, in pixels. A nudge may not leave it.
   *
   * This is the constraint that makes moving points at all defensible. The
   * whole claim of the chart is that position means membership, so a sleeper
   * pushed a few pixels across the cut line is no longer in the corner the
   * list under it says it is in — the picture would contradict the page to
   * make itself prettier. Null means unconstrained.
   */
  bounds: { x0: number; y0: number; x1: number; y1: number } | null;
}

/**
 * Nudge overlapping portraits apart, without letting any leave its cell.
 *
 * Measured on the live chart: the five sleepers landed within a few pixels of
 * each other and drew as one unreadable pile — which is the single group this
 * whole picture exists to show. Low pick rate is what makes a brawler a
 * sleeper, so they are crowded against the left edge *by definition*; this is
 * not bad luck on one day's data, it is the permanent shape of the corner.
 *
 * Plain pairwise repulsion, run to a fixed iteration count rather than to
 * convergence. A crowded corner may be genuinely unsolvable — five circles
 * will not fit in a space big enough for three — and a loop that ran until
 * nothing overlapped would hang on exactly the day the chart is most
 * interesting. Fixed work, best effort, always terminates.
 */
export function deoverlap(items: Placeable[], iterations = 80): Placeable[] {
  const out = items.map((i) => ({ ...i }));

  const clamp = (p: Placeable) => {
    if (!p.bounds) return;
    // Inset by the radius, so a point is never drawn half outside its cell.
    p.x = Math.min(Math.max(p.x, p.bounds.x0 + p.r), Math.max(p.bounds.x0 + p.r, p.bounds.x1 - p.r));
    p.y = Math.min(Math.max(p.y, p.bounds.y0 + p.r), Math.max(p.bounds.y0 + p.r, p.bounds.y1 - p.r));
  };

  for (let step = 0; step < iterations; step += 1) {
    let moved = false;

    for (let a = 0; a < out.length; a += 1) {
      for (let b = a + 1; b < out.length; b += 1) {
        const p = out[a];
        const q = out[b];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        /* A hair of padding, so touching circles still read as two. */
        const want = p.r + q.r + 2;
        const dist = Math.hypot(dx, dy);
        if (dist >= want) continue;

        moved = true;
        // Exactly coincident points have no direction to separate along, so
        // pick one. Without this they stay welded together forever.
        const ux = dist === 0 ? 1 : dx / dist;
        const uy = dist === 0 ? 0 : dy / dist;
        const push = (want - dist) / 2;

        p.x -= ux * push;
        p.y -= uy * push;
        q.x += ux * push;
        q.y += uy * push;
        clamp(p);
        clamp(q);
      }
    }

    if (!moved) break;
  }

  return out;
}
