import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankProgress } from '@/lib/ranked-elo';

test('an elo inside a rank reports the next rank and the gap', () => {
  const p = rankProgress(5234)!;
  assert.equal(p.rank, 'Mythic II');
  assert.equal(p.next, 'Mythic III');
  assert.equal(p.toNext, 266);
  assert.ok(Math.abs(p.share - 0.468) < 0.001);
});

test('a boundary belongs to the rank it starts', () => {
  assert.equal(rankProgress(6750)!.rank, 'Legendary II');
  assert.equal(rankProgress(6749)!.rank, 'Legendary I');
  assert.equal(rankProgress(0)!.rank, 'Bronze I');
});

test('Pro is the top: no next rank, a full bar', () => {
  const p = rankProgress(11941)!;
  assert.equal(p.rank, 'Pro');
  assert.equal(p.next, null);
  assert.equal(p.toNext, null);
  assert.equal(p.share, 1);
});

test('no elo, no progress', () => {
  assert.equal(rankProgress(null), null);
  assert.equal(rankProgress(undefined), null);
});
