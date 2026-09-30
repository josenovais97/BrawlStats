import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type OwnedBrawler,
  ROSTER_TTL_MS,
  canField,
  isStale,
} from '@/lib/bubble-account';

/**
 * The filter, which decides what the overlay says you can play.
 *
 * Worth testing rather than eyeballing: getting it wrong means telling someone
 * mid-draft that they can pick a brawler they do not own, which is worse than
 * the generic list this replaces — a wrong recommendation costs a game, a
 * generic one only costs a moment.
 */

const owned = new Map<number, OwnedBrawler>([
  [1, { id: 1, power: 11, hypercharge: true }],
  [2, { id: 2, power: 11, hypercharge: false }],
  [3, { id: 3, power: 9, hypercharge: false }],
]);

test('an unowned brawler is never fieldable, under any filter', () => {
  for (const filter of ['all', 'power11', 'hypercharge'] as const) {
    assert.equal(canField(owned, 999, filter), false, filter);
  }
});

test('"all" means owned, not everything', () => {
  assert.equal(canField(owned, 3, 'all'), true);
  assert.equal(canField(owned, 999, 'all'), false);
});

test('power 11 excludes an owned brawler below it', () => {
  assert.equal(canField(owned, 2, 'power11'), true);
  assert.equal(canField(owned, 3, 'power11'), false);
});

test('hypercharge needs both the level and the ability', () => {
  assert.equal(canField(owned, 1, 'hypercharge'), true);
  assert.equal(canField(owned, 2, 'hypercharge'), false, 'power 11, no hypercharge');
  assert.equal(canField(owned, 3, 'hypercharge'), false, 'hypercharge cannot exist below 11');
});

test('the hypercharge filter is strictly narrower than power 11', () => {
  /*
   * Relied on by the panel, which checks one filter rather than combining
   * them. If this ever stopped holding, "power 11 with hypercharge" could let
   * through something "power 11" rejected.
   */
  for (const id of owned.keys()) {
    if (canField(owned, id, 'hypercharge')) {
      assert.equal(canField(owned, id, 'power11'), true, `brawler ${id}`);
    }
  }
});

test('a roster goes stale after a day, not before', () => {
  const now = 1_800_000_000_000;
  const fresh = { tag: 'ABC', name: 'x', brawlers: [], fetchedAt: now };
  assert.equal(isStale(fresh, now), false);
  assert.equal(isStale(fresh, now + ROSTER_TTL_MS - 1), false);
  assert.equal(isStale(fresh, now + ROSTER_TTL_MS + 1), true);
});
