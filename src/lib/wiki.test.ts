import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseInfobox } from '@/lib/wiki';

/**
 * Regression tests for infobox template matching.
 *
 * The bug these exist for: MediaWiki treats a space and an underscore in a
 * template name as the same character, and the wiki's editors use both. Brock
 * and Surge write `{{Brawler_Infobox`, the other 105 brawlers write
 * `{{Brawler Infobox`, and a pattern that only allowed the space returned an
 * empty parameter map for those two — which the brawler page rendered as a
 * silently missing combat-stats section while every other section on it kept
 * working. Nothing threw, so nothing said so.
 */

/** Trimmed to the shape that matters: template name, then piped parameters. */
const infobox = (name: string) =>
  `{{Protection}}\n{{${name}|Title = Boom!|Rarity = Rare|Class = Marksman` +
  `|Health = 3000|AttackLabel = Damage|Attack = 1160` +
  `|SuperLabel = Damage per rocket|Super = 1040}}\n{{Quote|Brock is…}}`;

test('the shared brawler infobox parses', () => {
  const box = parseInfobox(infobox('Brawler Infobox'));

  assert.equal(box.Health, '3000');
  assert.equal(box.SuperLabel, 'Damage per rocket');
});

test('an underscore in the template name parses the same way', () => {
  // Brock and Surge, as of the audit that found this.
  const spaced = parseInfobox(infobox('Brawler Infobox'));
  const scored = parseInfobox(infobox('Brawler_Infobox'));

  assert.deepEqual(scored, spaced);
  assert.equal(scored.Health, '3000');
});

test('a brawler with its own infobox template still parses', () => {
  // Chester, Kaze and Buzz Lightyear carry a per-brawler template with the
  // same parameter names, which is why the prefix is matched loosely.
  for (const name of ['Chester Infobox', 'Kaze Infobox', 'BuzzLightyear Infobox']) {
    assert.equal(parseInfobox(infobox(name)).Health, '3000', name);
  }
});

test('a named kind matches either separator', () => {
  const map = '{{Map_Infobox|Name = Shooting Star|GameMode = Bounty}}';

  assert.equal(parseInfobox(map, 'Map Infobox').GameMode, 'Bounty');
  assert.equal(parseInfobox(map, 'Map_Infobox').GameMode, 'Bounty');
});

test('a page with no infobox yields no parameters rather than throwing', () => {
  assert.deepEqual(parseInfobox('{{Quote|No box here}}'), {});
  assert.deepEqual(parseInfobox(''), {});
});

test('an unrelated template is not mistaken for the infobox', () => {
  // The prefix is loose, not unbounded: it must still end in the kind.
  assert.deepEqual(parseInfobox('{{Brawler Navbox|Health = 3000}}'), {});
});
