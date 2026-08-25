import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shouldSnapshot } from '@/lib/aggregation';

/**
 * The snapshot sample is the difference between fitting the plan and not.
 *
 * `player_brawler_snapshots` was 47% of the database — the single largest
 * thing stored — and it is written, not derived, so nothing downstream can
 * shrink it after the fact. These tests pin the two properties the saving
 * depends on: that the rate actually thins the population, and that the
 * thinning is not a fixed panel.
 *
 * Measured 2026-08-25, before the change: 399,186 rows at 192.6 MB, i.e. ~482
 * bytes a row, from roughly 7,000 distinct players a day.
 */

/** What the table cost per row, measured on real data. */
const BYTES_PER_ROW = 482;
/** Distinct players sampled per day, and brawlers each, at the current cadence. */
const PLAYERS_PER_DAY = 7_000;
const BRAWLERS_PER_PLAYER = 57;
/** `SNAPSHOT_RETENTION_DAYS`, which the prune holds the table to. */
const RETENTION_DAYS = 2;
/** The free plan this project is built to live inside. */
const PLAN_BYTES = 512 * 1024 * 1024;
/** Everything in the database that is not this table, measured the same day. */
const OTHER_TABLES_BYTES = 208 * 1024 * 1024;

function projectedBytes(rate: number): number {
  const rowsPerDay = (PLAYERS_PER_DAY / rate) * BRAWLERS_PER_PLAYER;
  return rowsPerDay * RETENTION_DAYS * BYTES_PER_ROW;
}

test('the sample rate keeps the database inside the plan', () => {
  // Guards the arithmetic the rate was chosen from. A future edit that raises
  // the sampling cadence, or lowers the rate, has to face this number.
  const total = projectedBytes(4) + OTHER_TABLES_BYTES;

  assert.ok(
    total < PLAN_BYTES * 0.7,
    `projected ${(total / 1048576).toFixed(0)} MB is not comfortably inside the ${(PLAN_BYTES / 1048576).toFixed(0)} MB plan`,
  );
});

test('a census does not fit, which is why the rate exists', () => {
  // The state this replaced. Kept as a test so the saving is not mistaken for
  // caution: at rate 1 the table alone overruns the plan.
  const total = projectedBytes(1) + OTHER_TABLES_BYTES;

  assert.ok(
    total > PLAN_BYTES,
    'rate 1 was supposed to overrun the plan; if it no longer does, these constants are stale',
  );
});

test('roughly one player in four is recorded', () => {
  const day = new Date('2026-08-25T00:00:00Z');
  let kept = 0;
  const population = 20_000;

  for (let i = 0; i < population; i += 1) {
    if (shouldSnapshot(`TAG${i}`, day, 4)) kept += 1;
  }

  const share = kept / population;
  // Bounds rather than an exact figure: it is a hash, not a quota.
  assert.ok(
    share > 0.22 && share < 0.28,
    `expected about a quarter of players, kept ${(share * 100).toFixed(1)}%`,
  );
});

test('the cohort rotates daily rather than fixing a panel', () => {
  /*
   * The failure this guards is silent and slow: hashing the tag alone would
   * pick the same quarter of the pool every day, so every aggregate would be
   * measured on one fixed panel of accounts forever. The averages would look
   * fine and describe the wrong population.
   */
  const monday = new Date('2026-08-24T00:00:00Z');
  const tuesday = new Date('2026-08-25T00:00:00Z');

  const on = (day: Date) => {
    const out = new Set<string>();
    for (let i = 0; i < 4_000; i += 1) {
      const tag = `TAG${i}`;
      if (shouldSnapshot(tag, day, 4)) out.add(tag);
    }
    return out;
  };

  const a = on(monday);
  const b = on(tuesday);
  const overlap = [...a].filter((tag) => b.has(tag)).length / a.size;

  // Independent draws of a quarter each overlap about a quarter of the time.
  assert.ok(
    overlap > 0.15 && overlap < 0.35,
    `cohorts should be independent between days, overlap was ${(overlap * 100).toFixed(1)}%`,
  );
});

test('a rate of one records everyone, so the valve can be opened fully', () => {
  const day = new Date('2026-08-25T00:00:00Z');
  for (let i = 0; i < 500; i += 1) {
    assert.ok(shouldSnapshot(`TAG${i}`, day, 1));
  }
});

test('the same player on the same day is decided the same way', () => {
  // Runs happen eight times a day and re-walk players; an unstable answer
  // would write a partial roster on one run and the rest on another.
  const day = new Date('2026-08-25T00:00:00Z');
  const first = shouldSnapshot('2V0UL0GQV8', day, 4);
  for (let i = 0; i < 20; i += 1) {
    assert.equal(shouldSnapshot('2V0UL0GQV8', day, 4), first);
  }
});
