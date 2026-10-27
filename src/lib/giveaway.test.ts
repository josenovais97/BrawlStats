import assert from 'node:assert/strict';
import { test } from 'node:test';

import { entriesFor, isCode, isOpen, newCode, normaliseEmail, rank } from '@/lib/giveaway';
import { drawWinner } from '@/lib/giveaway-draw';

test('points: 1 to enter, +2 for Discord, +1 per friend with no cap', () => {
  assert.deepEqual(entriesFor(false, 0), { base: 1, discord: 0, follows: 0, referrals: 0, total: 1 });
  assert.equal(entriesFor(true, 3).total, 6);
  assert.equal(entriesFor(true, 50).total, 53);
  assert.equal(entriesFor(false, 0, 2).total, 3, '+1 per followed platform');
  assert.equal(entriesFor(false, 0, 9).follows, 3, 'never more than the three platforms');
});

test('codes are eight readable characters', () => {
  let i = 0;
  const code = newCode(() => i++ % 5);
  assert.equal(code.length, 8);
  assert.ok(isCode(code));
  assert.equal(isCode('ABCD0OIL'), false);
  assert.equal(isCode('short'), false);
});

test('emails are trimmed, lowercased and sanity-checked', () => {
  assert.equal(normaliseEmail('  Kid@Example.COM '), 'kid@example.com');
  assert.equal(normaliseEmail('nope'), null);
  assert.equal(normaliseEmail('a@b'), null);
});

test('open between the dates only', () => {
  const g = { id: 'x', prize: '', opensAt: '2026-01-01T00:00:00Z', closesAt: '2026-02-01T00:00:00Z' };
  assert.equal(isOpen(Date.parse('2025-12-31T23:59:59Z'), g), false);
  assert.equal(isOpen(Date.parse('2026-01-15T00:00:00Z'), g), true);
  assert.equal(isOpen(Date.parse('2026-02-01T00:00:00Z'), g), false);
});

test('most points wins; a tie goes to whoever entered first', () => {
  const rows = [
    { code: 'A', playerName: 'late tie', points: 9, enteredAt: 20 },
    { code: 'B', playerName: 'low', points: 3, enteredAt: 1 },
    { code: 'C', playerName: 'early tie', points: 9, enteredAt: 10 },
  ];
  assert.deepEqual(rank(rows).map((r) => r.playerName), ['early tie', 'late tie', 'low']);
});

test('the draw is deterministic, order-proof and weighted by points', () => {
  const tickets = [
    { code: 'AAAAAAAA', playerTag: '#A', entries: 1 },
    { code: 'BBBBBBBB', playerTag: '#B', entries: 9 },
  ];
  const r = 'ab'.repeat(32);
  const one = drawWinner(tickets, r);
  assert.deepEqual(drawWinner([...tickets].reverse(), r), one, 'input order does not matter');
  let b = 0;
  for (let i = 0; i < 2000; i++) {
    if (drawWinner(tickets, i.toString(16).padStart(64, '0')).winner.code === 'BBBBBBBB') b++;
  }
  assert.ok(b > 1700 && b < 1900, String(b));
});
