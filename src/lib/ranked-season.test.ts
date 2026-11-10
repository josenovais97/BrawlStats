import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bestBrawler,
  breakdown,
  dayFacts,
  dayRange,
  gamesFromLog,
  logTime,
  mergeGames,
  seasonView,
  streaks,
  type RankedGame,
} from '@/lib/ranked-season';
import type { BSBattleLogEntry } from '@/types/brawlstars';

const game = (time: number, win: boolean, extra: Partial<RankedGame> = {}): RankedGame => ({
  time,
  brawlerId: 1,
  win,
  mode: 'gemGrab',
  map: 'Hard Rock Mine',
  allies: [2, 3],
  enemies: [4, 5, 6],
  ...extra,
});

test('reads the API battle time', () => {
  assert.equal(logTime('20261110T082531.000Z'), Date.parse('2026-11-10T08:25:31Z'));
  assert.equal(logTime('nonsense'), null);
});

test('takes only decided Ranked games from the log, from the player side', () => {
  const p = (tag: string, id: number) => ({ tag, name: tag, brawler: { id, name: String(id), power: 11, trophies: 0 } });
  const entry = (type: string, result: 'victory' | 'defeat' | 'draw'): BSBattleLogEntry => ({
    battleTime: '20261110T082531.000Z',
    event: { id: 1, mode: 'brawlBall', map: 'Center Stage' },
    battle: { mode: 'brawlBall', type, result, teams: [[p('#ENEMY1', 10), p('#ENEMY2', 11), p('#ENEMY3', 12)], [p('#ME', 20), p('#MATE1', 21), p('#MATE2', 22)]] },
  });
  const games = gamesFromLog([entry('soloRanked', 'victory'), entry('ranked', 'victory'), entry('soloRanked', 'draw')], 'me');
  assert.equal(games.length, 1);
  assert.deepEqual(games[0].allies, [21, 22]);
  assert.deepEqual(games[0].enemies, [10, 11, 12]);
  assert.equal(games[0].brawlerId, 20);
  assert.equal(games[0].mode, 'brawlBall');
  assert.equal(games[0].win, true);
});

test('merging drops log games already stored', () => {
  const stored = [game(2_000_000, true)];
  const log = [game(2_000_400, false), game(3_000_000, true)];
  assert.equal(mergeGames(stored, log).length, 2);
});

test('streaks count runs in time order', () => {
  const s = streaks([game(1, true), game(2, true), game(3, false), game(4, true), game(5, true), game(6, true)]);
  assert.deepEqual(s, { longestWin: 3, longestLoss: 1, current: 3 });
  assert.equal(streaks([game(1, false), game(2, false)]).current, -2);
});

test('pairs need three games before they are listed', () => {
  const games = [game(1, true), game(2, true), game(3, false, { allies: [7], enemies: [8] })];
  const b = breakdown(games);
  assert.deepEqual(
    b.allies.map((a) => a.brawlerId),
    [],
  );
  assert.equal(breakdown([...games, game(4, true)]).allies.find((a) => a.brawlerId === 2)?.games, 3);
});

test('the toughest opponent is the worst record', () => {
  const games = [
    game(1, false, { enemies: [9] }),
    game(2, false, { enemies: [9] }),
    game(3, false, { enemies: [9] }),
    game(4, true, { enemies: [8] }),
    game(5, true, { enemies: [8] }),
    game(6, true, { enemies: [8] }),
  ];
  assert.equal(breakdown(games).enemies[0].brawlerId, 9);
});

test('a pocket pick does not win best brawler', () => {
  const rows = [
    { brawlerId: 1, games: 100, wins: 55 },
    { brawlerId: 2, games: 40, wins: 26 },
    { brawlerId: 3, games: 3, wins: 3 },
  ];
  assert.equal(bestBrawler(rows, 143)?.brawlerId, 2);
});

test('day facts find the busiest day, the best day and the longest run', () => {
  const facts = dayFacts([
    { day: '2026-10-16', games: 5, wins: 4 },
    { day: '2026-10-17', games: 12, wins: 5 },
    { day: '2026-10-18', games: 2, wins: 2 },
    { day: '2026-10-21', games: 3, wins: 1 },
  ]);
  assert.equal(facts.played, 4);
  assert.equal(facts.busiest?.day, '2026-10-17');
  assert.equal(facts.best?.day, '2026-10-16');
  assert.equal(facts.longestRun, 3);
});

test('day ranges are inclusive', () => {
  assert.deepEqual(dayRange('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
});

test('the season adds only log games newer than the stored ones', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  const t = (iso: string) => Date.parse(iso);
  const rows = [{ day: '2026-11-09', brawlerId: 1, games: 2, wins: 1 }];
  const stored = [game(t('2026-11-09T10:00:00Z'), true), game(t('2026-11-09T09:00:00Z'), false)];
  const log = [game(t('2026-11-09T10:00:00Z'), true), game(t('2026-11-10T11:00:00Z'), true, { brawlerId: 5 })];
  const view = seasonView(rows, stored, log, now);
  assert.equal(view.games, 3);
  assert.equal(view.wins, 2);
  assert.equal(view.brawlers.find((b) => b.brawlerId === 5)?.games, 1);
  assert.equal(view.days.find((d) => d.day === '2026-11-10')?.games, 1);
  assert.equal(view.recent.length, 3);
});

test('with no stored season the log is all there is', () => {
  const view = seasonView([], [], [game(1_000, true), game(2_000, false)], 10_000);
  assert.equal(view.hasSeason, false);
  assert.equal(view.games, 2);
});
