import assert from 'node:assert/strict';
import { test } from 'node:test';

import { panelTrend, weekTrend } from '@/lib/meta-changes';
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

test('tier list arrows: a point or more, and only what the sample can tell from luck', () => {
  const g = (brawlerId: number, games: number, wr: number) => ({ brawlerId, games, wins: Math.round(games * wr) });
  const before = [g(1, 20_000, 0.5), g(2, 20_000, 0.5), g(3, 20_000, 0.5), g(4, 2_000, 0.5), g(5, 900, 0.5), g(6, 20_000, 0.5)];
  const now = [
    g(1, 20_000, 0.52), // up two points
    g(2, 20_000, 0.485), // down a point and a half
    g(3, 20_000, 0.506), // under a point
    g(4, 2_000, 0.515), // a point and a half, but two thousand games cannot show it
    g(5, 20_000, 0.6), // too few games last week
    g(7, 20_000, 0.6), // not there last week
  ];
  assert.deepEqual(weekTrend(now, before), { 1: 1, 2: -1 });
  assert.deepEqual(weekTrend([], before), {});
});
