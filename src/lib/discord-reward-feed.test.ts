import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canManageServer, rewardFeedMessage, rewardTitle } from '@/lib/discord-reward-feed';

test('reward titles drop a "1x", keep real counts', () => {
  assert.equal(rewardTitle('1x Chaos Drop'), 'Chaos Drop');
  assert.equal(rewardTitle('2000 Credits'), '2000 Credits');
});

test('only Manage Server or Administrator may set the feed', () => {
  assert.equal(canManageServer(String(0x20)), true);
  assert.equal(canManageServer(String(0x8)), true);
  assert.equal(canManageServer(String(0x400 | 0x800)), false);
  assert.equal(canManageServer(undefined), false);
  assert.equal(canManageServer('not a number'), false);
});

test('the post: one embed, a claim button per reward, and the site', () => {
  const one = rewardFeedMessage([{ name: '1x Chaos Drop', url: 'https://link.brawlstars.com/voucher/a' }], 'https://brawlzone.net/x/2.jpg');
  assert.match(one.embeds[0].title, /Chaos Drop$/);
  assert.deepEqual(one.components[0].components.map((b) => b.label), ['Claim Chaos Drop', 'All free rewards']);
  assert.deepEqual(one.allowed_mentions.parse, []);

  const five = rewardFeedMessage(
    Array.from({ length: 5 }, (_, i) => ({ name: `Reward ${i}`, url: `https://link.brawlstars.com/voucher/${i}` })),
    null,
  );
  // Discord allows five buttons in a row: four claims and the site.
  assert.equal(five.components[0].components.length, 5);
  assert.equal(five.components[0].components[4].label, 'All free rewards');
  assert.equal('image' in five.embeds[0], false);
});
