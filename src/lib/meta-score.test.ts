import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PICK_WEIGHT,
  SCORE_ANCHORS,
  SCORE_THRESHOLDS,
  WIN_WEIGHT,
  metaScore,
} from '@/lib/stats';

/**
 * The arithmetic behind every tier list, pinned.
 *
 * These are all silent failures. A weight that no longer sums to one rescales
 * the whole list without erroring; an anchor pair the wrong way round divides
 * by a negative and produces a ranking that is upside down but still renders;
 * a threshold out of order makes a tier unreachable. None of it throws, and
 * the page looks completely normal in every case.
 */

test('the weights are a split, not two numbers', () => {
  assert.equal(
    WIN_WEIGHT + PICK_WEIGHT,
    1,
    'weights must sum to 1 or the 0-10 scale silently changes meaning',
  );
});

test('performance outweighs popularity', () => {
  // Measured 2026-09-24 against a within-player estimator: adjusted win rate
  // tracks skill-controlled strength at r=+0.77, pick rate at r=+0.22. Pick
  // rate earns a place and must never earn the larger half of it.
  assert.ok(
    WIN_WEIGHT > PICK_WEIGHT * 2,
    `win weight ${WIN_WEIGHT} must stay at least double pick weight ${PICK_WEIGHT}`,
  );
});

test('every anchor pair runs floor to ceiling', () => {
  for (const [format, a] of Object.entries(SCORE_ANCHORS)) {
    assert.ok(a.winFloor < a.winCeiling, `${format}: win anchors are inverted`);
    assert.ok(a.pickFloor < a.pickCeiling, `${format}: pick anchors are inverted`);
    // The pick axis is log-scaled, so a floor at zero is a division by
    // -Infinity rather than an error.
    assert.ok(a.pickFloor > 0, `${format}: pickFloor must be above zero for log scaling`);
  }
});

test('the scale spans 0 to 10 and never leaves it', () => {
  for (const format of ['ranked', 'trophy'] as const) {
    const a = SCORE_ANCHORS[format];
    assert.equal(metaScore(a.winFloor, a.pickFloor, format), 0);
    assert.equal(metaScore(a.winCeiling, a.pickCeiling, format), 10);
    // Well past both ends, to prove the clamps hold rather than extrapolate.
    assert.equal(metaScore(0.01, 0.000001, format), 0);
    assert.equal(metaScore(0.99, 0.9, format), 10);
  }
});

test('an unmeasured brawler scores nothing, not zero', () => {
  // Zero is a claim about a brawler. Null is the absence of one, and the tier
  // list renders the two differently on purpose.
  assert.equal(metaScore(null, 0.02, 'ranked'), null);
});

test('tier thresholds descend and reach the bottom', () => {
  const scores = SCORE_THRESHOLDS.map((t) => t.minScore);
  assert.deepEqual(
    scores,
    [...scores].sort((a, b) => b - a),
    'thresholds are read in order, so an out-of-order entry makes a tier unreachable',
  );
  assert.equal(scores.at(-1), 0, 'the lowest tier must catch every remaining score');
});
