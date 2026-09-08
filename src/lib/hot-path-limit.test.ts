import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BURST,
  REFILL_PER_SECOND,
  createBucket,
  isLimitedPath,
  retryAfter,
  take,
} from '@/lib/hot-path-limit';

/**
 * The arithmetic the outage mitigation rests on.
 *
 * These are pinned because the failure is silent in both directions: a bucket
 * that never refills throttles the site to nothing and every page still returns
 * a valid response, and one that refills too fast protects nothing while
 * looking exactly like one that works.
 */

test('only the routes that render per request are covered', () => {
  assert.ok(isLimitedPath('/player/2VLR2JJLJL'));
  assert.ok(isLimitedPath('/draft/gem-grab/undermine/13/x/65'));
  assert.ok(isLimitedPath('/wrapped/abc'));
  assert.ok(!isLimitedPath('/'), 'the home page is cached');
  assert.ok(!isLimitedPath('/tier-list/ranked'), 'tier lists are cached');
  assert.ok(!isLimitedPath('/draft'), 'the empty helper is one cached page');
});

test('a burst is allowed, and then it is not', () => {
  const bucket = createBucket(0);
  for (let i = 0; i < BURST; i += 1) {
    assert.ok(take(bucket, 0), `request ${i + 1} of the burst should pass`);
  }
  assert.equal(take(bucket, 0), false, 'one past the burst is refused');
});

test('tokens come back at the stated rate', () => {
  const bucket = createBucket(0);
  for (let i = 0; i < BURST; i += 1) take(bucket, 0);
  assert.equal(take(bucket, 0), false);

  // One second later, exactly REFILL_PER_SECOND requests get through.
  for (let i = 0; i < REFILL_PER_SECOND; i += 1) {
    assert.ok(take(bucket, 1000), `refilled request ${i + 1} should pass`);
  }
  assert.equal(take(bucket, 1000), false, 'and no more than that');
});

test('a quiet hour does not bank an hour of flood', () => {
  const bucket = createBucket(0);
  for (let i = 0; i < BURST; i += 1) take(bucket, 0);

  let passed = 0;
  while (take(bucket, 3_600_000)) passed += 1;
  assert.equal(passed, BURST, 'refill is capped at the burst, not the elapsed time');
});

test('sustained load settles at the refill rate, not above it', () => {
  const bucket = createBucket(0);
  let passed = 0;
  // Ten seconds of a scraper asking twenty times a second.
  for (let ms = 0; ms < 10_000; ms += 50) {
    if (take(bucket, ms)) passed += 1;
  }
  const expected = BURST + (10_000 / 1000) * REFILL_PER_SECOND;
  assert.ok(
    Math.abs(passed - expected) <= 1,
    `expected about ${expected} to pass, got ${passed}`,
  );
});

test('retry-after is a whole number of seconds and never zero', () => {
  const bucket = createBucket(0);
  for (let i = 0; i < BURST; i += 1) take(bucket, 0);
  const wait = retryAfter(bucket);
  assert.ok(Number.isInteger(wait) && wait >= 1, `got ${wait}`);
});
