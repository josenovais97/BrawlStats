import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  bracketForRankName,
  bracketForTier,
  lobbyTier,
  RANK_BRACKETS,
} from '@/lib/rank-brackets';

test('the four brackets cover tiers 1-22 exactly once, in order', () => {
  let next = 1;
  for (const b of RANK_BRACKETS) {
    assert.equal(b.minTier, next, `${b.slug} starts where the last ended`);
    next = b.maxTier + 1;
  }
  assert.equal(next, 23);
  assert.deepEqual(RANK_BRACKETS.map((b) => b.id), [1, 2, 3, 4]);
});

test('tiers and rank names land in the right bracket', () => {
  assert.equal(bracketForTier(1)?.slug, 'diamond');
  assert.equal(bracketForTier(12)?.slug, 'diamond');
  assert.equal(bracketForTier(13)?.slug, 'mythic');
  assert.equal(bracketForTier(18)?.slug, 'legendary');
  assert.equal(bracketForTier(19)?.slug, 'masters');
  assert.equal(bracketForTier(22)?.slug, 'masters');
  assert.equal(bracketForTier(0), null);
  assert.equal(bracketForTier(23), null);
  assert.equal(bracketForTier(1200), null);
  assert.equal(bracketForRankName('GOLD III')?.slug, 'diamond');
  assert.equal(bracketForRankName('MYTHIC I')?.slug, 'mythic');
  assert.equal(bracketForRankName('Legendary II')?.slug, 'legendary');
  assert.equal(bracketForRankName('PRO')?.slug, 'masters');
  assert.equal(bracketForRankName(null), null);
  assert.equal(bracketForRankName('WOOD'), null);
});

test('a lobby is its median player, robust to one outlier', () => {
  assert.equal(lobbyTier([13, 13, 13, 13, 13, 13]), 13);
  assert.equal(lobbyTier([13, 13, 13, 14, 14, 22]), 14);
  assert.equal(lobbyTier([10, 11, 12]), 11);
  // Too few readable tiers to say.
  assert.equal(lobbyTier([13, null, null, null, 2000, undefined], 6), null);
  assert.equal(lobbyTier([]), null);
});

test("the roll-up's SQL buckets match RANK_BRACKETS", () => {
  const sql = readFileSync('src/lib/aggregation.ts', 'utf8');
  for (const b of RANK_BRACKETS.slice(0, -1)) {
    assert.match(sql, new RegExp(`WHEN lobby_rank <= ${b.maxTier} THEN ${b.id}`), `${b.slug} bound`);
  }
  assert.match(sql, new RegExp(`ELSE ${RANK_BRACKETS[RANK_BRACKETS.length - 1].id}`));
});
