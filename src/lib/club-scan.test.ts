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

/** `[id, power]`, or `[id, power, true]` for a hypercharge. */
function member(
  tag: string,
  name: string,
  trophies: number,
  roster: Array<[number, number] | [number, number, boolean]>,
): ScannedMember {
  return {
    tag,
    name,
    trophies,
    roster: roster.map(([id, power, hypercharge]) => ({
      id,
      power,
      hypercharge: hypercharge === true,
    })),
  };
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
    member('A', 'Ana', 10, [[1, 11, true], [2, 11, true]]),
    member('B', 'Ben', 10, [[1, 11, true]]),
    member('C', 'Cal', 10, [[1, 11, true]]),
  ])!;
  const ana = out.members.find((m) => m.tag === 'A')!;
  const ben = out.members.find((m) => m.tag === 'B')!;
  assert.deepEqual(ana.exclusives, ['WENDY'], 'only Ana has Wendy hypercharged');
  assert.deepEqual(ben.exclusives, [], 'Shade is hypercharged by three, so nobody is exclusive');
});

test('hypercharge is what separates two maxed members', () => {
  // The shape measured against the top global club: everybody owns everything
  // at power 11, so plain coverage says 100% thirty times and the board falls
  // through to the trophy order it exists not to be.
  const out = scan([
    member('RICH', 'Rich', 90_000, [[1, 11], [2, 11], [3, 11], [4, 11]]),
    member('POOR', 'Poor', 400, [[1, 11, true], [2, 11, true], [3, 11], [4, 11]]),
  ])!;
  assert.equal(out.coverage, 1, 'between them, and each alone, they field all four');
  assert.equal(out.members[0].tag, 'POOR', 'the hypercharges rank, not the trophies');
  assert.equal(out.members[0].hyperCoverage, 0.5);
  assert.equal(out.members[1].hyperCoverage, 0);
  assert.equal(out.hyperCoverage, 0.5);
  assert.deepEqual(out.hyperGaps, ['AMBER', 'JUJU']);
});

test('a hypercharge below power 11 cannot be used, so it does not count', () => {
  const out = scan([member('A', 'Ana', 10, [[1, 10, true], [2, 11, true]])])!;
  assert.equal(out.hyperCoverage, 0.25, 'only the power 11 one');
  assert.equal(out.coverage, 0.5, 'both are still fieldable brawlers');
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
