import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EDGE_SHARE,
  PICK_WEIGHT,
  SCORE_ANCHORS,
  SCORE_THRESHOLDS,
  WIN_WEIGHT,
  blendStrength,
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

/**
 * The skill-controlled correction.
 *
 * Every case here is one where a wrong answer still renders a complete,
 * plausible tier list — which is why they are pinned rather than eyeballed.
 */

test('a brawler with no measured edge scores exactly as before', () => {
  // The estimator needs enough players carrying a brawler, and the competitive
  // split only exists for days folded since 2026-09-24. Anything it cannot
  // reach must fall back rather than fall out.
  for (const rate of [0.45, 0.5, 0.55]) {
    assert.equal(blendStrength(rate, null), rate);
  }
  assert.equal(
    metaScore(0.52, 0.02, 'ranked', null),
    metaScore(0.52, 0.02, 'ranked'),
  );
});

test('the correction moves halfway, in the right direction', () => {
  // +4 points of edge means "players do 4 points better than their own
  // average with this brawler", i.e. a 54% estimate. Half of the way from a
  // published 0.50 is 0.52.
  assert.equal(blendStrength(0.5, 4), 0.52);
  assert.equal(blendStrength(0.5, -4), 0.48);
  // It is a move toward the estimate, never past it.
  const blended = blendStrength(0.4, 10);
  assert.ok(blended > 0.4 && blended < 0.6, `${blended} overshot the estimate`);
});

test('an absurd edge cannot push a rate outside a plausible one', () => {
  // An average of two numbers must stay inside the range either could occupy,
  // or the anchors stop meaning what they say.
  for (const edge of [500, -500]) {
    const blended = blendStrength(0.5, edge);
    assert.ok(blended >= 0 && blended <= 1, `blend left the rate range: ${blended}`);
  }
});

test('the correction is a correction, not the whole answer', () => {
  assert.ok(EDGE_SHARE > 0 && EDGE_SHARE < 1, 'the published rate must still count');
});
