import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isHomeScreenGift, nextStoreReset, storeDay, timeLeft } from '@/lib/store-daily';

const at = (iso: string) => Date.parse(iso);

test("the store's day starts at 08:00 UTC", () => {
  assert.equal(storeDay(at('2026-11-24T07:59:59Z')), '2026-11-23');
  assert.equal(storeDay(at('2026-11-24T08:00:00Z')), '2026-11-24');
  assert.equal(storeDay(at('2026-11-25T00:30:00Z')), '2026-11-24');
  assert.equal(storeDay(at('2027-01-01T07:00:00Z')), '2026-12-31');
});

test('the reward goes at the next 08:00 UTC', () => {
  assert.equal(nextStoreReset(at('2026-11-24T13:20:00Z')), at('2026-11-25T08:00:00Z'));
  assert.equal(nextStoreReset(at('2026-11-24T03:00:00Z')), at('2026-11-24T08:00:00Z'));
  assert.equal(nextStoreReset(at('2026-11-24T08:00:00Z')), at('2026-11-25T08:00:00Z'));
});

test('the countdown', () => {
  assert.deepEqual(timeLeft(at('2026-11-24T13:20:00Z')), { h: 18, m: 40 });
  assert.deepEqual(timeLeft(at('2026-11-24T07:59:30Z')), { h: 0, m: 1 });
  assert.deepEqual(timeLeft(at('2026-11-24T08:00:00Z')), { h: 24, m: 0 });
});

test('only the marked store link is a home-screen gift', () => {
  assert.equal(isHomeScreenGift('https://store.supercell.com/brawlstars#add-to-home-screen'), true);
  assert.equal(isHomeScreenGift('https://store.supercell.com/pt/brawlstars/#add-to-home-screen'), true);
  assert.equal(isHomeScreenGift('https://store.supercell.com/brawlstars'), false);
  assert.equal(isHomeScreenGift('https://example.com/brawlstars#add-to-home-screen'), false);
  assert.equal(isHomeScreenGift('https://store.supercell.com/brawlstars/product/gems/db31bef9'), false);
});
