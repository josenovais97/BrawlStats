import assert from 'node:assert/strict';
import { test } from 'node:test';

import { brawlerTotals, summarizeActivity } from '@/lib/player-activity';

const row = (day: string, brawlerId: number, battles: number, wins: number, decided: number, ranked = 0, rWins = 0, rDecided = 0) => ({
  day,
  brawlerId,
  battles,
  wins,
  decided,
  rankedBattles: ranked,
  rankedWins: rWins,
  rankedDecided: rDecided,
});

test('splits trophy and Ranked games and fills every day', () => {
  const s = summarizeActivity(
    [row('2026-11-08', 1, 10, 6, 9, 4, 3, 4), row('2026-11-10', 2, 5, 1, 3)],
    '2026-11-07',
    '2026-11-10',
  );
  assert.equal(s.days.length, 4);
  assert.equal(s.played, 2);
  assert.deepEqual(s.all, { battles: 15, wins: 7, decided: 12 });
  assert.deepEqual(s.ranked, { battles: 4, wins: 3, decided: 4 });
  assert.deepEqual(s.trophy, { battles: 11, wins: 4, decided: 8 });
  assert.equal(s.brawlers[0].brawlerId, 1);
  assert.deepEqual(s.brawlers[0].trophy, { battles: 6, wins: 3, decided: 5 });
});

test('totals per brawler add up across days', () => {
  const t = brawlerTotals([row('2026-11-08', 1, 3, 2, 3), row('2026-11-09', 1, 2, 1, 2)]);
  assert.deepEqual(t.get(1), { battles: 5, wins: 3, decided: 5 });
});
