import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  closestPrestige,
  mains,
  nextPrestige,
  onFire,
  prestigeOf,
  skinLabel,
} from '@/lib/player-showcase';
import type { BSPlayerBrawler } from '@/types/brawlstars';

function brawler(
  name: string,
  trophies: number,
  extra: Partial<BSPlayerBrawler> = {},
): BSPlayerBrawler {
  return {
    id: name.length,
    name,
    power: 11,
    rank: 1,
    trophies,
    highestTrophies: trophies,
    gadgets: [],
    starPowers: [],
    gears: [],
    ...extra,
  };
}

test('prestige follows current trophies in steps of 1,000', () => {
  assert.equal(prestigeOf(brawler('A', 42)), 0);
  assert.equal(prestigeOf(brawler('A', 1004)), 1);
  assert.equal(prestigeOf(brawler('A', 2999)), 2);
  // The payload's own field wins when it is there.
  assert.equal(prestigeOf(brawler('A', 1294, { prestigeLevel: 1, highestTrophies: 2000 })), 1);
});

test('the next mark is the next 1,000, and nothing past 3,000 is promised', () => {
  assert.deepEqual(
    { mark: nextPrestige(brawler('A', 2654))?.mark, toGo: nextPrestige(brawler('A', 2654))?.toGo },
    { mark: 3000, toGo: 346 },
  );
  assert.equal(nextPrestige(brawler('A', 3000)), null);
  assert.equal(nextPrestige(brawler('A', 3022)), null);
  assert.equal(nextPrestige(brawler('A', 999))?.level, 1);
});

test('closest prestige lists only brawlers in the last quarter, nearest first', () => {
  const list = closestPrestige([
    brawler('Far', 1300),
    brawler('Near', 1977),
    brawler('Nearer', 2990),
    brawler('Maxed', 3001),
    brawler('Edge', 750),
  ]);
  assert.deepEqual(list.map((t) => t.brawler.name), ['Nearer', 'Near', 'Edge']);
});

test('mains are the most trophies, peak breaking ties', () => {
  const list = mains([
    brawler('Low', 500),
    brawler('TieA', 3000, { highestTrophies: 3000 }),
    brawler('TieB', 3000, { highestTrophies: 3053 }),
    brawler('Top', 3013),
  ]);
  assert.deepEqual(list.map((b) => b.name), ['Top', 'TieB', 'TieA']);
});

test('only streaks of three or more are on fire, longest first', () => {
  const list = onFire([
    brawler('Two', 100, { currentWinStreak: 2 }),
    brawler('Nine', 100, { currentWinStreak: 9 }),
    brawler('Three', 100, { currentWinStreak: 3 }),
    brawler('None', 100),
  ]);
  assert.deepEqual(list.map((b) => b.name), ['Nine', 'Three']);
});

test('the default skin has no label; others are single-line', () => {
  assert.equal(skinLabel(brawler('SHELLY', 0, { skin: { id: 1, name: 'SHELLY' } })), null);
  assert.equal(
    skinLabel(brawler('SHELLY', 0, { skin: { id: 2, name: 'SQUAD BUSTER\nSHELLY' } })),
    'SQUAD BUSTER SHELLY',
  );
  assert.equal(skinLabel(brawler('SHELLY', 0)), null);
});
