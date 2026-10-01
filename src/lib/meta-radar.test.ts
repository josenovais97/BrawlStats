import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type RadarCuts,
  type RadarPoint,
  cellOf,
  deoverlap,
  radarScales,
  radiusFor,
} from '@/lib/meta-radar';

/**
 * The chart sits directly above the lists it is drawn from, so the failure
 * that matters is not an ugly axis — it is the two disagreeing. A brawler in
 * the sleepers corner that the sleepers list does not name, or a cut line
 * drawn somewhere other than where the cut is, discredits both.
 */

const CUTS: RadarCuts = { lowUsage: 0.004, highUsage: 0.012, strong: 0.53, weak: 0.49 };

function point(over: Partial<RadarPoint> = {}): RadarPoint {
  return {
    brawlerId: 1,
    brawlerName: 'SHELLY',
    imageUrl: null,
    metaScore: 0.5,
    usageRate: 0.008,
    winRate: 0.5,
    sampleSize: 500,
    ...over,
  };
}

test('the corners are the same conditions getHiddenMeta selects on', () => {
  /*
   * Mirrors src/lib/hidden-meta.ts:
   *   sleepers  usageRate <= cuts.lowUsage  && metaScore >= cuts.strong
   *   overrated usageRate >= cuts.highUsage && metaScore <= cuts.weak
   * If either filter is ever changed, this fails rather than the chart quietly
   * contradicting the list underneath it.
   */
  assert.equal(cellOf(point({ usageRate: 0.004, metaScore: 0.53 }), CUTS), 'sleeper');
  assert.equal(cellOf(point({ usageRate: 0.012, metaScore: 0.49 }), CUTS), 'overrated');
  assert.equal(cellOf(point({ usageRate: 0.02, metaScore: 0.56 }), CUTS), 'meta');
  assert.equal(cellOf(point({ usageRate: 0.001, metaScore: 0.44 }), CUTS), 'dead');
});

test('the boundary is inclusive on both sides, exactly as the lists are', () => {
  // A brawler sitting on the cut is in the list, so it must be in the corner.
  assert.equal(cellOf(point({ usageRate: 0.004, metaScore: 0.53 }), CUTS), 'sleeper');
  // One hair past it is not.
  assert.equal(cellOf(point({ usageRate: 0.0041, metaScore: 0.53 }), CUTS), 'middle');
  assert.equal(cellOf(point({ usageRate: 0.004, metaScore: 0.5299 }), CUTS), 'middle');
});

test('most of the roster is middle, and that is the honest answer', () => {
  assert.equal(cellOf(point({ usageRate: 0.008, metaScore: 0.51 }), CUTS), 'middle');
});

test('a null pick rate is treated as unpicked, never as missing', () => {
  // `usageRate` is nullable upstream. Falling through to `middle` would put an
  // unrated brawler in the band that says "nothing to see", which is a claim.
  assert.equal(cellOf(point({ usageRate: null, metaScore: 0.56 }), CUTS), 'sleeper');
  assert.equal(cellOf(point({ usageRate: null, metaScore: 0.4 }), CUTS), 'dead');
});

test('both cut lines land inside the plot, whatever the data does', () => {
  // Every point bunched well above the usage cut and below the score cut: the
  // dividers still have to be drawn somewhere on the chart.
  const scales = radarScales(
    [point({ usageRate: 0.05, metaScore: 0.46 }), point({ usageRate: 0.06, metaScore: 0.47 })],
    CUTS,
  )!;
  for (const v of [CUTS.lowUsage, CUTS.highUsage]) {
    const at = scales.x.at(v);
    assert.ok(at >= 0 && at <= 1, `usage cut ${v} maps to ${at}, off the chart`);
  }
  for (const v of [CUTS.weak, CUTS.strong]) {
    const at = scales.y.at(v);
    assert.ok(at >= 0 && at <= 1, `score cut ${v} maps to ${at}, off the chart`);
  }
});

test('nothing is drawn on the frame', () => {
  const points = [point({ usageRate: 0.002, metaScore: 0.45 }), point({ usageRate: 0.03, metaScore: 0.57 })];
  const scales = radarScales(points, CUTS)!;
  for (const p of points) {
    assert.ok(scales.x.at(p.usageRate!) > 0 && scales.x.at(p.usageRate!) < 1);
    assert.ok(scales.y.at(p.metaScore) > 0 && scales.y.at(p.metaScore) < 1);
  }
});

