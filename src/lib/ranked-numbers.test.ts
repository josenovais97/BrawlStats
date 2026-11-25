import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RANK_BRACKETS } from '@/lib/rank-brackets';
import { RANK_BRACKET_IDS, RANK_KEYS, addStats, banTiers, isRankKey, numbersOf, rankBy, type RawStats } from '@/lib/ranked-numbers';

const raw = (id: number, over: Partial<RawStats> = {}): RawStats => ({
  id, games: 200, kills: 400, deaths: 200, deathless: 50, stars: 40, damage: 6_000_000, healing: 600_000, seconds: 20_000, ...over,
});

test('every rank choice is a bracket, and Mythic and up is the three above Diamond', () => {
  for (const key of RANK_KEYS.filter((k) => k !== 'mythic-plus')) {
    assert.deepEqual(RANK_BRACKET_IDS[key], [RANK_BRACKETS.find((b) => b.slug === key)!.id]);
  }
  assert.deepEqual(RANK_BRACKET_IDS['mythic-plus'], RANK_BRACKETS.filter((b) => b.slug !== 'diamond').map((b) => b.id));
  assert.ok(isRankKey('masters') && !isRankKey('bronze') && !isRankKey(null));
});

test('numbers are per game, per death and per second', () => {
  const n = numbersOf(raw(1));
  assert.deepEqual([n.kills, n.deaths, n.kd, n.damage, n.healing, n.star, n.deathless], [2, 1, 2, 300, 30, 0.2, 0.25]);
  assert.equal(numbersOf(raw(1, { deaths: 0 })).kd, 400, 'no division by zero');
});

test('modes add up by brawler before anything is divided', () => {
  const [a] = addStats([raw(1), raw(1, { games: 100, kills: 50, deaths: 300, seconds: 10_000, damage: 1_000_000 })]);
  assert.equal(a.games, 300);
  assert.equal(numbersOf(a).kd, 0.9);
});

test('ban tiers cut at 40, 20, 10 and 5 percent', () => {
  const tiers = banTiers([[1, 0.75], [2, 0.4], [3, 0.39], [4, 0.2], [5, 0.1], [6, 0.05], [7, 0.049]]);
  assert.deepEqual(tiers.map((t) => [t.tier, t.items.map(([id]) => id)]), [['S', [1, 2]], ['A', [3, 4]], ['B', [5]], ['C', [6]]]);
});

test('a ranking leaves out thin samples and turns around', () => {
  const rows = [numbersOf(raw(1)), numbersOf(raw(2, { kills: 900 })), numbersOf(raw(3, { games: 20, kills: 900 }))];
  assert.deepEqual(rankBy(rows, 'kills', 'high').map((r) => r.id), [2, 1]);
  assert.deepEqual(rankBy(rows, 'kills', 'low').map((r) => r.id), [1, 2]);
});
