import assert from 'node:assert/strict';
import { test } from 'node:test';

import { likePattern, rankMatches, MAX_RESULTS } from '@/lib/player-search';

test('a query cannot smuggle in its own wildcards', () => {
  assert.equal(likePattern('a_b%c'), '%a\\_b\\%c%');
  assert.equal(likePattern('x\\y'), '%x\\\\y%');
});

test('exact names first, then prefixes, then the rest; the freshest source wins a tag', () => {
  const row = (tag: string, name: string, trophies: number | null, pri: number) => ({ tag, name, trophies, iconId: null, pri });
  const out = rankMatches('ana', [
    row('A', 'Banana', 90_000, 2),
    row('B', 'Anabel', 10_000, 2),
    row('C', 'ANA', 500, 2),
    row('B', 'Anabel II', 12_000, 1),
  ]);
  assert.deepEqual(out.map((r) => r.tag), ['C', 'B', 'A']);
  assert.equal(out[1].name, 'Anabel II', 'player_names beats sampled_players');
});

test('never more than MAX_RESULTS', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ tag: `T${i}`, name: `p${i}`, trophies: i, iconId: null, pri: 2 }));
  assert.equal(rankMatches('p', rows).length, MAX_RESULTS);
});
