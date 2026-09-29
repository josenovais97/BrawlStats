import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type BrawldleBrawler,
  answerFor,
  compareGuess,
  dayIndex,
  pickBand,
  shareGrid,
} from '@/lib/brawldle';

/**
 * The puzzle's logic, which has to be right before anyone plays it.
 *
 * A wrong clue in a guessing game is not a cosmetic bug: the player reasons
 * from it, gets a contradiction, and concludes the game is broken. There is no
 * graceful degradation, which is why this is tested rather than eyeballed.
 */

const make = (over: Partial<BrawldleBrawler> & { id: number }): BrawldleBrawler => ({
  name: `B${over.id}`,
  slug: `b${over.id}`,
  imageUrl: null,
  rarity: 'Epic',
  className: 'Assassin',
  tier: 'B',
  usageRate: 0.015,
  ...over,
});

const roster = Array.from({ length: 40 }, (_unused, i) => make({ id: 16_000_000 + i }));

test('the answer is a pure function of the date', () => {
  const a = answerFor('2026-09-29', roster);
  const b = answerFor('2026-09-29', roster);
  assert.equal(a?.id, b?.id);
});

test('the answer moves from one day to the next', () => {
  // Not guaranteed for every pair by definition, but a run of consecutive days
  // landing on one brawler would mean the mix is not mixing.
  const ids = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'].map(
    (d) => answerFor(d, roster)?.id,
  );
  assert.equal(new Set(ids).size, ids.length);
});

test('it does not pick the same brawler as a plain day-index rotation', () => {
  /*
   * The reason fmix32 is there at all. `brawlerOfDay` uses `dayIndex % length`,
   * and if this used the same the puzzle answer would be the brawler whose
   * build was posted to TikTok that morning.
   */
  let collisions = 0;
  for (let d = 0; d < 120; d += 1) {
    const date = new Date((20_000 + d) * 86_400_000).toISOString().slice(0, 10);
    const plain = roster[dayIndex(date) % roster.length];
    if (answerFor(date, roster)?.id === plain.id) collisions += 1;
  }
  // One in forty by chance over 120 days is ~3. Ten would mean correlation.
  assert.ok(collisions < 10, `too many collisions with the plain rotation: ${collisions}`);
});

test('an empty roster has no answer rather than throwing', () => {
  assert.equal(answerFor('2026-09-29', []), null);
});

test('guessing the answer is correct on every clue', () => {
  const answer = make({ id: 16_000_010 });
  const result = compareGuess(answer, answer);
  assert.equal(result.correct, true);
  assert.ok(result.clues.every((c) => c.verdict === 'hit'));
  assert.ok(result.clues.every((c) => c.direction === null));
});

test('rarity one step apart is near, and points the right way', () => {
  const guess = make({ id: 1, rarity: 'Rare' });
  const answer = make({ id: 2, rarity: 'Super Rare' });
  const rarity = compareGuess(guess, answer).clues.find((c) => c.key === 'rarity');
  assert.equal(rarity?.verdict, 'near');
  assert.equal(rarity?.direction, 'up');
});

test('rarity far apart is a miss, still with a direction', () => {
  const guess = make({ id: 1, rarity: 'Legendary' });
  const answer = make({ id: 2, rarity: 'Common' });
  const rarity = compareGuess(guess, answer).clues.find((c) => c.key === 'rarity');
  assert.equal(rarity?.verdict, 'miss');
  assert.equal(rarity?.direction, 'down');
});

test('class never carries a direction, because it has no order', () => {
  const guess = make({ id: 1, className: 'Tank' });
  const answer = make({ id: 2, className: 'Marksman' });
  const cls = compareGuess(guess, answer).clues.find((c) => c.key === 'class');
  assert.equal(cls?.verdict, 'miss');
  assert.equal(cls?.direction, null);
});

test('release order points toward the answer', () => {
  const guess = make({ id: 16_000_005 });
  const answer = make({ id: 16_000_090 });
  const rel = compareGuess(guess, answer).clues.find((c) => c.key === 'released');
  assert.equal(rel?.direction, 'up');
  assert.equal(rel?.verdict, 'miss');
});

test('a release within five is near', () => {
  const rel = compareGuess(make({ id: 16_000_005 }), make({ id: 16_000_009 })).clues.find(
    (c) => c.key === 'released',
  );
  assert.equal(rel?.verdict, 'near');
});

test('an unranked brawler is a miss with no direction, not a crash', () => {
  const guess = make({ id: 1, tier: null, usageRate: null });
  const answer = make({ id: 2, tier: 'S', usageRate: 0.04 });
  const result = compareGuess(guess, answer);
  const tier = result.clues.find((c) => c.key === 'tier');
  const picked = result.clues.find((c) => c.key === 'picked');
  assert.equal(tier?.verdict, 'miss');
  assert.equal(tier?.direction, null);
  assert.equal(picked?.verdict, 'miss');
  assert.equal(picked?.direction, null);
});

test('pick rate is banded, so near numbers can actually match', () => {
  assert.equal(pickBand(0.019), pickBand(0.012));
  assert.notEqual(pickBand(0.004), pickBand(0.02));
  assert.equal(pickBand(null), null);
});

test('every guess produces exactly five clues, in a stable order', () => {
  const clues = compareGuess(make({ id: 1 }), make({ id: 2 })).clues;
  assert.deepEqual(
    clues.map((c) => c.key),
    ['rarity', 'class', 'released', 'tier', 'picked'],
  );
});

test('the share grid marks a solve and a failure differently', () => {
  const answer = make({ id: 16_000_010 });
  const solved = shareGrid([compareGuess(answer, answer)], '2026-09-29');
  assert.match(solved, /1\/∞/);
  // The `u` flag is load-bearing: 🟩 is a surrogate pair, so without it `{5}`
  // quantifies the second half of the emoji rather than the emoji.
  assert.match(solved, /🟩{5}/u);

  const failed = shareGrid([compareGuess(make({ id: 1, rarity: 'Common' }), answer)], '2026-09-29');
  assert.match(failed, / X$|— X/);
});

test('the share grid never leaks the answer', () => {
  const answer = make({ id: 16_000_010, name: 'SECRETBRAWLER' });
  const text = shareGrid([compareGuess(make({ id: 1 }), answer), compareGuess(answer, answer)], '2026-09-29');
  assert.ok(!text.includes('SECRETBRAWLER'), 'the grid must be safe to paste before others have played');
});
