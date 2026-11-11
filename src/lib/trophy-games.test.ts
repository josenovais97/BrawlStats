import assert from 'node:assert/strict';
import { test } from 'node:test';

import { avgPlace, bestBy, mergeTrophyGames, trophyBreakdown, trophyDays, trophyGamesFromLog, type TrophyGame } from '@/lib/trophy-games';
import type { BSBattleLogEntry } from '@/types/brawlstars';

const g = (time: number, result: string | null, change: number, extra: Partial<TrophyGame> = {}): TrophyGame => ({
  time, brawlerId: 1, result, rank: null, mode: 'gemGrab', map: 'Hard Rock Mine', trophyChange: change, ...extra,
});

test('reads trophy games from the log, Showdown included, and skips Ranked', () => {
  const p = (tag: string, id: number) => ({ tag, name: tag, brawler: { id, name: String(id), power: 11, trophies: 0 } });
  const entries: BSBattleLogEntry[] = [
    { battleTime: '20261111T080000.000Z', event: { id: 1, mode: 'gemGrab', map: 'Hard Rock Mine' }, battle: { mode: 'gemGrab', type: 'ranked', result: 'victory', trophyChange: 8, teams: [[p('#ME', 5), p('#A', 6), p('#B', 7)], [p('#C', 8), p('#D', 9), p('#E', 10)]] } },
    { battleTime: '20261111T081000.000Z', event: { id: 2, mode: 'soloShowdown', map: 'Skull Creek' }, battle: { mode: 'soloShowdown', type: 'ranked', rank: 3, trophyChange: 4, players: [p('#X', 1), p('#ME', 12)] } },
    { battleTime: '20261111T082000.000Z', event: { id: 3, mode: 'knockout', map: 'Belle\'s Rock' }, battle: { mode: 'knockout', type: 'soloRanked', result: 'defeat', teams: [[p('#ME', 5)], [p('#Z', 9)]] } },
  ];
  const games = trophyGamesFromLog(entries, 'me');
  assert.equal(games.length, 2);
  assert.equal(games[1].rank, 3);
  assert.equal(games[1].brawlerId, 12);
});

test('nets trophies, keeps Showdown places, and counts streaks on decided games', () => {
  const b = trophyBreakdown([
    g(1, 'victory', 8), g(2, 'victory', 7), g(3, null, 4, { rank: 2, mode: 'soloShowdown', map: 'Skull Creek' }),
    g(4, 'defeat', -6), g(5, 'victory', 9),
  ]);
  assert.equal(b.net, 22);
  assert.equal(b.won, 28);
  assert.equal(b.lost, 6);
  assert.equal(b.longestWin, 2);
  assert.equal(b.current, 1);
  assert.equal(avgPlace(b.modes.find((m) => m.key === 'soloShowdown')!), 2);
});

test('merge drops log games already stored', () => {
  assert.equal(mergeTrophyGames([g(5_000_000, 'victory', 8)], [g(5_000_300, 'victory', 8), g(9_000_000, 'defeat', -5)]).length, 2);
});

test('trophy days take Ranked out of the per-day rows', () => {
  const d = trophyDays([{ day: '2026-11-10', brawlerId: 1, battles: 10, wins: 6, decided: 9, rankedBattles: 4, rankedWins: 3, rankedDecided: 4 }]);
  assert.deepEqual(d, [{ day: '2026-11-10', games: 6, wins: 3, decided: 5 }]);
});

test('best-of needs a floor and two candidates', () => {
  assert.equal(bestBy([{ games: 3, net: 50 }], 3, (r) => r.net), null);
  assert.equal(bestBy([{ games: 3, net: 50 }, { games: 9, net: 20 }, { games: 1, net: 99 }], 3, (r) => r.net)?.net, 50);
});
