import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tierAgreement } from '@/lib/tier-agreement';

test('exact matches score 100, distance lowers it', () => {
  const data = new Map<number, 'S' | 'A' | 'B' | 'C' | 'D' | null>([[1, 'S'], [2, 'A'], [3, 'B'], [4, null]]);
  assert.equal(tierAgreement({ 1: 'S', 2: 'A' }, data).score, 100);
  const r = tierAgreement({ 1: 'A', 2: 'A', 3: 'B' }, data);
  assert.equal(r.compared, 3);
  assert.equal(r.score, 89); // (0.667 + 1 + 1) / 3
});

test('brawlers the data does not rate are not compared', () => {
  const data = new Map<number, 'S' | null>([[4, null]]);
  assert.deepEqual(tierAgreement({ 4: 'S' }, data), { compared: 0, score: 0, biggest: [] });
});

test('biggest disagreements come first, with their direction', () => {
  const data = new Map<number, 'S' | 'D' | 'B'>([[1, 'S'], [2, 'D'], [3, 'B']]);
  const r = tierAgreement({ 1: 'D', 2: 'S', 3: 'A' }, data, 2);
  assert.deepEqual(r.biggest.map((d) => [d.id, d.gap]), [[1, -4], [2, 4]]); // 1 rated lower than the data, 2 higher
});
