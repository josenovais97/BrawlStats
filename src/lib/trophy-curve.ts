/**
 * The trophy history as a drawable curve.
 *
 * There used to be a chart here and it was removed for two good reasons, both
 * of which this has to answer before it earns its place back.
 *
 * The first was that it plotted points by *index*: a two-month gap between
 * views drew the same width as two consecutive days, so the shape was not thin
 * but actively misleading. The x axis here is time, which is the only honest
 * way to draw a series recorded at irregular intervals — gaps look like gaps.
 *
 * The second was that a typical account has a handful of points and no shape
 * worth plotting, because history only accumulates on the days somebody viewed
 * the profile. That one is not fixable, so it is gated instead: below
 * `MIN_POINTS` over `MIN_SPAN_DAYS` there is no curve, and the figures beside
 * it carry the answer on their own. A chart that appears only when it has
 * something to say is better than one that is always there and usually a flat
 * line between two dots.
 */

export interface CurvePoint {
  date: string;
  trophies: number;
}

/** Below this there is no shape, only dots joined up. */
const MIN_POINTS = 8;

/** And below this the dots are too close together for the span to mean much. */
const MIN_SPAN_DAYS = 14;

export interface TrophyCurve {
  /** `d` for the line, in a 0-100 x 0-100 viewBox. */
  line: string;
  /** The same path closed to the baseline, for the fill underneath. */
  area: string;
  low: number;
  high: number;
  firstDate: string;
  lastDate: string;
  days: number;
  points: number;
}

export function trophyCurve(points: CurvePoint[]): TrophyCurve | null {
  if (points.length < MIN_POINTS) return null;

  const times = points.map((p) => Date.parse(p.date));
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const span = t1 - t0;
  const days = Math.round(span / 86_400_000);
  if (!Number.isFinite(span) || days < MIN_SPAN_DAYS) return null;

  const values = points.map((p) => p.trophies);
  const low = Math.min(...values);
  const high = Math.max(...values);
  /*
   * A flat account would divide by zero and, worse, would draw a line along
   * the very bottom of the box as though it had collapsed. A zero range is
   * pinned to the middle instead.
   */
  const range = high - low;

  const xy = points.map((p, i) => {
    const x = (times[i] - t0) / span * 100;
    const y = range === 0 ? 50 : 100 - ((p.trophies - low) / range) * 100;
    return [x, y] as const;
  });

  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

  return {
    line,
    area: `${line} L100,100 L0,100 Z`,
    low,
    high,
    firstDate: points[0].date,
    lastDate: points[points.length - 1].date,
    days,
    points: points.length,
  };
}
