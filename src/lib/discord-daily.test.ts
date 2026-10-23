import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dailyNumber, decodeDaily, encodeDaily, hearts, squares } from '@/lib/discord-daily';

test('a game state survives the round trip through a custom_id', () => {
  const ref = { action: 'answer', mode: 'zoom', date: '2026-10-23', n: 2 } as const;
  const id = encodeDaily(ref);
  assert.ok(id.length <= 100, 'Discord caps custom_id at 100 characters');
  assert.deepEqual(decodeDaily(id), ref);
});

test('anything else is refused', () => {
  assert.equal(decodeDaily('dly:x:zoom:2026-10-23:1'), null);
  assert.equal(decodeDaily('dly:g:classic:2026-10-23:1'), null);
  assert.equal(decodeDaily('dly:g:zoom:yesterday:1'), null);
  assert.equal(decodeDaily('dly:g:zoom:2026-10-23:7'), null);
  assert.equal(decodeDaily('profile:abc'), null);
});

test('numbers, hearts and squares match the site', () => {
  assert.equal(dailyNumber('2026-10-02'), 1);
  assert.equal(dailyNumber('2026-10-23'), 22);
  assert.equal(hearts(2), '❤️❤️❤️❤️🖤🖤');
  assert.equal(squares(3), '🟥🟥🟩');
  assert.equal(squares(0), '🟥🟥🟥🟥🟥🟥');
});
