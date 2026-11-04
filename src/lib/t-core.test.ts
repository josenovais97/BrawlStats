import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fill, makeT } from '@/lib/t-core';

const RU = '{n|one:бой|few:боя|many:боёв|other:бои}';

test('plural forms follow the language’s own rules', () => {
  assert.equal(fill(`{n} ${RU}`, { n: 1 }, 'ru'), '1 бой');
  assert.equal(fill(`{n} ${RU}`, { n: 3 }, 'ru'), '3 боя');
  assert.equal(fill(`{n} ${RU}`, { n: 5 }, 'ru'), '5 боёв');
  assert.equal(fill(`{n} ${RU}`, { n: 11 }, 'ru'), '11 боёв');
  assert.equal(fill(`{n} ${RU}`, { n: 21 }, 'ru'), '21 бой');
  assert.equal(fill(`{n} ${RU}`, { n: 104 }, 'ru'), '104 боя');
});

test('a formatted number still picks its form', () => {
  assert.equal(fill(`{n} ${RU}`, { n: '1 234' }, 'ru'), '1 234 боя');
});

test('without the count, the bare form', () => {
  assert.equal(fill(RU, undefined, 'ru'), 'бои');
});

test('makeT passes its language through', () => {
  const t = makeT({ battles: RU }, 'ru');
  assert.equal(t('battles', { n: 2 }), 'боя');
  assert.equal(makeT(null)('battles', { n: 2 }), 'battles');
});

test('context suffixes and ordinary placeholders are untouched', () => {
  assert.equal(makeT(null)('Brawl Stars|hero-1'), 'Brawl Stars');
  assert.equal(fill('{a} vs {b}', { a: 'X', b: 'Y' }, 'ru'), 'X vs Y');
});
