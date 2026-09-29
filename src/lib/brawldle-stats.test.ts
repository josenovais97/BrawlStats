import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EMPTY_STATS,
  averageGuesses,
  currentStreak,
  daysBetween,
  formatCountdown,
  msUntilReset,
  oneShots,
  recordResult,
} from '@/lib/brawldle-stats';

/**
 * Streak arithmetic, which looks obviously right and is wrong at the edges.
 *
 * Every bug in here is invisible until somebody's streak resets for no reason
 * and they stop playing, which is the one outcome the feature exists to
 * prevent. So the edges get tests: the same day twice, a gap, a loss in the
 * middle, and a stored streak that has gone stale.
 */

test('a first win starts a streak of one', () => {
  const s = recordResult(EMPTY_STATS, '2026-09-29', true, 4);
  assert.equal(s.played, 1);
  assert.equal(s.won, 1);
  assert.equal(s.streak, 1);
  assert.equal(s.best, 1);
});

test('consecutive days extend the streak', () => {
  let s = recordResult(EMPTY_STATS, '2026-09-29', true, 4);
  s = recordResult(s, '2026-09-30', true, 3);
  s = recordResult(s, '2026-10-01', true, 5);
  assert.equal(s.streak, 3);
  assert.equal(s.best, 3);
});

test('a skipped day breaks the streak rather than pausing it', () => {
  let s = recordResult(EMPTY_STATS, '2026-09-29', true, 4);
  s = recordResult(s, '2026-10-02', true, 2);
  assert.equal(s.streak, 1);
  assert.equal(s.best, 1);
});

test('a loss ends the streak but keeps the best', () => {
  let s = recordResult(EMPTY_STATS, '2026-09-29', true, 4);
  s = recordResult(s, '2026-09-30', true, 3);
  s = recordResult(s, '2026-10-01', false, 0);
  assert.equal(s.streak, 0);
  assert.equal(s.best, 2);
  assert.equal(s.played, 3);
  assert.equal(s.won, 2);
});

test('a win after a loss starts again at one', () => {
  let s = recordResult(EMPTY_STATS, '2026-09-29', true, 4);
  s = recordResult(s, '2026-09-30', false, 0);
  s = recordResult(s, '2026-10-01', true, 6);
  assert.equal(s.streak, 1);
});

test('recording the same day twice changes nothing', () => {
  /*
   * The board saves on every guess and a solved board can be re-rendered, so
   * without this a refresh would inflate every count.
   */
  const once = recordResult(EMPTY_STATS, '2026-09-29', true, 4);
  const twice = recordResult(once, '2026-09-29', true, 4);
  assert.deepEqual(twice, once);
});

test('a loss does not record a guess count', () => {
  const s = recordResult(EMPTY_STATS, '2026-09-29', false, 9);
  assert.deepEqual(s.distribution, {});
  assert.equal(averageGuesses(s), null);
});

test('the displayed streak goes stale when the run is over', () => {
  /*
   * Win on Monday, open the page on Thursday: the stored streak still says 1,
   * but the run is plainly finished. The stored value records what happened;
   * `currentStreak` says what is true now.
   */
  const s = recordResult(EMPTY_STATS, '2026-09-28', true, 3);
  assert.equal(currentStreak(s, '2026-09-28'), 1, 'same day still counts');
  assert.equal(currentStreak(s, '2026-09-29'), 1, 'yesterday still counts — today is not over');
  assert.equal(currentStreak(s, '2026-09-30'), 0, 'a full day missed ends it');
  assert.equal(s.streak, 1, 'the stored record is untouched');
});

test('no wins means no streak to display', () => {
  assert.equal(currentStreak(EMPTY_STATS, '2026-09-29'), 0);
});

test('average and one-shots read the distribution', () => {
  let s = recordResult(EMPTY_STATS, '2026-09-27', true, 1);
  s = recordResult(s, '2026-09-28', true, 3);
  assert.equal(averageGuesses(s), 2);
  assert.equal(oneShots(s), 1);
});

test('the countdown runs to midnight UTC', () => {
  const ms = msUntilReset(new Date('2026-09-29T23:59:00Z'));
  assert.equal(ms, 60_000);
  assert.equal(formatCountdown(ms), '00:01:00');
});

test('a fresh day counts nearly a full day, not zero', () => {
  const ms = msUntilReset(new Date('2026-09-29T00:00:00Z'));
  assert.equal(ms, 86_400_000);
  assert.equal(formatCountdown(ms), '24:00:00');
});

test('day arithmetic survives a month boundary', () => {
  assert.equal(daysBetween('2026-09-30', '2026-10-01'), 1);
  assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1, '2026 is not a leap year');
  assert.equal(daysBetween('nonsense', '2026-10-01'), null);
});
