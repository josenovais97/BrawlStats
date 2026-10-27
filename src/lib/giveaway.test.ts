import assert from 'node:assert/strict';
import { test } from 'node:test';

import { entriesFor, isCode, isOpen, newCode, normaliseEmail, REFERRAL_CAP } from '@/lib/giveaway';
import { drawWinner } from '@/lib/giveaway-draw';

test('entries: 1 to enter, +2 for Discord, +1 per friend up to the cap', () => {
  assert.deepEqual(entriesFor(false, 0), { base: 1, discord: 0, referrals: 0, total: 1 });
  assert.equal(entriesFor(true, 3).total, 6);
  assert.equal(entriesFor(true, 50).referrals, REFERRAL_CAP);
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

test('the draw is deterministic, order-proof and weighted by entries', () => {
  const tickets = [
    { code: 'AAAAAAAA', playerTag: '#A', entries: 1 },
    { code: 'BBBBBBBB', playerTag: '#B', entries: 9 },
  ];
  const r = 'ab'.repeat(32);
  const one = drawWinner(tickets, r);
  assert.deepEqual(drawWinner([...tickets].reverse(), r), one, 'input order does not matter');
  assert.equal(one.total, 10);
  // Over many beacon values, the 9-entry ticket should win about 90% of draws.
  let b = 0;
  for (let i = 0; i < 2000; i++) {
    if (drawWinner(tickets, i.toString(16).padStart(64, '0')).winner.code === 'BBBBBBBB') b++;
  }
  assert.ok(b > 1700 && b < 1900, String(b));
});
