import assert from 'node:assert/strict';
import test from 'node:test';

import { isReaction, parsePostId } from './bubble-feed-id';

test('post ids name their players', () => {
  assert.deepEqual(parsePostId('rank.2PP8L9QY.51.7'), { kind: 'rank', tags: ['2PP8L9QY'] });
  assert.deepEqual(parsePostId('pass.2PP8L9QY.9UVJ0RC.20261120'), { kind: 'pass', tags: ['2PP8L9QY', '9UVJ0RC'] });
  assert.deepEqual(parsePostId('awards.2PP8L9QY.20261116.a1b2'), { kind: 'awards', tags: ['2PP8L9QY'] });
});

test('anything else is refused', () => {
  for (const bad of ['', 'rank', 'hello.2PP8L9QY', 'rank.hello', 'rank.2PP8L9QY.<b>', 'pass.2PP8L9QY.x', 'rank.2PP8L9QY.1.2.3.4', 'rank.2PP8L9QY. 1', 42, null]) {
    assert.equal(parsePostId(bad), null, String(bad));
  }
});

test('reactions are a fixed set', () => {
  assert.equal(isReaction('fire'), true);
  assert.equal(isReaction('💩'), false);
  assert.equal(isReaction('FIRE'), false);
});
