import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyScan,
  correctionIndex,
  emptyBoard,
  idsOf,
  mergeSlots,
  normalise,
  resolvePlate,
  similarity,
} from '@/lib/bubble-scan';
import type { ScanPayload } from '@/lib/bubble-scan';

/**
 * The half of draft scanning that can be tested without a phone.
 *
 * Recognising pixels needs a device, a live match and a draft timer; deciding
 * what a recognition *means* needs none of those, so it lives in its own module
 * and is pinned here.
 */

const MODES = [
  {
    key: 'brawlBall',
    label: 'Brawl Ball',
    maps: [
      { mapName: 'Spiraling Out', mode: 'brawlBall' },
      { mapName: 'Backyard Bowl', mode: 'brawlBall' },
    ],
  },
  {
    key: 'gemGrab',
    label: 'Gem Grab',
    maps: [{ mapName: 'Hard Rock Mine', mode: 'gemGrab' }],
  },
];

const LIMITS = { bans: 6, allies: 2, enemies: 3 } as const;

test('a recognised map brings its mode with it', () => {
  const hit = resolvePlate({ ok: true, map: 'Spiraling Out' }, MODES);
  assert.equal(hit.map?.mapName, 'Spiraling Out');
  assert.equal(hit.mode, 'brawlBall');
});

test('a recognised mode alone still narrows the choice', () => {
  const hit = resolvePlate({ ok: true, mode: 'gemGrab' }, MODES);
  assert.equal(hit.map, null);
  assert.equal(hit.mode, 'gemGrab');
});

test('a map recognised on a first scan overrides a stale mode reading', () => {
  const hit = resolvePlate({ ok: true, mode: 'brawlBall', map: 'Hard Rock Mine' }, MODES);
  assert.equal(hit.map?.mapName, 'Hard Rock Mine');
  assert.equal(hit.mode, 'gemGrab', 'the map decides, because it is the more specific fact');
});

test('a name the panel does not know resolves to nothing rather than a guess', () => {
  const hit = resolvePlate({ ok: true, map: 'Retired Map', mode: 'duoShowdown' }, MODES);
  assert.equal(hit.map, null);
  assert.equal(hit.mode, null);
});

test('an empty reading is not an error', () => {
  const hit = resolvePlate({ ok: true }, MODES);
  assert.deepEqual(hit, { mode: null, map: null, ambiguous: false });
});

test('punctuation and case are not part of a name', () => {
  assert.equal(normalise('Spiraling Out'), 'SPIRALINGOUT');
  assert.equal(normalise("Pinhole Punt"), 'PINHOLEPUNT');
  assert.equal(normalise('8-BIT'), '8BIT');
});

test('a clean read finds its map and its mode', () => {
  const hit = resolvePlate({ ok: true, text: ['BRAWL BALL', 'Spiraling Out'] }, MODES);
  assert.equal(hit.map?.mapName, 'Spiraling Out');
  assert.equal(hit.mode, 'brawlBall');
});

test('a read with a stray glyph still finds its map', () => {
  const hit = resolvePlate({ ok: true, text: ['BRAWL BALL', 'Spiralinq Outi'] }, MODES);
  assert.equal(hit.map?.mapName, 'Spiraling Out');
});

test('the recogniser lines do not have to arrive in order', () => {
  const hit = resolvePlate({ ok: true, text: ['Hard Rock Mine', 'GEM GRAB'] }, MODES);
  assert.equal(hit.map?.mapName, 'Hard Rock Mine');
  assert.equal(hit.mode, 'gemGrab');
});

test('text that matches nothing resolves to nothing rather than a guess', () => {
  const hit = resolvePlate({ ok: true, text: ['POWER LEVEL', 'PICK TURN', '19s'] }, MODES);
  assert.equal(hit.map, null);
  assert.equal(hit.mode, null);
});

test('a confirmed plate outranks the recogniser', () => {
  // The learned picture cannot be wrong about which map it is; the letters can.
  const hit = resolvePlate(
    { ok: true, map: 'Hard Rock Mine', text: ['BRAWL BALL', 'Spiraling Out'] },
    MODES,
  );
  assert.equal(hit.map?.mapName, 'Hard Rock Mine');
  assert.equal(hit.mode, 'gemGrab');
});

