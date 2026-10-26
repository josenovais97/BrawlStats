import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isOptedOut, optOutHash } from '@/lib/opted-out';

// A made-up tag: the real list must never be spelt out here.
const listed = new Set([optOutHash('2Q0P8VY9L')]);

test('a listed tag matches however it is spelt', () => {
  assert.equal(isOptedOut('#2Q0P8VY9L', listed), true);
  assert.equal(isOptedOut(' #2q0p8vy9l ', listed), true);
  assert.equal(isOptedOut('2QOP8VY9L', listed), true, 'O and 0 are one character in tags');
});

test('everyone else is unaffected', () => {
  assert.equal(isOptedOut('2RLCPVGUG', listed), false);
  assert.equal(isOptedOut('', listed), false);
  assert.equal(isOptedOut(null, listed), false);
  assert.equal(isOptedOut('2RLCPVGUG'), false);
});
