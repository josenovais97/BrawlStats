import assert from 'node:assert/strict';
import { test } from 'node:test';

import { boxAddedDates, parseBoxes, parseDailyWins } from '@/lib/starr-drops';

/**
 * The Daily Wins and box parsers, on trimmed copies of the wiki's own markup
 * (2026-10-22). Both pages mix inline `||` cells with one-cell-per-line rows,
 * and the schedule hard-coded before this said 5 wins when the game gave 6.
 */
const DAILY = `==Daily Wins==
Daily Wins are unlocked after reaching 50 [[Trophies]]. Every day, 6 rewards are given for the first 6 wins of the day.

===Current Season Rewards===
{| class="article-table mw-collapsible mw-collapsed"
|-
!colspan="6"|Normal Days
|-
|{{Icon|Chaos Drop}}||{{Icon|Starr Drop}}||{{Icon|Starr Drop}}||{{Icon|Starr Drop}}||{{Icon|Starr Drop}}||160 {{Icon|Credit}}<ref name=":0">Only for new players.</ref>
|-
|{{Icon|Chaos Drop}}||{{Icon|Starr Drop}}||{{Icon|Starr Drop}}||{{Icon|Starr Drop}}||{{Icon|Starr Drop}}||{{Icon|Starr Drop}}
|-
|{{Icon|Pumpkin Box}}
|{{Icon|Starr Drop}}
|{{Icon|Starr Drop}}
|{{Icon|Starr Drop}}
|{{Icon|Starr Drop}}
|{{Icon|Starr Drop}}
|-
!colspan="6"|Luckiest Days
|-
|{{Icon|Chaos Drop}}||{{Icon|Chaos Drop}}||{{Icon|Chaos Drop}}||{{Icon|Coffin Box}}||{{Icon|Chaos Drop}}||{{Icon|Chaos Drop}}
|}

===Special Days===
{| class="article-table mw-collapsible mw-collapsed"
|-
!Date!! colspan="6"|Rewards
|-
|January 3, 2026||{{Icon|Chaos Drop}}||{{Icon|Mega Box}}||{{Icon|Chaos Drop}}||{{Icon|Mega Box}}||{{Icon|Starr Drop}}||{{Icon|Mega Box}}
|-
|May 16, 2026
|{{Icon|Nova Drop}}
{{Icon|Nova Drop}}
|{{Icon|Nova Drop}}
|-
|September 26, 2026 to
September 27, 2026
|{{Icon|Chaos Drop}}
|{{Icon|Chaos Drop}}
|}

==Fallback Rewards==
`;

test('Daily Wins: win count, day kinds and slots', () => {
  const daily = parseDailyWins(DAILY)!;
  assert.equal(daily.wins, 6);
  assert.deepEqual(daily.days.map((d) => d.name), ['Normal Days', 'Luckiest Days']);
  // The new-player variant is dropped: its twin is listed in full.
  assert.equal(daily.days[0].rows.length, 2);
  assert.equal(daily.days[0].rows[1][0].items[0].name, 'Pumpkin Box');
  assert.equal(daily.days[1].rows[0][3].items[0].name, 'Coffin Box');
  assert.equal(daily.footnote, null);
});

test('Special days: ranges, double slots, newest first', () => {
  const { special } = parseDailyWins(DAILY)!;
  assert.deepEqual(
    special.map((s) => [s.startsAt.slice(0, 10), s.endsAt.slice(0, 10)]),
    [['2026-09-26', '2026-09-27'], ['2026-05-16', '2026-05-16'], ['2026-01-03', '2026-01-03']],
  );
  assert.equal(special[1].cells[0].items.length, 2);
});

const BOXES = `Event Boxes are given out during season events.

===Mega Boxes===
[[File:Classic Brawl Mega Box.png|right|120px]]
<tabber>
|-|2025=
{|class="article-table sortable"
!colspan=2|Mega Box Chances
|-
!Drops||Drop Chance
|-
|50 {{Icon|Coin}} Coins||{{Chance|600|1000}}
|-
|25 {{Icon|Power Point}} Power Points||{{Chance|400|1000}}
|}
|-|2024=
{|class="article-table sortable"
|-
|1000 {{Icon|Coin}} Coins||{{Chance|1000|1000}}
|}
</tabber>

===Pumpkin Boxes===
[[File:Pumpkin Box.png|right|120px]]
{|class="article-table sortable"
|-
|50 {{Icon|Coin}} Coins||{{Chance|1000|1000}}
|}

===Fallback Rewards===
{|class="article-table"
|-
|5 {{Icon|Coin}} Coins||100%
|}

===History===
*On 12/07/24, reworked Mega Boxes were added to the game for the Classic Brawl event.
*On 29/10/24, Mega Boxes were removed from the game and replaced by Dead Boxes.
*On 03/09/25, Boom Boxes and Pumpkin Boxes were added to the game.
*On 28/10/25, Mecha Boxes were added to the game. Mega Boxes were added back with changed rewards.
`;

test('Boxes: newest year only, history dates, Daily Wins flag', () => {
  const boxes = parseBoxes(BOXES, new Set(['Pumpkin Box']));
  assert.deepEqual(boxes.map((b) => b.name), ['Mega Boxes', 'Pumpkin Boxes']);
  const mega = boxes[0];
  assert.equal(mega.tables.length, 1);
  assert.equal(mega.tables[0].rarity, null);
  assert.equal(mega.tables[0].rewards[0].reward, '50 Coins');
  assert.equal(mega.addedAt, '2025-10-28');
  assert.equal(mega.inDailyWins, false);
  assert.equal(boxes[1].addedAt, '2025-09-03');
  assert.equal(boxes[1].inDailyWins, true);
});

test('Box history: "replaced by" dates the replacement', () => {
  const dates = boxAddedDates(BOXES, ['Dead Boxes', 'Mega Boxes']);
  assert.equal(dates.get('Dead Boxes'), '2024-10-29');
});
