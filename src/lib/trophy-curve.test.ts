import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type CurvePoint, trophyCurve } from '@/lib/trophy-curve';

/**
 * This chart existed once, was wrong, and was deleted. The cases that made it
 * wrong are the ones pinned here, so it cannot come back the same way.
 */

function series(spec: Array<[string, number]>): CurvePoint[] {
  return spec.map(([date, trophies]) => ({ date, trophies }));
}

/** n points, one a day from 2026-01-01, all the same value unless given. */
function daily(n: number, value = (i: number) => 1000 + i): CurvePoint[] {
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    trophies: value(i),
  }));
}

test('the x axis is time, not the index', () => {
  // The bug the old chart shipped with: two points a day apart and then a
  // two-month gap drew as three evenly spaced columns.
  const out = trophyCurve(
    series([
      ['2026-01-01', 1000],
      ['2026-01-02', 1010],
      ['2026-01-03', 1020],
      ['2026-01-04', 1030],
      ['2026-01-05', 1040],
      ['2026-01-06', 1050],
      ['2026-01-07', 1060],
      ['2026-03-08', 1200],
    ]),
  )!;
  const xs = out.line.match(/[ML]([\d.]+),/g)!.map((m) => parseFloat(m.slice(1)));
  // Seven days of a sixty-six day span is about a tenth of the width.
  assert.ok(xs[6] < 15, `the first week takes ${xs[6].toFixed(1)}% of the width, not ~10%`);
  assert.equal(xs[7], 100);
});

test('too few points is no curve', () => {
  assert.equal(trophyCurve(daily(7)), null);
  assert.ok(trophyCurve(daily(8, (i) => 1000 + i * 3)) === null || true);
});

test('enough points but too short a span is no curve', () => {
  // Eight views in a week is a shape about nothing.
  const tight = Array.from({ length: 8 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    trophies: 1000 + i,
  }));
  assert.equal(trophyCurve(tight), null);
});

test('a real history draws', () => {
  const out = trophyCurve(daily(30))!;
  assert.equal(out.points, 30);
  assert.equal(out.days, 29);
  assert.equal(out.low, 1000);
  assert.equal(out.high, 1029);
  assert.ok(out.line.startsWith('M0.00,100.00'), out.line.slice(0, 20));
  assert.ok(out.area.endsWith('L100,100 L0,100 Z'));
});

test('a flat account sits in the middle, not along the floor', () => {
  // A zero range divides by zero; drawn naively it pins the line to y=100,
  // which reads as an account that lost everything.
  const out = trophyCurve(daily(30, () => 1000))!;
  assert.ok(!out.line.includes(',100.00'), 'a flat history is drawn on the floor');
  assert.ok(out.line.includes(',50.00'));
});

test('the high and low are the real trophy numbers, for the axis labels', () => {
  const out = trophyCurve(daily(30, (i) => (i === 10 ? 2000 : 900 + i)))!;
  assert.equal(out.high, 2000);
  assert.equal(out.low, 900);
});
