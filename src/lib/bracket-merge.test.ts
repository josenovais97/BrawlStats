import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mergeBracketRows } from '@/lib/bracket-merge';
import type { BrawlerStatRow } from '@/types/stats';

const row = (id: number, wr: number, base: number, decided: number, total: number): BrawlerStatRow => ({
  brawlerId: id,
  brawlerName: `B${id}`,
  snapshotDate: '2026-11-23',
  winRate: wr,
  baselineWinRate: base,
  usageRate: decided / total,
  avgTrophies: null,
  avgRank: null,
  sampleSize: decided,
  decidedSampleSize: decided,
  ownerSampleSize: 0,
  windowDays: 7,
});

test('merging brackets weights wins, baseline and picks by battles', () => {
  const mythic = [row(1, 0.6, 0.5, 100, 1000), row(2, 0.4, 0.5, 300, 1000)];
  const masters = [row(1, 0.5, 0.48, 300, 3000)];
  const merged = new Map(mergeBracketRows([mythic, masters]).map((r) => [r.brawlerId, r]));
  const one = merged.get(1)!;
  assert.equal(one.decidedSampleSize, 400);
  assert.ok(Math.abs((one.winRate as number) - (0.6 * 100 + 0.5 * 300) / 400) < 1e-9);
  assert.ok(Math.abs((one.baselineWinRate as number) - (0.5 * 100 + 0.48 * 300) / 400) < 1e-9);
  assert.ok(Math.abs((one.usageRate as number) - 400 / 4000) < 1e-9);
  assert.ok(Math.abs((merged.get(2)!.usageRate as number) - 300 / 4000) < 1e-9);
});

test('a brawler with no decided games keeps null rates', () => {
  const merged = mergeBracketRows([[{ ...row(3, 0.5, 0.5, 0, 1000), winRate: null, usageRate: null }]]);
  assert.equal(merged[0].winRate, null);
});