test('the usage axis spreads the crowded low end', () => {
  const scales = radarScales(
    [point({ usageRate: 0.001 }), point({ usageRate: 0.004 }), point({ usageRate: 0.025 })],
    CUTS,
  )!;
  // On a linear axis 0.001 and 0.004 would sit within 12% of each other at
  // opposite ends of a 0.025 span, which is the blob this scale exists to undo.
  const gap = scales.x.at(0.004) - scales.x.at(0.001);
  assert.ok(gap > 0.15, `the two quietest picks are ${gap.toFixed(3)} apart, still a blob`);
});

test('one brawler does not divide by zero', () => {
  const scales = radarScales([point()], CUTS);
  assert.ok(scales);
  assert.ok(Number.isFinite(scales.x.at(0.008)));
  assert.ok(Number.isFinite(scales.y.at(0.5)));
});

test('an empty roster draws nothing rather than an empty grid', () => {
  assert.equal(radarScales([], CUTS), null);
});

test('sample size reads as area, so a floor-sample point looks less certain', () => {
  const big = radiusFor(5000, 5000);
  const small = radiusFor(300, 5000);
  assert.ok(small < big);
  assert.ok(small >= 4, 'still large enough to tap');
  // Area, not radius: a 16x sample is 4x the radius above the floor.
  assert.ok(Math.abs(radiusFor(1250, 5000) - radiusFor(0, 5000) - 9 * 0.5) < 1e-9);
});

const CELL = { x0: 0, y0: 0, x1: 300, y1: 300 };

test('overlapping portraits are pushed apart', () => {
  const out = deoverlap([
    { id: 1, x: 100, y: 100, r: 14, bounds: CELL },
    { id: 2, x: 104, y: 101, r: 14, bounds: CELL },
  ]);
  const d = Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y);
  assert.ok(d >= 28, `still overlapping at ${d.toFixed(1)}px apart`);
});

test('a nudge never moves a point out of its own cell', () => {
  // The constraint the whole thing rests on: position means membership, so a
  // sleeper shoved across the cut line would make the chart contradict the
  // list printed under it.
  const tight = { x0: 0, y0: 0, x1: 60, y1: 60 };
  const out = deoverlap(
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: 30 + i * 0.5,
      y: 30,
      r: 13,
      bounds: tight,
    })),
  );
  for (const p of out) {
    assert.ok(p.x >= tight.x0 && p.x <= tight.x1, `${p.id} escaped horizontally to ${p.x}`);
    assert.ok(p.y >= tight.y0 && p.y <= tight.y1, `${p.id} escaped vertically to ${p.y}`);
  }
});

test('exactly coincident points still separate', () => {
  // Zero distance has no direction to push along; without a fallback the two
  // stay welded together through every iteration.
  const out = deoverlap([
    { id: 1, x: 100, y: 100, r: 12, bounds: CELL },
    { id: 2, x: 100, y: 100, r: 12, bounds: CELL },
  ]);
  assert.ok(Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y) > 1);
});

test('an unsolvable corner terminates instead of hanging', () => {
  // Five portraits that cannot fit in the space available. The real sleepers
  // corner can be exactly this crowded, because low pick rate is what puts
  // them there in the first place.
  const pinhole = { x0: 0, y0: 0, x1: 28, y1: 28 };
  const out = deoverlap(
    Array.from({ length: 5 }, (_, i) => ({ id: i, x: 14, y: 14, r: 13, bounds: pinhole })),
  );
  assert.equal(out.length, 5);
  for (const p of out) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('a point that overlaps nothing is left exactly where it was', () => {
  const out = deoverlap([
    { id: 1, x: 40, y: 40, r: 10, bounds: CELL },
    { id: 2, x: 200, y: 200, r: 10, bounds: CELL },
  ]);
  assert.equal(out[0].x, 40);
  assert.equal(out[0].y, 40);
});

test('the input is not mutated', () => {
  const input = [
    { id: 1, x: 100, y: 100, r: 14, bounds: CELL },
    { id: 2, x: 102, y: 100, r: 14, bounds: CELL },
  ];
  deoverlap(input);
  assert.equal(input[0].x, 100, 'callers re-render from this array');
});
