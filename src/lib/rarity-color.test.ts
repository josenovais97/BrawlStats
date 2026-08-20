import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FALLBACK_RARITY_COLOR, rarityColor } from '@/lib/brawlapi';

/**
 * Regression test for the rarity colour.
 *
 * The artwork source ships Pierce's Legendary rarity as `#fff11ev` — one
 * stray character on the end of `#fff11e`. That is not a cosmetic problem: an
 * invalid colour inside `color-mix()` invalidates the entire declaration, so
 * the card border, portrait plate or header wash it feeds simply disappears
 * wherever that brawler is rendered. It reached the page 43 times on one
 * profile before this was cleaned at the source.
 *
 * Nothing throws when it happens, which is why it needs a test rather than a
 * code review.
 */
test('a malformed colour never reaches a stylesheet', () => {
  // The exact value the artwork source ships.
  assert.equal(rarityColor('#fff11ev'), FALLBACK_RARITY_COLOR);

  for (const bad of [
    '',
    '#',
    '#ff',
    '#ffff',
    '#fffffff',
    '#gggggg',
    'red',
    'rgb(255,0,0)',
    // The shapes that would break `color-mix()` most creatively.
    '#fff11e;}',
    'var(--brand)',
    undefined,
    null,
  ]) {
    assert.equal(rarityColor(bad), FALLBACK_RARITY_COLOR, `${bad} should be rejected`);
  }
});

test('valid colours pass through untouched', () => {
  for (const good of ['#fff11e', '#FFF11E', '#f1e', '#F1E', '#000000', '#ffffff']) {
    assert.equal(rarityColor(good), good);
  }
});

test('the fallback is itself a valid colour', () => {
  // Otherwise the guard would be the bug.
  assert.match(FALLBACK_RARITY_COLOR, /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
  assert.equal(rarityColor(FALLBACK_RARITY_COLOR), FALLBACK_RARITY_COLOR);
});
