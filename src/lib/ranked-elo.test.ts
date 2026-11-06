import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankProgress } from '@/lib/ranked-elo';

test('an elo inside a rank reports the next rank and the gap', () => {
  const p = rankProgress(5234)!;
  assert.equal(p.rank, 'Mythic II');
  assert.equal(p.next, 'Mythic III');
  assert.equal(p.toNext, 266);
  assert.ok(Math.abs(p.share - 0.468) < 0.001);
});

test('a boundary belongs to the rank it starts', () => {
  assert.equal(rankProgress(6750)!.rank, 'Legendary II');
  assert.equal(rankProgress(6749)!.rank, 'Legendary I');
  assert.equal(rankProgress(0)!.rank, 'Bronze I');
});

test('Pro is the top: no next rank, a full bar', () => {
  const p = rankProgress(11941)!;
  assert.equal(p.rank, 'Pro');
  assert.equal(p.next, null);
  assert.equal(p.toNext, null);
  assert.equal(p.share, 1);
});

test('no elo, no progress', () => {
  assert.equal(rankProgress(null), null);
  assert.equal(rankProgress(undefined), null);
});

test('the elo fit recovers a known win and loss value', async () => {
  const { eloObservation, solveEloRate } = await import('./ranked-elo');
  const sums = { n: 0, sww: 0, swl: 0, sll: 0, swy: 0, sly: 0 };
  // 300 player-days at +20 a win and -15 a loss, with some noise.
  for (let i = 0; i < 300; i++) {
    const w = i % 7;
    const l = (i * 3) % 5;
    const o = eloObservation(20 * w - 15 * l + ((i % 3) - 1), w, l);
    if (!o) continue;
    for (const k of Object.keys(sums) as (keyof typeof sums)[]) sums[k] += o[k];
  }
  const rate = solveEloRate(sums);
  assert.ok(rate);
  assert.ok(Math.abs(rate.win - 20) < 0.5, String(rate.win));
  assert.ok(Math.abs(rate.loss - 15) < 0.5, String(rate.loss));
});

test('no games, a season reset and a thin rank give nothing', async () => {
  const { eloObservation, solveEloRate } = await import('./ranked-elo');
  assert.equal(eloObservation(0, 0, 0), null);
  assert.equal(eloObservation(-3000, 2, 1), null);
  assert.equal(solveEloRate({ n: 10, sww: 10, swl: 2, sll: 10, swy: 200, sly: -150 }), null);
});

test('wins to the next rank use the rank group rate', async () => {
  const { rankProgress, winsToNext, rankGroup } = await import('./ranked-elo');
  assert.equal(rankGroup(5234), 'MYTHIC');
  assert.equal(rankGroup(11300), 'PRO');
  const p = rankProgress(5234);
  assert.equal(winsToNext(p, { MYTHIC: { win: 20, loss: 15, n: 500 } }), 14);
  assert.equal(winsToNext(p, {}), null);
  assert.equal(winsToNext(rankProgress(11300), { PRO: { win: 20, loss: 15, n: 500 } }), null);
});
