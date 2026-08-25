import assert from 'node:assert/strict';
import { test } from 'node:test';

import { titleCase, titleCaseLabel } from '@/lib/format';

/**
 * This existed three times before it existed once.
 *
 * Each copy was tuned to whatever text sat in front of it, and each was wrong
 * on the other's: the map page's broke brawler names, the brawler page's broke
 * map names. The cases below are the ones that actually differed, kept so a
 * future simplification of the regex has to face them.
 */

test('capitalises each word', () => {
  assert.equal(titleCase('HARD ROCK MINE'), 'Hard Rock Mine');
  assert.equal(titleCase('LARRY & LAWRIE'), 'Larry & Lawrie');
});

test('a hyphen starts a new word — brawler names depend on it', () => {
  // The map page's version produced "8-bit" and "R-t".
  assert.equal(titleCase('8-BIT'), '8-Bit');
  assert.equal(titleCase('R-T'), 'R-T');
});

test('an apostrophe does not — map names depend on that', () => {
  // The brawler page's version produced "Belle'S Rock".
  assert.equal(titleCase("BELLE'S ROCK"), "Belle's Rock");
});

test('a full stop is not a word break either', () => {
  assert.equal(titleCase('MR. P'), 'Mr. P');
});

test('already-cased input is normalised rather than left alone', () => {
  assert.equal(titleCase('Hard Rock Mine'), 'Hard Rock Mine');
  assert.equal(titleCase('hard rock mine'), 'Hard Rock Mine');
});

test('titleCaseLabel keeps roman numerals, which is why it is separate', () => {
  // Rank names come back as "GOLD III"; titleCase would give "Gold Iii".
  assert.equal(titleCaseLabel('GOLD III'), 'Gold III');
  assert.equal(titleCase('GOLD III'), 'Gold Iii');
});

test('empty input is safe in both', () => {
  assert.equal(titleCase(''), '');
  assert.equal(titleCaseLabel(''), '');
  assert.equal(titleCaseLabel(null), '');
});
