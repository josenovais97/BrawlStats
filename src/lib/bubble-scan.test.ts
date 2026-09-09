import assert from 'node:assert/strict';
import { test } from 'node:test';

import { correctionIndex, mergeSlots, normalise, resolvePlate, similarity } from '@/lib/bubble-scan';

/**
 * The half of draft scanning that can be tested without a phone.
 *
 * Recognising pixels needs a device, a live match and a draft timer; deciding
 * what a recognition *means* needs none of those, so it lives in its own module
 * and is pinned here.
 */

const MODES = [
  {
    key: 'brawlBall',
    label: 'Brawl Ball',
    maps: [
      { mapName: 'Spiraling Out', mode: 'brawlBall' },
      { mapName: 'Backyard Bowl', mode: 'brawlBall' },
    ],
  },
  {
    key: 'gemGrab',
    label: 'Gem Grab',
    maps: [{ mapName: 'Hard Rock Mine', mode: 'gemGrab' }],
  },
];

const LIMITS = { bans: 6, allies: 2, enemies: 3 } as const;

test('a recognised map brings its mode with it', () => {
  const hit = resolvePlate({ ok: true, map: 'Spiraling Out' }, MODES);
  assert.equal(hit.map?.mapName, 'Spiraling Out');
  assert.equal(hit.mode, 'brawlBall');
});

test('a recognised mode alone still narrows the choice', () => {
  const hit = resolvePlate({ ok: true, mode: 'gemGrab' }, MODES);
  assert.equal(hit.map, null);
  assert.equal(hit.mode, 'gemGrab');
});

test('a map recognised on a first scan overrides a stale mode reading', () => {
  const hit = resolvePlate({ ok: true, mode: 'brawlBall', map: 'Hard Rock Mine' }, MODES);
  assert.equal(hit.map?.mapName, 'Hard Rock Mine');
  assert.equal(hit.mode, 'gemGrab', 'the map decides, because it is the more specific fact');
});

test('a name the panel does not know resolves to nothing rather than a guess', () => {
  const hit = resolvePlate({ ok: true, map: 'Retired Map', mode: 'duoShowdown' }, MODES);
  assert.equal(hit.map, null);
  assert.equal(hit.mode, null);
});

test('an empty reading is not an error', () => {
  const hit = resolvePlate({ ok: true }, MODES);
  assert.deepEqual(hit, { mode: null, map: null });
});

test('punctuation and case are not part of a name', () => {
  assert.equal(normalise('Spiraling Out'), 'SPIRALINGOUT');
  assert.equal(normalise("Pinhole Punt"), 'PINHOLEPUNT');
  assert.equal(normalise('8-BIT'), '8BIT');
});

test('a clean read finds its map and its mode', () => {
  const hit = resolvePlate({ ok: true, text: ['BRAWL BALL', 'Spiraling Out'] }, MODES);
  assert.equal(hit.map?.mapName, 'Spiraling Out');
  assert.equal(hit.mode, 'brawlBall');
});

test('a read with a stray glyph still finds its map', () => {
  const hit = resolvePlate({ ok: true, text: ['BRAWL BALL', 'Spiralinq Outi'] }, MODES);
  assert.equal(hit.map?.mapName, 'Spiraling Out');
});

test('the recogniser lines do not have to arrive in order', () => {
  const hit = resolvePlate({ ok: true, text: ['Hard Rock Mine', 'GEM GRAB'] }, MODES);
  assert.equal(hit.map?.mapName, 'Hard Rock Mine');
  assert.equal(hit.mode, 'gemGrab');
});

test('text that matches nothing resolves to nothing rather than a guess', () => {
  const hit = resolvePlate({ ok: true, text: ['POWER LEVEL', 'PICK TURN', '19s'] }, MODES);
  assert.equal(hit.map, null);
  assert.equal(hit.mode, null);
});

test('a confirmed plate outranks the recogniser', () => {
  // The learned picture cannot be wrong about which map it is; the letters can.
  const hit = resolvePlate(
    { ok: true, map: 'Hard Rock Mine', text: ['BRAWL BALL', 'Spiraling Out'] },
    MODES,
  );
  assert.equal(hit.map?.mapName, 'Hard Rock Mine');
  assert.equal(hit.mode, 'gemGrab');
});

test('two maps sharing words are still told apart', () => {
  const s = similarity(normalise('Backyard Bowl'), normalise('Spiraling Out'));
  assert.ok(s < 0.62, `unrelated names should not match, got ${s}`);
});

test('a scan fills gaps and never removes a hand-set slot', () => {
  const current = { bans: [11, 12], allies: [] as number[], enemies: [99] };
  const merged = mergeSlots(
    current,
    { ok: true, bans: [13, null, 14], allies: [21], enemies: [null, 31] },
    LIMITS,
  );
  assert.deepEqual(merged.bans, [11, 12, 13, 14]);
  assert.deepEqual(merged.allies, [21]);
  assert.deepEqual(merged.enemies, [99, 31]);
});

test('a brawler already on the board is not added twice', () => {
  const merged = mergeSlots(
    { bans: [7], allies: [], enemies: [] },
    { ok: true, bans: [7], allies: [7], enemies: [] },
    LIMITS,
  );
  assert.deepEqual(merged.bans, [7]);
  assert.deepEqual(merged.allies, []);
});

test('a slot cannot be pushed past what the game allows', () => {
  const merged = mergeSlots(
    { bans: [], allies: [], enemies: [] },
    { ok: true, enemies: [1, 2, 3, 4, 5] },
    LIMITS,
  );
  assert.equal(merged.enemies.length, LIMITS.enemies);
});

test('a correction is only attributed when one slot went unread', () => {
  assert.equal(correctionIndex([5, null, 7]), 1);
  assert.equal(correctionIndex([null, null, 7]), null, 'ambiguous, so learn nothing');
  assert.equal(correctionIndex([5, 6, 7]), null, 'nothing was missed');
  assert.equal(correctionIndex(undefined), null);
});
