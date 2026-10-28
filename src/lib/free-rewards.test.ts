import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rewardArt, rewardBase, wikiArtCandidates } from '@/lib/free-rewards';

/**
 * Reward names as the job saw them (2026-10-21 to 10-28). On 2026-10-28 a
 * "1x Chaos Drop" matched none of the local art and showed the rainbow box.
 */
test('reward names come down to the thing they give', () => {
  assert.equal(rewardBase('1x Chaos Drop'), 'Chaos Drop');
  assert.equal(rewardBase('2000 Credits'), 'Credits');
  assert.equal(rewardBase('1,000 Power Points'), 'Power Points');
  assert.equal(rewardBase('Mega Box x3'), 'Mega Box');
  assert.equal(rewardBase('Brawl Pass'), 'Brawl Pass');
});

test('wiki candidates: currencies use the Icon- files, items their own name', () => {
  assert.deepEqual(wikiArtCandidates('1x Chaos Drop'), ['Chaos Drop.png']);
  assert.deepEqual(wikiArtCandidates('2000 Credits'), ['Icon-Credit.png', 'Credits.png', 'Credit.png']);
  assert.deepEqual(wikiArtCandidates('500 Gems'), ['Icon-Gem.png', 'Gems.png', 'Gem.png']);
  assert.deepEqual(wikiArtCandidates('1x Vince Box'), ['Vince Box.png']);
  assert.deepEqual(wikiArtCandidates('3 Pumpkin Boxes'), ['Pumpkin Boxes.png', 'Pumpkin Box.png']);
  // "Pass" is not a plural.
  assert.deepEqual(wikiArtCandidates('Brawl Pass'), ['Brawl Pass.png']);
  assert.deepEqual(wikiArtCandidates('Bling'), ['Icon-Bling.png', 'Bling.png']);
});

test('our own art, then the gift for anything unknown', () => {
  assert.equal(rewardArt('Legendary Starr Drop'), '/icons/starr-drop.png');
  assert.equal(rewardArt('Mega Box'), '/rewards/box-red.png');
  assert.equal(rewardArt('1x Chaos Drop'), '/rewards/gift.png');
  assert.equal(rewardArt('Pirate Gene'), '/rewards/gift.png');
});