test('two maps sharing words are still told apart', () => {
  const s = similarity(normalise('Backyard Bowl'), normalise('Spiraling Out'));
  assert.ok(s < 0.62, `unrelated names should not match, got ${s}`);
});

test('a scan fills gaps and never removes a hand-set slot', () => {
  const current = { bans: [11, 12], allies: [] as number[], enemies: [99] };
  const merged = mergeSlots(
    current,
    { ok: true, bans: [13, null, 14], allies: [21], enemies: [null, 31] },
    LIMITS,
  );
  assert.deepEqual(merged.bans, [11, 12, 13, 14]);
  assert.deepEqual(merged.allies, [21]);
  assert.deepEqual(merged.enemies, [99, 31]);
});

test('a brawler already on the board is not added twice', () => {
  const merged = mergeSlots(
    { bans: [7], allies: [], enemies: [] },
    { ok: true, bans: [7], allies: [7], enemies: [] },
    LIMITS,
  );
  assert.deepEqual(merged.bans, [7]);
  assert.deepEqual(merged.allies, []);
});

test('a slot cannot be pushed past what the game allows', () => {
  const merged = mergeSlots(
    { bans: [], allies: [], enemies: [] },
    { ok: true, enemies: [1, 2, 3, 4, 5] },
    LIMITS,
  );
  assert.equal(merged.enemies.length, LIMITS.enemies);
});

test('a correction is only attributed when one slot went unread', () => {
  assert.equal(correctionIndex([5, null, 7]), 1);
  assert.equal(correctionIndex([null, null, 7]), null, 'ambiguous, so learn nothing');
  assert.equal(correctionIndex([5, 6, 7]), null, 'nothing was missed');
  assert.equal(correctionIndex(undefined), null);
});

// ---- shape 2: statuses, positions, and drafts ------------------------------

const R = (id: number) => ({ id, status: 'recognized' as const });
const EMPTY = { id: null, status: 'empty' as const };
const UNKNOWN = { id: null, status: 'unknown' as const };
const OCCLUDED = { id: null, status: 'occluded' as const };

const draft = (slots: Partial<Record<'bans' | 'allies' | 'enemies', unknown[]>>, extra = {}) =>
  ({ ok: true, v: 2, id: 1, screen: 'draft', ...slots, ...extra }) as ScanPayload;

test('the mode is read from its own line and the map only within that mode', () => {
  const hit = resolvePlate(draft({}, { modeText: ['GEM GRAB'], mapText: ['Hard Rock Mine'] }), MODES);
  assert.equal(hit.mode, 'gemGrab');
  assert.equal(hit.map?.mapName, 'Hard Rock Mine');
  assert.equal(hit.ambiguous, false);
});

test('a map line that fits a map in another mode is not taken', () => {
  // The mode line says Brawl Ball; the map line looks like a Gem Grab map.
  // The letters could be a misread of anything; the mode is the more
  // trustworthy word and the map stays open.
  const hit = resolvePlate(draft({}, { modeText: ['BRAWL BALL'], mapText: ['Hard Rock Mine'] }), MODES);
  assert.equal(hit.mode, 'brawlBall');
  assert.equal(hit.map, null);
});

test('two maps the text fits equally well are refused as ambiguous', () => {
  const twins = [
    {
      key: 'brawlBall',
      label: 'Brawl Ball',
      maps: [
        { mapName: 'Center Stage', mode: 'brawlBall' },
        { mapName: 'Center Stagd', mode: 'brawlBall' },
      ],
    },
  ];
  const hit = resolvePlate(draft({}, { modeText: ['BRAWL BALL'], mapText: ['CENTER STAG'] }), twins);
  assert.equal(hit.map, null);
  assert.equal(hit.ambiguous, true);
  assert.equal(hit.mode, 'brawlBall', 'the mode is still known');
});

test('a recognised slot fills a gap and unknown or occluded slots change nothing', () => {
  const board = { bans: [], allies: [{ id: 5, source: 'hand' as const }], enemies: [] };
  const out = applyScan(board, draft({ bans: [R(1), UNKNOWN, OCCLUDED], allies: [UNKNOWN, R(6), OCCLUDED], enemies: [R(9)] }), LIMITS);
  assert.deepEqual(idsOf(out.board.bans), [1]);
  assert.deepEqual(idsOf(out.board.allies), [5, 6]);
  assert.deepEqual(idsOf(out.board.enemies), [9]);
  assert.equal(out.newDraft, false);
  assert.equal(out.recognized, 3);
  assert.equal(out.unknown, 2);
  assert.equal(out.occluded, 2);
});

