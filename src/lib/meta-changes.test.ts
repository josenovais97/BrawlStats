import assert from 'node:assert/strict';
import { test } from 'node:test';

import { panelTrend } from '@/lib/meta-changes';
import type { MetaMover, Tier } from '@/types/stats';

const mover = (id: number, delta: number, before: Tier, now: Tier): MetaMover =>
  ({ brawlerId: id, brawlerName: String(id), metaScoreNow: 5 + delta, metaScoreBefore: 5, metaScoreDelta: delta, tierNow: now, tierBefore: before }) as MetaMover;

test('panel arrows: three each way, tier-crossing moves of a point or more only', () => {
  const movers = [
    mover(1, 4.1, 'E', 'A'), mover(2, 3.6, 'B', 'S'), mover(3, 3.0, 'C', 'A'), mover(4, 2.9, 'C', 'S'),
    mover(5, -4.0, 'S', 'C'), mover(6, -1.8, 'S', 'B'),
    mover(7, 2.5, 'A', 'A'), // no tier crossed
    mover(8, 0.6, 'B', 'A'), // too small
  ];
  assert.deepEqual(panelTrend(movers), { 1: 1, 2: 1, 3: 1, 5: -1, 6: -1 });
  assert.deepEqual(panelTrend([]), {});
});
