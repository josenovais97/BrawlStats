import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { DAILY_ALERT_DAYS, DAILY_STORE_URL, dailyAlertOn, dailyGiftUrl, isHomeScreenGift, nextStoreReset, storeDay, timeLeft } from '@/lib/store-daily';

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

test("the card links only to Supercell's own store", () => {
  const product = 'https://store.supercell.com/brawlstars/product/freebie--/e76865dc';
  assert.equal(dailyGiftUrl(product), product);
  for (const bad of [undefined, '', 'https://example.com/x', `${product}?boost=x`, 'https://store.supercell.com.evil.com/brawlstars/product/a/1', 'javascript:alert(1)']) {
    assert.equal(dailyGiftUrl(bad), DAILY_STORE_URL);
  }
});

test('the app is told from 15:00 UTC until two hours before the change, in the trial week only', () => {
  for (const [when, on] of [
    ['2026-11-24T16:00:00Z', false], // the day before it starts
    ['2026-11-25T08:30:00Z', false],
    ['2026-11-25T14:59:00Z', false],
    ['2026-11-25T15:00:00Z', true],
    ['2026-11-26T05:59:00Z', true], // still the 25th's reward
    ['2026-11-26T06:01:00Z', false],
    ['2026-11-26T08:01:00Z', false],
    ['2026-12-01T20:00:00Z', true],
    ['2026-12-02T05:00:00Z', true], // the last day's reward
    ['2026-12-02T15:00:00Z', false],
  ] as const) {
    assert.equal(dailyAlertOn(at(when)), on, when);
  }
});

test('the server script and the app use the same trial week', () => {
  const script = readFileSync('deploy/bin/brawlzone-daily-gift', 'utf8');
  assert.match(script, new RegExp(`^TRIAL_START=${DAILY_ALERT_DAYS.from}$`, 'm'));
  assert.match(script, new RegExp(`^TRIAL_END=${DAILY_ALERT_DAYS.to}$`, 'm'));
});

test('only the marked store link is a home-screen gift', () => {
  assert.equal(isHomeScreenGift('https://store.supercell.com/brawlstars#add-to-home-screen'), true);
  assert.equal(isHomeScreenGift('https://store.supercell.com/pt/brawlstars/#add-to-home-screen'), true);
  assert.equal(isHomeScreenGift('https://store.supercell.com/brawlstars'), false);
  assert.equal(isHomeScreenGift('https://example.com/brawlstars#add-to-home-screen'), false);
  assert.equal(isHomeScreenGift('https://store.supercell.com/brawlstars/product/gems/db31bef9'), false);
});
