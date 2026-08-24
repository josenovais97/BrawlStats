import assert from 'node:assert/strict';
import { test } from 'node:test';

import { windowStartUtc } from '@/lib/stats';

/**
 * The cutoff every roll-up read is bounded by.
 *
 * These became `DATE` columns when the roll-ups landed, and comparing a
 * timestamp against a date is a bug that hides: Postgres widens the date to
 * midnight, so `day >= now() - 7 days` quietly drops the oldest day for any
 * request made after 00:00, and the window keeps narrowing as the day goes on.
 * A tier list rendered at 23:00 would measure less data than the same list at
 * 01:00, from identical data, with nothing anywhere reporting a problem.
 */

const DAY = 86_400_000;

function todayUtcMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

test('always lands on UTC midnight', () => {
  // The whole point: a value carrying a time-of-day would reintroduce the
  // drift this function exists to remove.
  for (const days of [1, 7, 14, 21, 30, 90]) {
    const start = windowStartUtc(days);
    assert.equal(start.getUTCHours(), 0);
    assert.equal(start.getUTCMinutes(), 0);
    assert.equal(start.getUTCSeconds(), 0);
    assert.equal(start.getUTCMilliseconds(), 0);
  }
});

test('covers exactly the number of days asked for, today included', () => {
  for (const days of [1, 7, 21, 30]) {
    const covered = (todayUtcMidnight() - windowStartUtc(days).getTime()) / DAY + 1;
    assert.equal(covered, days, `windowStartUtc(${days}) covered ${covered} days`);
  }
});

test('a one-day window is today', () => {
  assert.equal(windowStartUtc(1).getTime(), todayUtcMidnight());
});

test('a longer window always starts earlier', () => {
  // Guards the off-by-one directly: windowStartUtc(n+1) must reach back
  // exactly one further day than windowStartUtc(n), never the same day.
  for (let days = 1; days < 40; days += 1) {
    const gap = windowStartUtc(days).getTime() - windowStartUtc(days + 1).getTime();
    assert.equal(gap, DAY, `windows of ${days} and ${days + 1} days differ by ${gap}ms`);
  }
});

test('the site’s real windows stay inside what the prune keeps', () => {
  /*
   * RANKED_MAP_WINDOW_DAYS is 21 and the tier list offers 30, against roll-up
   * retention of 30 days (and 22 for the pairing tables). Asking for more than
   * is kept does not error — it silently returns a thinner answer, which is
   * how the old "30d" option came to be quietly reading 24 days.
   */
  const OLDEST_ROLLUP_DAY = 30;
  for (const days of [7, 21, 30]) {
    const reachBack = (todayUtcMidnight() - windowStartUtc(days).getTime()) / DAY;
    assert.ok(
      reachBack <= OLDEST_ROLLUP_DAY,
      `a ${days}-day window reaches back ${reachBack} days, past the ${OLDEST_ROLLUP_DAY} kept`,
    );
  }
});
