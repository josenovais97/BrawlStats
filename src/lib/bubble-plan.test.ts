import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bubblePlan } from '@/lib/bubble-plan';
import type { RosterPlan } from '@/lib/roster-optimizer';

/**
 * The app renders these strings verbatim and cannot be corrected once shipped,
 * so the cases that produce a *wrong* sentence rather than an ugly one are the
 * ones pinned here: telling somebody they are finished when they are one ban
 * from nothing, or that their roster is fine when we simply have no rotation.
 */

function plan(over: Partial<RosterPlan> = {}): RosterPlan {
  return {
    steps: [
      { brawlerId: 16, name: 'PIPER', power: 8, coins: 2975, covers: ['Hot Zone'], secures: [] },
    ],
    totalCoins: 2975,
    modes: 6,
    coveredBefore: 4,
    coveredAfter: 5,
    banSafeBefore: 3,
    banSafeAfter: 3,
    readiness: [],
    ...over,
  };
}

test('the consequence leads and the price follows', () => {
  const out = bubblePlan({
    plan: plan(),
    coverage: { covered: 4, banSafe: 3, modes: 6 },
  })!;
  assert.equal(out.headline, '2,975 coins covers 1 more mode');
  assert.equal(out.note, 'Right now you can field a top-three pick in 4 of 6.');
  assert.equal(out.steps[0].detail, 'Power 8 → 11 · 2,975 coins');
  assert.equal(out.steps[0].gain, 'Covers Hot Zone');
});

test('a plan that only buys ban safety says so rather than claiming coverage', () => {
  const out = bubblePlan({
    plan: plan({ coveredBefore: 6, coveredAfter: 6, banSafeBefore: 2, banSafeAfter: 4 }),
    coverage: { covered: 6, banSafe: 2, modes: 6 },
  })!;
  assert.equal(out.headline, '2,975 coins makes 2 more modes ban-safe');
});

test('covering every mode is not the same as being finished', () => {
  const thin = bubblePlan({ plan: null, coverage: { covered: 6, banSafe: 2, modes: 6 } })!;
  assert.match(thin.note, /only 2 survive the first ban/);

  const done = bubblePlan({ plan: null, coverage: { covered: 6, banSafe: 6, modes: 6 } })!;
  assert.match(done.note, /every one survives/);
  assert.equal(done.headline, 'Nothing left to upgrade');
});

test('a gap no owned brawler can close says why, rather than "nothing to do"', () => {
  const out = bubblePlan({ plan: null, coverage: { covered: 3, banSafe: 1, modes: 6 } })!;
  assert.equal(out.headline, 'No upgrade would change this');
  assert.match(out.note, /a brawler you do not own/);
});

test('no rotation is our gap, not a verdict on the account', () => {
  assert.equal(bubblePlan({ plan: null, coverage: { covered: 0, banSafe: 0, modes: 0 } }), null);
  assert.equal(bubblePlan({ plan: plan(), coverage: { covered: 4, banSafe: 3, modes: 0 } }), null);
});

test('singular and plural are both reachable, because both ship', () => {
  const one = bubblePlan({
    plan: plan({ coveredBefore: 0, coveredAfter: 1 }),
    coverage: { covered: 0, banSafe: 0, modes: 1 },
  })!;
  assert.match(one.headline, /1 more mode$/);
  assert.match(one.note, /in the one live Ranked mode yet\./);

  const many = bubblePlan({
    plan: plan({ coveredBefore: 1, coveredAfter: 4 }),
    coverage: { covered: 1, banSafe: 0, modes: 6 },
  })!;
  assert.match(many.headline, /3 more modes$/);
});
