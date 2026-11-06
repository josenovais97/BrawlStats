import assert from 'node:assert/strict';
import { test } from 'node:test';

import { battleModeOf, isListedMode } from './battle-mode';

test('an event variant is filed under the event, not the engine it runs on', () => {
  assert.equal(battleModeOf({ event: { mode: 'airHockey' }, battle: { mode: 'brawlBall' } }), 'airHockey');
  assert.equal(battleModeOf({ event: { mode: 'megaShowdown' }, battle: { mode: 'soloShowdown' } }), 'megaShowdown');
});

test('internal names for the same mode keep the battle mode', () => {
  assert.equal(battleModeOf({ event: { mode: 'deathmatch' }, battle: { mode: 'wipeout' } }), 'wipeout');
  assert.equal(battleModeOf({ event: { mode: 'tagTeam' }, battle: { mode: 'duels' } }), 'duels');
});

test('matching modes, a missing event and an unknown event keep the battle mode', () => {
  assert.equal(battleModeOf({ event: { mode: 'brawlBall' }, battle: { mode: 'brawlBall' } }), 'brawlBall');
  assert.equal(battleModeOf({ event: {}, battle: { mode: 'knockout' } }), 'knockout');
  assert.equal(battleModeOf({ event: { mode: 'unknown' }, battle: { mode: 'gemGrab' } }), 'gemGrab');
  assert.equal(battleModeOf({}), 'unknown');
  assert.equal(battleModeOf({ event: { mode: 'heist' } }), 'heist');
});

test('variants stay unlisted, the regular modes stay listed', () => {
  assert.equal(isListedMode('airHockey'), false);
  assert.equal(isListedMode('trioShowdown'), false);
  for (const mode of ['brawlBall', 'soloShowdown', 'duoShowdown', 'knockout', 'siege', 'wipeout', 'basketBrawl', 'duels']) {
    assert.equal(isListedMode(mode), true, mode);
  }
});
