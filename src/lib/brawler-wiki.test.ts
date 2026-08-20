import assert from 'node:assert/strict';
import { test } from 'node:test';

import { combatStatLabels } from '@/lib/brawler-wiki';

/**
 * Regression tests for the combat-stat labels.
 *
 * The bug these exist for: the wiki infobox labels a brawler's main attack and
 * its Super independently, and for much of the roster it gives them identical
 * wording. Rendered straight, the combat grid showed
 *
 *   Damage per bullet   360
 *   Damage per bullet   320
 *
 * which are two different statistics under one name. The rule below is not a
 * per-brawler fix-up table, so it has to hold for labels no one has seen yet —
 * hence the sweep at the bottom rather than three hand-picked cases.
 */

/** Infobox labels seen across the roster, plus the shapes that break naively. */
const LABEL_CORPUS = [
  null,
  '',
  '   ',
  'Damage',
  'Damage per bullet',
  'Damage per shell',
  'Damage per projectile',
  'Damage per hit',
  'Damage per blade',
  'Damage per second',
  'Healing',
  'Healing per second',
  'Shield',
  'Super damage',
  'Super healing',
  'Main attack damage',
  'damage per bullet',
  'DPS',
  '  Damage per bullet  ',
];

test('a shared infobox label is split into main attack and Super', () => {
  const labels = combatStatLabels('Damage per bullet', 'Damage per bullet');

  assert.equal(labels.attack, 'Main attack damage per bullet');
  assert.equal(labels.super, 'Super damage per bullet');
});

test('the wiki wording carries the attack type rather than a hardcoded one', () => {
  // Nothing here is Colt-specific: the same collision on a different weapon
  // keeps that weapon's noun.
  assert.deepEqual(combatStatLabels('Damage per shell', 'Damage per shell'), {
    attack: 'Main attack damage per shell',
    super: 'Super damage per shell',
  });
  assert.deepEqual(combatStatLabels('Damage per blade', 'Damage per blade'), {
    attack: 'Main attack damage per blade',
    super: 'Super damage per blade',
  });
});

test('labels that already differ keep the wiki wording, and the Super is named', () => {
  const labels = combatStatLabels('Damage', 'Healing');

  // The attack row is only qualified when it would otherwise collide.
  assert.equal(labels.attack, 'Damage');
  // "Healing" alone in a six-cell grid does not say which half of the kit it
  // belongs to, so the Super row is always marked.
  assert.equal(labels.super, 'Super healing');
});

test('a Super label the wiki already qualifies is not doubled up', () => {
  assert.equal(combatStatLabels('Damage', 'Super damage').super, 'Super damage');
  assert.equal(combatStatLabels('Damage', 'super damage').super, 'super damage');
});

test('missing labels fall back to plain Attack and Super', () => {
  assert.deepEqual(combatStatLabels(null, null), { attack: 'Attack', super: 'Super' });
  assert.deepEqual(combatStatLabels('  ', undefined), {
    attack: 'Attack',
    super: 'Super',
  });
});

test('an acronym label is not lowercased into nonsense', () => {
  assert.equal(combatStatLabels('Damage', 'DPS').super, 'Super DPS');
});

test('no pair of infobox labels can produce one ambiguous label', () => {
  for (const attackLabel of LABEL_CORPUS) {
    for (const superLabel of LABEL_CORPUS) {
      const { attack, super: sup } = combatStatLabels(attackLabel, superLabel);

      assert.notEqual(
        attack.trim().toLowerCase(),
        sup.trim().toLowerCase(),
        `"${attackLabel}" / "${superLabel}" collapsed to the same label: "${attack}"`,
      );
      // A blank label is as ambiguous as a duplicated one.
      assert.ok(attack.trim().length > 0);
      assert.ok(sup.trim().length > 0);
    }
  }
});
