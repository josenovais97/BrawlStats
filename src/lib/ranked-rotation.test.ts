import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rotationKey, rotationMaps } from '@/lib/ranked-rotation';

/* Shaped on 2026-10-19's real numbers. */
const recent = [
  { mode: 'knockout', mapName: 'New Horizons', battles: 26968 },
  { mode: 'knockout', mapName: 'Goldarm Gulch', battles: 26520 },
  { mode: 'knockout', mapName: 'Flowing Springs', battles: 26844 },
  { mode: 'knockout', mapName: 'Quick Travel', battles: 140 },
  { mode: 'brawlBall', mapName: 'Pinball Dreams', battles: 26269 },
];
const pool = [
  { mode: 'Knockout', maps: ['New Horizons', "Belle's Rock"] },
  { mode: 'Brawl Ball', maps: ['Pinball Dreams', 'Beach Ball', 'Spiraling Out'] },
  { mode: 'Gem Grab', maps: ['Undermine', 'Double Swoosh'] },
];

test('maps being played are in rotation, whatever the wiki lists', () => {
  const r = rotationMaps({ recent, pool });
  assert.deepEqual(r.get('knockout'), ['Flowing Springs', 'Goldarm Gulch', 'New Horizons']);
  assert.deepEqual(r.get('brawlball'), ['Pinball Dreams']);
});

test('stragglers from the previous rotation are left out', () => {
  assert.ok(!rotationMaps({ recent, pool }).get('knockout')!.includes('Quick Travel'));
});

test('a mode with no recent battles falls back to the published pool', () => {
  assert.deepEqual(rotationMaps({ recent, pool }).get('gemgrab'), ['Double Swoosh', 'Undermine']);
});

test('mode keys match across API ids and labels', () => {
  assert.equal(rotationKey('brawlBall'), rotationKey('Brawl Ball'));
});

test('after a rotation change, a map no longer played drops within hours', () => {
  const r = rotationMaps({
    recent: [
      { mode: 'heist', mapName: 'Old Map', battles: 20000, lastSeen: '2026-11-19T08:00:00Z' },
      { mode: 'heist', mapName: 'New Map', battles: 3000, lastSeen: '2026-11-19T16:00:00Z' },
    ],
    pool: [],
  });
  assert.deepEqual(r.get('heist'), ['New Map']);
});
