import assert from 'node:assert/strict';
import { test } from 'node:test';

import { wikiThumb } from '@/lib/skin-art';

const base = 'https://static.wikia.nocookie.net/brawlstars/images/e/ea/Shade_Skin-Cinema.png/revision/latest';

test('adds a width to a Fandom revision URL, keeping the cache buster', () => {
  assert.equal(wikiThumb(`${base}?cb=202410292151`, 96), `${base}/scale-to-width-down/96?cb=202410292151`);
});

test('replaces a width that is already there', () => {
  assert.equal(wikiThumb(`${base}/scale-to-width-down/600?cb=1`, 96), `${base}/scale-to-width-down/96?cb=1`);
});

test('works without a query string', () => {
  assert.equal(wikiThumb(base, 400), `${base}/scale-to-width-down/400`);
});

test('leaves other URLs alone', () => {
  const other = 'https://cdn.brawlify.com/brawlers/model/16000086.png';
  assert.equal(wikiThumb(other, 96), other);
});
