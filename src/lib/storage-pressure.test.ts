import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DATA_BUDGET_BYTES, pressureFor } from '@/lib/aggregation';

/**
 * The storage valve, which is the one piece of this project that deletes data
 * on its own.
 *
 * Worth pinning because the failure is silent and expensive in both
 * directions. Too eager and it spends accuracy the database could afford — the
 * pairing window drops to 10 days and every matchup on the site thins for no
 * reason. Too slow and it defends nothing: on 2026-08-24 the database reached
 * 98% of its plan, and getting the space back needed a VACUUM FULL, which
 * needs free space to copy into and therefore stops being possible exactly
 * when it is most needed.
 *
 * The numbers below are derived rather than transcribed, so a deliberate
 * change to the budget keeps them honest and an accidental one still fails.
 */

const MB = 1024 * 1024;
/*
 * Imported, not transcribed. This was a copy of the two constants, which meant
 * the comment above ("derived rather than transcribed") was untrue and the
 * suite broke the moment the budget was retargeted from Neon to Supabase for a
 * perfectly deliberate reason. Deriving it means a budget change moves the
 * thresholds with it, and only a change to the *ratios* has to be argued for.
 */
const DATA_BUDGET = DATA_BUDGET_BYTES;
const HIGH_WATER = DATA_BUDGET * 0.8;
const CRITICAL = DATA_BUDGET * 0.93;

test('an unmeasurable size never triggers a prune', () => {
  // databaseBytes() returns null when the size query fails. Failing open is
  // deliberate: it is the same connection that just did the run's work, so a
  // failure here means everything else has failed too, and tightening windows
  // on a database we cannot even measure would be guessing.
  assert.equal(pressureFor(null), 'ok');
});

test('a comfortable database is left alone', () => {
  assert.equal(pressureFor(0), 'ok');
  assert.equal(pressureFor(100 * MB), 'ok');
  // The 2026-08-24 post-reclaim size, which must not be treated as pressure.
  assert.equal(pressureFor(310 * MB), 'ok');
});

test('the thresholds are exclusive at the boundary', () => {
  // Exactly at the mark is still the lower state; only above it escalates.
  assert.equal(pressureFor(HIGH_WATER), 'ok');
  assert.equal(pressureFor(HIGH_WATER + 1), 'high');
  assert.equal(pressureFor(CRITICAL), 'high');
  assert.equal(pressureFor(CRITICAL + 1), 'critical');
});

test('pressure only ever escalates as the database grows', () => {
  // The valve must be monotonic. A non-monotonic one would oscillate between
  // window sets on adjacent runs and the site's numbers would visibly flicker.
  const rank = { ok: 0, high: 1, critical: 2 } as const;
  let previous = 0;
  for (let mb = 0; mb <= 512; mb += 4) {
    const current = rank[pressureFor(mb * MB)];
    assert.ok(
      current >= previous,
      `pressure fell going from just under ${mb}MB to ${mb}MB`,
    );
    previous = current;
  }
});

test('the baseline plateau sits below the high-water mark', () => {
  /*
   * The property that makes this a valve rather than an oscillator.
   *
   * Projected at the 2026-08-24 sampling rate the default retention windows
   * plateau near 330MB. If that ever creeps above the high-water mark the
   * valve fires on every ordinary run, the site permanently serves the
   * tightened windows, and "pressure" stops meaning anything unusual has
   * happened. Raising a retention default without re-checking this is exactly
   * how that would happen unnoticed.
   */
  const PROJECTED_PLATEAU = 330 * MB;
  assert.equal(pressureFor(PROJECTED_PLATEAU), 'ok');
});
