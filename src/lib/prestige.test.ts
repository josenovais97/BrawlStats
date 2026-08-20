import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PRESTIGE_TIERS, prestigeTier } from '@/lib/prestige';

/**
 * The badge shown for a total prestige level.
 *
 * Every one of these is a boundary, which is the only interesting part: a
 * total of 24 and a total of 25 are one apart and wear different badges, and
 * an off-by-one here is invisible on the page — it just quietly shows the
 * wrong award.
 */
test('each milestone starts exactly at its own number', () => {
  for (const tier of PRESTIGE_TIERS) {
    assert.equal(prestigeTier(tier), tier, `${tier} should earn the ${tier} badge`);
  }
});

test('a total between milestones keeps the lower badge', () => {
  const cases: [number, number][] = [
    [1, 1],
    [24, 1],
    [25, 25],
    [49, 25],
    [50, 50],
    [99, 50],
    [100, 100],
    [199, 100],
    [200, 200],
    [10_000, 200],
  ];

  for (const [total, expected] of cases) {
    assert.equal(prestigeTier(total), expected, `total ${total}`);
  }
});

test('nothing is awarded below the first milestone', () => {
  // The API reports 0 for an account that has never prestiged.
  assert.equal(prestigeTier(0), null);
  assert.equal(prestigeTier(-5), null);
  assert.equal(prestigeTier(undefined), null);
  assert.equal(prestigeTier(null), null);
  assert.equal(prestigeTier(Number.NaN), null);
});

test('the milestones stay in descending order', () => {
  // `prestigeTier` picks the first threshold at or below the total, which is
  // only the highest one earned while this list descends.
  const sorted = [...PRESTIGE_TIERS].sort((a, b) => b - a);
  assert.deepEqual([...PRESTIGE_TIERS], sorted);
});
