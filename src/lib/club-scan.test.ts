import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clubScan, type ScannedMember, type TopTierBrawler } from '@/lib/club-scan';

/**
 * The club board makes a claim about thirty people at once, which is exactly
 * the kind of number nobody checks by eye. Every case here is one where the
 * output would still look perfectly reasonable while being wrong.
 */

const TOP: TopTierBrawler[] = [
  { brawlerId: 1, brawlerName: 'SHADE' },
  { brawlerId: 2, brawlerName: 'WENDY' },
  { brawlerId: 3, brawlerName: 'AMBER' },
  { brawlerId: 4, brawlerName: 'JUJU' },
];

function member(
  tag: string,
  name: string,
  trophies: number,
  roster: Array<[number, number]>,
): ScannedMember {
  return { tag, name, trophies, roster: roster.map(([id, power]) => ({ id, power })) };
}

const scan = (members: ScannedMember[], missed = 0) =>
  clubScan({ members, topTier: TOP, usablePower: 9, missed });

test('coverage is the union, not the best member', () => {
  const out = scan([
    member('A', 'Ana', 10, [[1, 11], [2, 11]]),
    member('B', 'Ben', 10, [[3, 9]]),
  ])!;
  // Neither member is above 50% alone; together they hold three of four.
  assert.equal(out.members[0].coverage, 0.5);
  assert.equal(out.coverage, 0.75);
  assert.deepEqual(out.gaps, ['JUJU']);
});

test('a brawler below the usable floor is not fielded', () => {
  const out = scan([member('A', 'Ana', 10, [[1, 8], [2, 9]])])!;
  assert.equal(out.coverage, 0.25, 'power 8 does not count, power 9 does');
  assert.deepEqual(out.gaps, ['SHADE', 'AMBER', 'JUJU']);
});

test('exclusives name who the club cannot replace', () => {
  const out = scan([
    member('A', 'Ana', 10, [[1, 11], [2, 11]]),
    member('B', 'Ben', 10, [[1, 11]]),
    member('C', 'Cal', 10, [[1, 11]]),
  ])!;
  const ana = out.members.find((m) => m.tag === 'A')!;
  const ben = out.members.find((m) => m.tag === 'B')!;
  assert.deepEqual(ana.exclusives, ['WENDY'], 'only Ana holds Wendy');
  assert.deepEqual(ben.exclusives, [], 'Shade is held by three, so nobody is exclusive on it');
});

test('the board is not the trophy list again', () => {
  const out = scan([
    // Enormous trophy count, owns nothing that wins.
    member('RICH', 'Rich', 90_000, [[9, 11]]),
    member('POOR', 'Poor', 400, [[1, 11], [2, 11]]),
  ])!;
  assert.equal(out.members[0].tag, 'POOR', 'coverage outranks trophies');
});

test('trophies break a tie, and only a tie', () => {
  const out = scan([
    member('LOW', 'Low', 100, [[1, 11]]),
    member('HIGH', 'High', 900, [[2, 11]]),
  ])!;
  assert.equal(out.members[0].tag, 'HIGH');
  assert.equal(out.members[0].coverage, out.members[1].coverage);
});

test('an unreadable member is reported rather than counted as owning nothing', () => {
  const out = scan([member('A', 'Ana', 10, [[1, 11]])], 3)!;
  assert.equal(out.missed, 3);
  assert.equal(out.members.length, 1, 'only members we actually read are ranked');
});

test('no top tier is our gap, not a verdict of 0% on the club', () => {
  assert.equal(
    clubScan({ members: [member('A', 'Ana', 10, [[1, 11]])], topTier: [], usablePower: 9 }),
    null,
  );
});
