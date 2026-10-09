import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapNameKey } from '@/lib/stats';

// Pairs measured on 2026-10-09: battle-log spelling, then the catalogue's.
const pairs: [string, string][] = [
  ["Belle's Rock", 'Belles Rock'],
  ['Out in the Open', 'Out In The Open'],
  ['MEGA BOSS DUO (20 player)', 'Mega Boss Duo (20 Player)'],
  ['Eating Good!', 'Eating Good'],
  ['GG 2.0', 'Gg 2.0'],
];

test('the battle log and the catalogue spell the same map the same way once keyed', () => {
  for (const [data, catalogue] of pairs) assert.equal(mapNameKey(data), mapNameKey(catalogue), data);
});

test('different maps stay different', () => {
  assert.notEqual(mapNameKey('MEGA BOSS DUO'), mapNameKey('MEGA BOSS DUO (5 player)'));
});
