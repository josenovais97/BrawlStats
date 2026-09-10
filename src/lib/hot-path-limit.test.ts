import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BURST,
  ClientBuckets,
  MAX_CLIENTS,
  PER_CLIENT_BURST,
  REFILL_PER_SECOND,
  createBucket,
  isLimitedPath,
  limitedPrefix,
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

test('a flood on one prefix does not refuse another', () => {
  // The failure this exists for: a crawler walking /draft at fifty requests a
  // second took 2,747 of every 3,000 responses, and readers opening a profile
  // were refused for traffic that was nothing to do with them.
  const draft = createBucket(0);
  const player = createBucket(0);
  for (let i = 0; i < BURST * 3; i += 1) take(draft, 0);

  assert.equal(take(draft, 0), false, '/draft is exhausted, as intended');
  assert.ok(take(player, 0), '/player must be unaffected');
});

test('prefixes are told apart', () => {
  assert.equal(limitedPrefix('/player/2VLR2JJLJL'), '/player/');
  assert.equal(limitedPrefix('/draft/gem-grab/undermine/13'), '/draft/');
  assert.equal(limitedPrefix('/tier-list/ranked'), null);
});

test('one client cannot drink a prefix dry', () => {
  const clients = new ClientBuckets();
  let noisy = 0;
  while (clients.take('1.2.3.4', 0)) noisy += 1;
  assert.equal(noisy, PER_CLIENT_BURST, 'the loud client is capped at its burst');
  assert.ok(clients.take('5.6.7.8', 0), 'a quiet client is still served');
});

test('the client table cannot grow without bound', () => {
  const clients = new ClientBuckets();
  for (let i = 0; i < MAX_CLIENTS + 500; i += 1) clients.take(`ip-${i}`, 0);
  assert.ok(
    clients.size <= MAX_CLIENTS,
    `client table grew to ${clients.size}; a map the internet can add keys to must be bounded`,
  );
});
