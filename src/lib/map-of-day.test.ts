import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayNumber, rotation } from '@/lib/map-of-day';
import type { RankedMapPicks } from '@/types/stats';

/** The shape of the 2026-10 Ranked pool: four maps in five modes, six in one. */
const POOL: RankedMapPicks[] = [
  ...['Shooting Star', 'Hideout', 'Dry Season', 'Layer Cake'].map((m) => row('bounty', m)),
  ...['Flaring Phoenix', 'Out in the Open', "Belle's Rock", 'New Horizons'].map((m) => row('knockout', m)),
  ...['Double Swoosh', 'Gem Fort', 'Hard Rock Mine', 'Undermine'].map((m) => row('gemGrab', m)),
  ...['Sneaky Fields', 'Pinball Dreams', 'Center Stage', 'Triple Dribble'].map((m) => row('brawlBall', m)),
  ...['Hot Potato', 'Bridge Too Far', 'Safe Zone', 'Kaboom Canyon'].map((m) => row('heist', m)),
  ...['In the Liminal', 'Ring of Fire', 'Open Business', 'Parallel Plays', 'Quick Travel', 'Dueling Beetles'].map(
    (m) => row('hotZone', m),
  ),
];

function row(mode: string, mapName: string): RankedMapPicks {
  return {
    mode,
    mapName,
    eventId: null,
    picks: [],
    sampleSize: 0,
    baselineWinRate: 0.5,
    mapWinRate: 0.5,
    confidence: 'high',
    brawlersSeen: 0,
    lastSeen: '2026-10-07T00:00:00Z',
  };
}

test('every map in the pool is posted once per cycle', () => {
  const order = rotation(POOL);
  assert.equal(order.length, POOL.length);
  assert.equal(new Set(order.map((r) => `${r.mode}/${r.mapName}`)).size, POOL.length);
});

test('two days in a row are never the same mode', () => {
  const order = rotation(POOL);
  for (let i = 1; i < order.length; i += 1) {
    assert.notEqual(order[i].mode, order[i - 1].mode, `days ${i - 1} and ${i}`);
  }
});

test('the order depends on the pool, not on the order it arrived in', () => {
  const shuffled = [...POOL].reverse();
  assert.deepEqual(
    rotation(shuffled).map((r) => r.mapName),
    rotation(POOL).map((r) => r.mapName),
  );
});

test('consecutive dates step through the rotation one map at a time', () => {
  assert.equal(dayNumber('2026-10-08') - dayNumber('2026-10-07'), 1);
  assert.equal(dayNumber('2026-11-01') - dayNumber('2026-10-31'), 1);
});
