import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeBoard, decodeOrder, encodeBoard } from '@/lib/tier-board';

/**
 * The share link is the only place a tier list is ever stored.
 *
 * There is no table of saved boards and no account behind one — "the link *is*
 * the tier list, so it keeps working for as long as anyone has it". That makes
 * this format a compatibility surface with no migration path: a change to it
 * does not break a deployment, it breaks every board anybody has already
 * pasted into a club chat, silently and permanently.
 *
 * So the literal spelling is asserted rather than just the round trip. The
 * round trip would still pass if both halves changed together, which is
 * exactly the mistake that would cost the old links.
 */

/** A stand-in catalogue: the ids these tests place. */
const KNOWN = new Set([16_000_001, 16_000_004, 16_000_005, 16_000_011]);

test('decodes the format that shipped', () => {
  const board = decodeBoard(new URLSearchParams('s=4.11&a=1.5'), KNOWN);

  assert.deepEqual(board, {
    16_000_004: 'S',
    16_000_011: 'S',
    16_000_001: 'A',
    16_000_005: 'A',
  });
});

test('encodes back to the same spelling', () => {
  const query = encodeBoard({
    S: [{ id: 16_000_004 }, { id: 16_000_011 }],
    A: [{ id: 16_000_001 }, { id: 16_000_005 }],
    B: [],
    C: [],
    D: [],
  });

  assert.equal(query, 's=4.11&a=1.5');
});

test('a board survives a round trip', () => {
  const rows = {
    S: [{ id: 16_000_011 }],
    A: [],
    B: [{ id: 16_000_004 }, { id: 16_000_001 }],
    C: [],
    D: [{ id: 16_000_005 }],
  };

  const decoded = decodeBoard(new URLSearchParams(encodeBoard(rows)), KNOWN);

  assert.deepEqual(decoded, {
    16_000_011: 'S',
    16_000_004: 'B',
    16_000_001: 'B',
    16_000_005: 'D',
  });
});

test('an id outside the catalogue is dropped, not rendered', () => {
  // The parameter is user-editable, so an unknown id has to be ignored rather
  // than turned into a broken tile.
  const board = decodeBoard(new URLSearchParams('s=4.999'), KNOWN);

  assert.deepEqual(board, { 16_000_004: 'S' });
});

test('the first tier wins when a link names an id twice', () => {
  // A hand-edited link cannot put one brawler in two rows.
  const board = decodeBoard(new URLSearchParams('s=4&b=4'), KNOWN);

  assert.deepEqual(board, { 16_000_004: 'S' });
});

test('placement order is preserved, not sorted by id', () => {
  /*
   * Order within a tier is meaningful — the leftmost is the best — and this is
   * the half that used to be lost. The order was recovered with
   * `Object.keys(initial).map(Number)`, and integer-like object keys iterate
   * numerically, so a board shared as "11 then 4" came back as "4 then 11".
   */
  const order = decodeOrder(new URLSearchParams('s=11.4'), KNOWN);

  assert.deepEqual(order, [16_000_011, 16_000_004]);
});

test('order spans tiers in tier order', () => {
  const order = decodeOrder(new URLSearchParams('a=5&s=11.4'), KNOWN);

  assert.deepEqual(order, [16_000_011, 16_000_004, 16_000_005]);
});

test('an empty link is an empty board rather than a throw', () => {
  assert.deepEqual(decodeBoard(new URLSearchParams(''), KNOWN), {});
  assert.deepEqual(decodeOrder(new URLSearchParams(''), KNOWN), []);
  assert.equal(encodeBoard({ S: [], A: [], B: [], C: [], D: [] }), '');
});
