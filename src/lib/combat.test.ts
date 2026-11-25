import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NO_COMBAT, addGame, combatFromLog, combatFromStored, combatRates, expectedRates, playerCombat, type GameCombat } from '@/lib/combat';
import { BRAWLER_ID_BASE, rankedExtras } from '@/lib/ranked-extras';
import type { BSBattleLogEntry } from '@/types/brawlstars';

const p = (tag: string, b: number, s: [number, number, number, number]) => ({
  tag, name: tag, brawler: { id: BRAWLER_ID_BASE + b, name: '', power: 11, trophies: 14 }, bannedBrawler: { id: BRAWLER_ID_BASE + 40 + b, name: '' },
  stats: { kills: s[0], deaths: s[1], damageDealt: s[2], healing: s[3], damageTaken: 1 },
});
const entry: BSBattleLogEntry = {
  battleTime: '20261125T083950.000Z',
  event: { id: 1, mode: 'heist', map: 'Hot Potato' },
  battle: {
    mode: 'heist', type: 'soloRanked', result: 'victory', duration: 100, starPlayer: p('#20Y', 2, [5, 1, 20_000, 200]),
    teams: [
      [p('#20J', 1, [1, 2, 10_000, 100]), p('#20Y', 2, [5, 1, 20_000, 200]), p('#20R', 5, [0, 0, 3_000, 0])],
      [p('#20P', 3, [2, 3, 5_000, 0]), p('#20Q', 4, [1, 1, 8_000, 0]), p('#20U', 6, [1, 3, 9_000, 10])],
    ],
  },
};

test('a game read live and read back from storage is the same game', () => {
  for (const tag of ['20J', '20Y', '20R', '20P', '20Q', '20U']) {
    const live = combatFromLog(entry, tag);
    const me = entry.battle.teams!.flat().find((x) => x.tag === `#${tag}`)!;
    assert.deepEqual(combatFromStored(me.brawler.id, rankedExtras(entry, tag).lineupStats), live, tag);
  }
  assert.equal(combatFromLog(entry, '20Y')!.star, true);
  assert.equal(combatFromStored(BRAWLER_ID_BASE + 99, rankedExtras(entry, '20Y').lineupStats), null);
  assert.equal(combatFromStored(1, []), null);
  assert.equal(combatFromLog({ ...entry, battle: { ...entry.battle, duration: undefined } }, '20Y'), null);
});

const g = (kills: number, deaths: number): GameCombat => ({ kills, deaths, damage: 1000, healing: 100, seconds: 100, star: kills > 3 });

test('totals turn into rates', () => {
  const t = [g(4, 2), g(2, 0), g(0, 4)].reduce(addGame, NO_COMBAT);
  assert.deepEqual(combatRates(t), { kd: 1, kills: 2, deaths: 2, damage: 10, healing: 1, star: 1 / 3, deathless: 1 / 3 });
  assert.equal(combatRates(NO_COMBAT), null);
});

test('stored days fill in before the oldest single game, and never twice', () => {
  const day = (d: string, games: number) => ({ day: d, brawlerId: 1, ...NO_COMBAT, games, kills: games * 2, deaths: games });
  const games = [
    { time: Date.parse('2026-11-24T10:00:00Z'), brawlerId: 1, combat: g(1, 1) },
    { time: Date.parse('2026-11-25T10:00:00Z'), brawlerId: 2, combat: g(3, 1) },
    { time: Date.parse('2026-11-20T10:00:00Z'), brawlerId: 2, combat: null },
  ];
  const c = playerCombat(games, [day('2026-11-22', 5), day('2026-11-24', 3), day('2026-11-25', 9)]);
  assert.equal(c.totals.games, 7, 'the 22nd from storage, the 24th and 25th from the games');
  assert.equal(c.byBrawler.get(1)!.games, 6);
  assert.equal(playerCombat([], [day('2026-11-22', 5)]).totals.games, 5);
});

test('others are measured on the same brawlers', () => {
  const row = (id: number, kills: number, deaths: number) => ({ id, games: 999, kills, deaths, kd: kills / deaths, damage: 100, healing: 10, star: 0.1, deathless: 0.2 });
  const mine = new Map([[1, { ...NO_COMBAT, games: 30 }], [2, { ...NO_COMBAT, games: 10 }]]);
  const e = expectedRates(mine, [row(1, 4, 4), row(2, 2, 1)])!;
  assert.equal(e.kills, 3.5);
  assert.equal(e.deaths, 3.25);
  assert.equal(expectedRates(mine, [row(2, 2, 1)]), null, 'three quarters of the games have no average');
});
