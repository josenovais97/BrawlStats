import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_ALLIES, MAX_BANS, MAX_ENEMIES, draftHref, resolveDraftRoute } from '@/lib/draft-route';

/**
 * The draft URL is the tool's entire state, and two of its rules are the kind
 * that break silently rather than loudly.
 */

const MAP = { mode: 'gemGrab', map: 'Hard Rock Mine' };
const SHELLY = 16_000_000;
const COLT = 16_000_001;
const NITA = 16_000_002;

test('a bare map has no side segments', () => {
  assert.equal(draftHref(MAP), '/draft/gem-grab/hard-rock-mine');
});

test('enemies alone keep the short form old links used', () => {
  // Adding allies must not change the spelling of a URL that has none, or
  // every enemy-only link already shared would stop being canonical.
  assert.equal(
    draftHref({ ...MAP, enemies: [COLT, NITA] }),
    '/draft/gem-grab/hard-rock-mine/1-2',
  );
});

test('allies force the enemy slot to be spelled, even when empty', () => {
  // A path cannot carry `//`, so the empty side needs a marker.
  assert.equal(draftHref({ ...MAP, allies: [COLT] }), '/draft/gem-grab/hard-rock-mine/x/1');
  assert.equal(
    draftHref({ ...MAP, enemies: [NITA], allies: [COLT] }),
    '/draft/gem-grab/hard-rock-mine/2/1',
  );
});

test('Shelly survives the round trip', () => {
  /*
   * Shelly is brawler 16000000, so her short id is 0 — and the original filter
   * was `id > ID_BASE`, which is false for exactly her. She was dropped from
   * every draft without an error, which is the worst possible way for the
   * game's most-owned brawler to go missing.
   */
  const href = draftHref({ ...MAP, enemies: [SHELLY] });
  assert.equal(href, '/draft/gem-grab/hard-rock-mine/0');

  const route = resolveDraftRoute(['gem-grab', 'hard-rock-mine', '0']);
  assert.deepEqual(route?.enemies, [SHELLY]);
});

test('Shelly survives on the ally side too', () => {
  const route = resolveDraftRoute(['gem-grab', 'hard-rock-mine', 'x', '0']);
  assert.deepEqual(route?.allies, [SHELLY]);
  assert.deepEqual(route?.enemies, []);
});

test('both sides decode independently', () => {
  const route = resolveDraftRoute(['gem-grab', 'hard-rock-mine', '1-2', '0']);
  assert.deepEqual(route?.enemies, [COLT, NITA]);
  assert.deepEqual(route?.allies, [SHELLY]);
});

test('an empty path is the empty board', () => {
  const route = resolveDraftRoute(undefined);
  assert.deepEqual(route, { enemies: [], allies: [], bans: [] });
});

test('a side that parses to nothing is a typo, not an empty side', () => {
  // `x` means empty; anything else that yields no ids is a mistyped link, and
  // silently showing the empty board would make it look like it worked.
  assert.equal(resolveDraftRoute(['gem-grab', 'hard-rock-mine', 'nope']), null);
  assert.equal(resolveDraftRoute(['gem-grab', 'hard-rock-mine', '1', 'nope']), null);
});

test('a lone empty enemy side is not a state', () => {
  // "/x" says "no enemies" on a URL that already means that.
  assert.equal(resolveDraftRoute(['gem-grab', 'hard-rock-mine', 'x']), null);
});

test('shapes the tool does not have are rejected', () => {
  assert.equal(resolveDraftRoute(['gem-grab']), null);
  // Five segments is now a real shape (map, enemies, allies, bans); six is not.
  assert.equal(resolveDraftRoute(['a', 'b', '1', '2', '3', '4']), null);
});

/* --- bans ------------------------------------------------------------- */

test('bans force both earlier sides to be spelled', () => {
  assert.equal(
    draftHref({ mode: 'Gem Grab', map: 'Hard Rock Mine', bans: [16000007, 16000009] }),
    '/draft/gem-grab/hard-rock-mine/x/x/7-9',
  );
});

test('a full board round-trips', () => {
  const href = draftHref({
    mode: 'Gem Grab',
    map: 'Hard Rock Mine',
    enemies: [16000003, 16000012],
    allies: [16000045],
    bans: [16000007, 16000009, 16000011],
  });
  assert.equal(href, '/draft/gem-grab/hard-rock-mine/3-12/45/7-9-11');

  const back = resolveDraftRoute(href.replace('/draft/', '').split('/'));
  assert.deepEqual(back?.enemies, [16000003, 16000012]);
  assert.deepEqual(back?.allies, [16000045]);
  assert.deepEqual(back?.bans, [16000007, 16000009, 16000011]);
});

test('links made before bans existed still resolve', () => {
  // The whole point of appending rather than reordering: every URL already
  // shared keeps working, and keeps meaning what it meant.
  assert.deepEqual(resolveDraftRoute(['gem-grab', 'hard-rock-mine', '3-12']), {
    modeSlug: 'gem-grab',
    mapSlug: 'hard-rock-mine',
    enemies: [16000003, 16000012],
    allies: [],
    bans: [],
  });
});

test('each side keeps its own limit', () => {
  // Allies were sliced at the enemy cap of three; a 3v3 draft has two.
  const route = resolveDraftRoute([
    'gem-grab',
    'hard-rock-mine',
    '1-2-3-4-5',
    '6-7-8-9',
    '10-11-12-13-14-15-16-17',
  ]);
  assert.equal(route?.enemies.length, MAX_ENEMIES);
  assert.equal(route?.allies.length, MAX_ALLIES);
  assert.equal(route?.bans.length, MAX_BANS);
});

test('a ban segment that parses to nothing is a typo', () => {
  assert.equal(resolveDraftRoute(['gem-grab', 'hard-rock-mine', 'x', 'x', 'nope']), null);
});

test('an empty board spelled the long way is not a state', () => {
  assert.equal(resolveDraftRoute(['gem-grab', 'hard-rock-mine', 'x', 'x']), null);
});

test('Shelly survives on the ban side too', () => {
  const href = draftHref({ mode: 'Gem Grab', map: 'Hard Rock Mine', bans: [16000000] });
  assert.deepEqual(resolveDraftRoute(href.replace('/draft/', '').split('/'))?.bans, [16000000]);
});
