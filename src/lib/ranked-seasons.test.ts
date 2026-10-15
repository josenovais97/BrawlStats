import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseMapPool, parseSeasons } from '@/lib/ranked-seasons';

/* The wiki's Ranked page as of 2026-10-15, trimmed: the one-line-per-row
 * layout, a footnote on a date, a mode cell wrapped onto its own line, and a
 * brawler whose name has a dot in it. */
const NEW_LAYOUT = `==Maps===
{|class="mw-collapsible"
!colspan=9 style=background-color:#444|Active maps (Season 50)
|-
|[[File:Gem Grab.png|65xpx|link=Gem Grab]]
|width=130px|[[File:Double Swoosh-Map.png|x150px]]<br>[[Double Swoosh]]
|width=130px|[[File:Gem Fort-Map.png|x150px]]<br>[[Gem Fort]]
|-
|[[File:Brawl Ball.png|65xpx|link=Brawl Ball]]<div>FEATURED!</div>
|[[File:Beach Ball-Map.png|x150px]]<br>[[Beach Ball]]
|}

==Trial Brawlers==
{|class="article-table mw-collapsible"
!#||Start date||Trial Brawlers||Featured{{br}}
|50||October 15, 2026||[[File:Pearl1-pfp.png|x41px|link=Pearl]][[File:Byron1-pfp.png|x41px|link=Byron]][[File:Sirius1-pfp.png|x41px|link=Sirius]]||[[File:Brawl Ball.png|x41px|link=Brawl Ball]]{{br}}
|49||September 17, 2026<ref>On September 22, Pierce was replaced by [[Amber]] as a maxed Brawler</ref>||[[File:Ash1-pfp.png|x41px|link=Ash]][[File:Mortis1-pfp.png|x41px|link=Mortis]][[File:Pierce1-pfp.png|x41px|link=Pierce]]||[[File:Hot Zone.png|x41px|link=Hot Zone]]{{br}}
|47||July 16, 2026||[[File:Berry1-pfp.png|x41px|link=Berry]][[File:Tara1-pfp.png|x41px|link=Tara]][[File:Meg1-pfp.png|x41px|link=Meg]]||
[[File:Gem Grab.png|x41px|link=Gem Grab]]{{br}}
|34||June 19, 2025||[[File:Frank1-pfp.png|x41px|link=Frank]][[File:Mr. P1-pfp.png|x41px|link=Mr. P]][[File:Cordelius1-pfp.png|x41px|link=Cordelius]]||[[File:Heist.png|x41px|link=Heist]]{{br}}
|}

==Modifiers==
`;

/* The layout before 2026-10: rows separated by |-, "Portrait" files. */
const OLD_LAYOUT = `==Trial Brawlers==
{|class="article-table"
|-
|48||August 20, 2026||[[File:Trunk Portrait.png|x41px|link=Trunk]][[File:Willow Portrait.png|x41px|link=Willow]][[File:Kaze Portrait.png|x41px|link=Kaze]]||
[[File:Brawl Ball.png|x41px|link=Brawl Ball]]
|-
|47||July 16, 2026||[[File:Berry Portrait.png|x41px|link=Berry]][[File:Tara Portrait.png|x41px|link=Tara]][[File:Meg Portrait.png|x41px|link=Meg]]||
|}
`;

test('reads the one-line-per-row trial table (October 2026 layout)', () => {
  const seasons = parseSeasons(NEW_LAYOUT);
  assert.deepEqual(seasons.map((s) => s.number), [34, 47, 49, 50]);
  const s50 = seasons.at(-1)!;
  assert.equal(s50.startsOn, '2026-10-15');
  assert.deepEqual(s50.trialBrawlers, ['Pearl', 'Byron', 'Sirius']);
  assert.equal(s50.featuredMode, 'Brawl Ball');
});

test('a footnote on the date neither hides the row nor adds to it', () => {
  const s49 = parseSeasons(NEW_LAYOUT).find((s) => s.number === 49)!;
  assert.deepEqual(s49.trialBrawlers, ['Ash', 'Mortis', 'Pierce']);
  assert.equal(s49.featuredMode, 'Hot Zone');
});

test('a wrapped mode cell and a dotted name are read correctly', () => {
  const seasons = parseSeasons(NEW_LAYOUT);
  assert.equal(seasons.find((s) => s.number === 47)!.featuredMode, 'Gem Grab');
  const s34 = seasons.find((s) => s.number === 34)!;
  assert.deepEqual(s34.trialBrawlers, ['Frank', 'Mr. P', 'Cordelius']);
  assert.equal(s34.featuredMode, 'Heist');
});

test('still reads the older |- layout with Portrait files', () => {
  const seasons = parseSeasons(OLD_LAYOUT);
  assert.deepEqual(seasons.map((s) => [s.number, s.trialBrawlers.join(',')]), [
    [47, 'Berry,Tara,Meg'],
    [48, 'Trunk,Willow,Kaze'],
  ]);
  assert.equal(seasons[1].featuredMode, 'Brawl Ball');
});

test('the map pool parses despite the "==Maps===" heading', () => {
  const { season, pool } = parseMapPool(NEW_LAYOUT);
  assert.equal(season, 50);
  assert.deepEqual(pool.find((p) => p.mode === 'Gem Grab')?.maps, ['Double Swoosh', 'Gem Fort']);
});
