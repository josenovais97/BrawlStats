import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BUBBLE_LANGS, detectBubbleLang } from '@/lib/bubble-langs';
import { UI_TRANSLATIONS } from '@/lib/bubble-ui';
import { fill, UI_EN, type UiKey } from '@/lib/bubble-ui-en';
import { nameKey, pickName, titleCaseIn } from '@/lib/game-l10n';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('every language the panel offers has a translation, and only those', () => {
  const offered = BUBBLE_LANGS.map((l) => l.code).filter((c) => c !== 'en').sort();
  assert.deepEqual(Object.keys(UI_TRANSLATIONS).sort(), offered);
});

test('every translation covers every string, with the same placeholders', () => {
  for (const [lang, strings] of Object.entries(UI_TRANSLATIONS)) {
    for (const key of Object.keys(UI_EN) as UiKey[]) {
      const text = strings[key];
      assert.ok(text && text.trim(), `${lang} is missing ${key}`);
      assert.deepEqual(placeholders(text), placeholders(UI_EN[key]), `${lang} ${key} placeholders`);
    }
    for (const key of Object.keys(strings)) {
      assert.ok(key in UI_EN, `${lang} has a key English does not: ${key}`);
    }
  }
});

test('fill replaces known placeholders and leaves unknown ones', () => {
  assert.equal(fill('Show {n} more', { n: 3 }), 'Show 3 more');
  assert.equal(fill('{a} and {b}', { a: 'x' }), 'x and {b}');
});

test('the phone language picks the game language', () => {
  assert.equal(detectBubbleLang(['fr-FR']), 'fr');
  assert.equal(detectBubbleLang(['es-ES']), 'es');
  assert.equal(detectBubbleLang(['es-MX']), 'es-419');
  assert.equal(detectBubbleLang(['es']), 'es');
  assert.equal(detectBubbleLang(['zh-TW']), 'zh-Hant');
  assert.equal(detectBubbleLang(['zh-Hant-HK']), 'zh-Hant');
  assert.equal(detectBubbleLang(['zh-CN']), 'zh-Hans');
  assert.equal(detectBubbleLang(['pt-PT']), 'pt');
  assert.equal(detectBubbleLang(['iw-IL']), 'he');
  assert.equal(detectBubbleLang(['in-ID']), 'id');
  assert.equal(detectBubbleLang(['sv-SE', 'de-DE']), 'de');
  assert.equal(detectBubbleLang(['sv-SE']), 'en');
  assert.equal(detectBubbleLang([]), 'en');
});

test('names match across the data and catalogue spellings', () => {
  assert.equal(nameKey("Belle's Rock"), nameKey('Belles Rock'));
  assert.equal(nameKey('MR. P'), nameKey('Mr. P'));
});

test('the calm spelling of a name wins over the button label', () => {
  assert.equal(pickName(['SPIKE', 'Spike'], 'fr'), 'Spike');
  assert.equal(pickName(['EL COSTO'], 'fr'), 'El Costo');
  assert.equal(pickName(['摇滚贝尔'], 'zh-Hans'), '摇滚贝尔');
  assert.equal(pickName(['ミスターP'], 'ja'), 'ミスターP');
  assert.equal(pickName([], 'fr'), null);
});

test('title case follows the language', () => {
  assert.equal(titleCaseIn('LARRY & LAWRIE', 'en'), 'Larry & Lawrie');
  assert.equal(titleCaseIn('8-BIT', 'en'), '8-Bit');
  // Turkish dotted capital I.
  assert.equal(titleCaseIn('İSTANBUL', 'tr'), 'İstanbul');
});

test('a possessive stays lowercase, an elision is capitalised', () => {
  assert.equal(titleCaseIn("BELLE'S ROCK", 'en'), "Belle's Rock");
  assert.equal(titleCaseIn("l'arène", 'fr'), "L'Arène");
});
