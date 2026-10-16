import assert from 'node:assert/strict';
import { test } from 'node:test';

import { standingLabel, valuePercentile } from '@/lib/account-value';

const dist = { population: 1000, cuts: Array.from({ length: 101 }, (_, i) => i * 10_000) };

test('interpolates between cut points', () => {
  assert.equal(valuePercentile(500_000, dist), 0.5);
  assert.ok(Math.abs(valuePercentile(505_000, dist) - 0.505) < 1e-9);
});

test('clamps outside the sampled range', () => {
  assert.equal(valuePercentile(-5, dist), 0);
  assert.equal(valuePercentile(5_000_000, dist), 1);
});

test('flat stretches do not divide by zero', () => {
  const flat = { population: 10, cuts: [0, 100, 100, 100, 200] };
  assert.ok(Number.isFinite(valuePercentile(100, flat)));
});

test('the top tenth says "top N%", never "top 0%"', () => {
  assert.deepEqual(standingLabel(0.97), { top: true, value: 3 });
  assert.deepEqual(standingLabel(0.999), { top: true, value: 1 });
  assert.deepEqual(standingLabel(0.62), { top: false, value: 62 });
});
