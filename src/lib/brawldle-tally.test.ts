import assert from 'node:assert/strict';
import { test } from 'node:test';

import { summarize, tallyBucket } from '@/lib/brawldle-tally';

test('a picture puzzle is solved in one to six guesses, or lost at six', () => {
  assert.equal(tallyBucket('zoom', true, 1), 1);
  assert.equal(tallyBucket('shadow', true, 6), 6);
  assert.equal(tallyBucket('zoom', false, 6), 0);
  assert.equal(tallyBucket('zoom', true, 7), null);
  assert.equal(tallyBucket('zoom', false, 3), null);
});

test('the classic board can only be solved, and not in an absurd number of guesses', () => {
  assert.equal(tallyBucket('classic', true, 12), 12);
  assert.equal(tallyBucket('classic', false, 12), null);
  assert.equal(tallyBucket('classic', true, 400), null);
});

test('junk is refused', () => {
  assert.equal(tallyBucket('daily', true, 2), null);
  assert.equal(tallyBucket('zoom', true, 0), null);
  assert.equal(tallyBucket('zoom', true, 2.5), null);
});

test('summarize counts losses as players but not in the average', () => {
  const t = summarize([
    { mode: 'zoom', guesses: 2, count: 3 },
    { mode: 'zoom', guesses: 5, count: 1 },
    { mode: 'zoom', guesses: 0, count: 4 },
    { mode: 'nonsense', guesses: 1, count: 9 },
  ]);
  assert.deepEqual(t.zoom, { players: 8, solved: 4, average: 2.8 });
  assert.deepEqual(t.classic, { players: 0, solved: 0, average: null });
});