test("the reader's own card is not an ally", () => {
  const out = applyScan(emptyBoard(), draft({ allies: [R(1), R(2), R(3)] }, { self: 1 }), LIMITS);
  assert.deepEqual(idsOf(out.board.allies), [1, 3]);
});

test('a later scan replaces a misread at the same position, and only there', () => {
  const first = applyScan(emptyBoard(), draft({ allies: [R(1), R(2)] }), LIMITS);
  const second = applyScan(first.board, draft({ allies: [R(1), R(7)] }, { id: 2 }), LIMITS);
  assert.deepEqual(idsOf(second.board.allies), [1, 7]);
  assert.equal(second.replaced, 1);
  assert.equal(second.newDraft, false);
  assert.equal(second.board.allies[1].scanId, 2);
});

test('a hand-entered pick is never replaced by a scan', () => {
  const board = { bans: [], allies: [{ id: 5, source: 'hand' as const }], enemies: [] };
  const out = applyScan(board, draft({ allies: [R(6), R(7)] }), LIMITS);
  assert.deepEqual(idsOf(out.board.allies), [5, 6], 'the hand pick stays; one gap is filled');
});

test('a ban that changed is a new draft, even on the same map', () => {
  const first = applyScan(emptyBoard(), draft({ bans: [R(1), R(2)], allies: [R(3)] }), LIMITS);
  const second = applyScan(first.board, draft({ bans: [R(1), R(4)], allies: [UNKNOWN] }, { id: 2 }), LIMITS);
  assert.equal(second.newDraft, true);
  assert.equal(second.newDraftReason, 'a ban changed');
  assert.deepEqual(idsOf(second.board.bans), [1, 4]);
  assert.deepEqual(idsOf(second.board.allies), [], 'the old pick did not carry over');
});

test('picked slots reading empty again is a new draft', () => {
  const first = applyScan(emptyBoard(), draft({ allies: [R(1), R(2)], enemies: [R(3)] }), LIMITS);
  const second = applyScan(first.board, draft({ allies: [EMPTY, EMPTY], enemies: [EMPTY] }, { id: 2 }), LIMITS);
  assert.equal(second.newDraft, true);
  assert.deepEqual(second.board, emptyBoard());
});

test('one empty slot among known picks is a misread, not a new draft', () => {
  const first = applyScan(emptyBoard(), draft({ allies: [R(1), R(2)], enemies: [R(3)] }), LIMITS);
  const second = applyScan(first.board, draft({ allies: [EMPTY, R(2)], enemies: [R(3)] }, { id: 2 }), LIMITS);
  assert.equal(second.newDraft, false);
  assert.deepEqual(idsOf(second.board.allies), [1, 2], 'the earlier reading is kept');
});

test('a changed map resets the board whatever the slots say', () => {
  const first = applyScan(emptyBoard(), draft({ allies: [R(1)] }), LIMITS);
  const second = applyScan(first.board, draft({ allies: [R(1)] }, { id: 2 }), LIMITS, { newDraft: true });
  assert.equal(second.newDraft, true);
  assert.equal(second.newDraftReason, 'the map changed');
  assert.deepEqual(idsOf(second.board.allies), [1], 'and the new reading fills it again');
});

test('a reading that is not of a draft screen changes nothing', () => {
  const board = { bans: [{ id: 1, source: 'scan' as const, position: 0 }], allies: [], enemies: [] };
  const out = applyScan(board, { ok: false, screen: 'not-draft', bans: [R(9)] }, LIMITS);
  assert.deepEqual(out.board, board);
  assert.equal(out.newDraft, false);
});

test('a correction is attributed only to an unknown position', () => {
  assert.equal(correctionIndex([R(5), UNKNOWN, R(7)]), 1);
  assert.equal(correctionIndex([EMPTY, UNKNOWN, R(7)]), 1, 'empty is not a misread');
  assert.equal(correctionIndex([OCCLUDED, UNKNOWN]), 1, 'occluded is not a misread');
  assert.equal(correctionIndex([UNKNOWN, UNKNOWN]), null);
});
