import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bubblePlan } from '@/lib/bubble-plan';
import { rosterCoverage, rosterPlan } from '@/lib/roster-optimizer';
import type { RosterPlan } from '@/lib/roster-optimizer';
import type { BSPlayerBrawler } from '@/types/brawlstars';
import type { ModeBestPicks, ModePick } from '@/types/stats';

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

/**
 * The optimiser and the wording, joined.
 *
 * The cases above hand `bubblePlan` a plan built by hand, which leaves the one
 * thing production does untested: running the real greedy loop and rendering
 * whatever it chooses. Both live accounts available to check against are
 * maxed — they only ever exercise the empty branch — so the branch a player
 * with gaps actually sees is pinned here instead of hoped for.
 */

function pick(brawlerId: number, brawlerName: string): ModePick {
  return {
    brawlerId,
    brawlerName,
    score: 0,
    winRate: 0.55,
    pickRate: 0.1,
    decidedSampleSize: 500,
  };
}

function mode(key: string, picks: ModePick[]): [string, ModeBestPicks] {
  return [key, { mode: key, picks, sampleSize: 5000, baselineWinRate: 0.5 }];
}

function brawler(id: number, name: string, power: number): BSPlayerBrawler {
  return {
    id,
    name,
    power,
    rank: 20,
    trophies: 600,
    highestTrophies: 700,
    gadgets: [],
    starPowers: [],
    gears: [],
  };
}

test('an account with a hole gets a step that names what the coins buy', () => {
  const picksByMode = new Map([
    mode('gemGrab', [pick(1, 'PIPER'), pick(2, 'GENE'), pick(3, 'POCO')]),
    mode('hotZone', [pick(1, 'PIPER'), pick(4, 'BULL'), pick(5, 'NITA')]),
  ]);
  const modes = ['gemGrab', 'hotZone'];
  const brawlers = [
    // Covers Gem Grab already, and nothing else.
    brawler(2, 'GENE', 11),
    // One upgrade away, and the only owned pick in Hot Zone.
    brawler(4, 'BULL', 7),
    // Owned, in no mode's top three: never worth recommending.
    brawler(9, 'EDGAR', 5),
  ];

  const plan = rosterPlan({
    brawlers,
    picksByMode,
    modes,
    modeLabels: new Map([
      ['gemGrab', 'Gem Grab'],
      ['hotZone', 'Hot Zone'],
    ]),
  });

  const out = bubblePlan({
    plan,
    coverage: rosterCoverage({ brawlers, picksByMode, modes }),
  })!;

  assert.equal(out.note, 'Right now you can field a top-three pick in 1 of 2.');
  assert.match(out.headline, /^[\d,]+ coins covers 1 more mode$/);
  assert.equal(out.steps.length, 1, 'only the upgrade that changes a mode');
  assert.equal(out.steps[0].name, 'BULL');
  assert.equal(out.steps[0].gain, 'Covers Hot Zone');
  assert.match(out.steps[0].detail, /^Power 7 → 11 · [\d,]+ coins$/);
  assert.match(out.steps[0].icon, /^https:\/\/\S+\/4\.png$/);
});
