import assert from 'node:assert/strict';
import test from 'node:test';

import { buildIndex, normalize, parseAsk } from './bubble-ask';

const index = buildIndex({
  brawlers: [
    { id: 11, names: ['Mortis', 'モーティス'] },
    { id: 29, names: ['Bea'] },
    { id: 14, names: ['Bo'] },
    { id: 26, names: ['Bibi', 'ビビ'] },
    { id: 31, names: ['Mr. P', 'Sr. P'] },
    { id: 5, names: ['Spike'] },
    { id: 10, names: ['El Primo'] },
    { id: 27, names: ['8-Bit'] },
    { id: 28, names: ['Belle'] },
  ],
  maps: [
    { name: 'Hard Rock Mine', names: ['Hard Rock Mine', 'Mina Rochosa'] },
    { name: "Belle's Rock", names: ["Belle's Rock", 'Rocha da Belle'] },
    { name: 'Out in the Open', names: ['Out in the Open'] },
  ],
  modes: [
    { key: 'knockout', names: ['Knockout', 'Nocaute'] },
    { key: 'gemGrab', names: ['Gem Grab', 'Pique-gemas'] },
  ],
});

test('normalize drops accents, apostrophes and punctuation', () => {
  assert.equal(normalize("Who beats MR. P on Belle's Rock?"), 'who beats mr p on belles rock');
  assert.equal(normalize('Quem ganha do Sr. P na Mina Rochosa?'), 'quem ganha do sr p na mina rochosa');
});

test('counters with a map, English', () => {
  const p = parseAsk('who beats mortis on hard rock mine', index);
  assert.deepEqual(p.brawlers, [11]);
  assert.equal(p.map, 'Hard Rock Mine');
  assert.equal(p.intent, 'counters');
});

test('"beat" is never read as Bea', () => {
  assert.deepEqual(parseAsk('who can beat spike', index).brawlers, [5]);
});

test('localized names and Portuguese words', () => {
  const p = parseAsk('quem ganha do Sr. P na Mina Rochosa?', index);
  assert.deepEqual(p.brawlers, [31]);
  assert.equal(p.map, 'Hard Rock Mine');
  assert.equal(p.intent, 'counters');
});

test('a map name beats the brawler inside it', () => {
  const p = parseAsk("best picks belle's rock", index);
  assert.deepEqual(p.brawlers, []);
  assert.equal(p.map, "Belle's Rock");
  assert.equal(p.intent, 'picks');
  assert.equal(parseAsk('what to ban on belle rock', index).map, "Belle's Rock");
});

test('typos and the start of a map name', () => {
  assert.deepEqual(parseAsk('mortiz counter', index).brawlers, [11]);
  assert.equal(parseAsk('best on hard rock', index).map, 'Hard Rock Mine');
});

test('two brawlers is a comparison', () => {
  const p = parseAsk('Bo or Bibi?', index);
  assert.deepEqual(p.brawlers.sort((a, b) => a - b), [14, 26]);
  assert.equal(p.intent, 'versus');
  assert.equal(parseAsk('bo vs bibi on out in the open', index).intent, 'versus');
});

test('build, bans, trio, mates, modes', () => {
  assert.equal(parseAsk('best build for 8 bit', index).intent, 'build');
  assert.deepEqual(parseAsk('8bit gadget', index).brawlers, [27]);
  assert.equal(parseAsk('what should i ban in knockout', index).intent, 'bans');
  assert.equal(parseAsk('what should i ban in knockout', index).mode, 'knockout');
  assert.equal(parseAsk('best trio for gem grab', index).intent, 'trio');
  assert.equal(parseAsk('best trio for gem grab', index).mode, 'gemGrab');
  assert.equal(parseAsk('who goes well with el primo', index).intent, 'mates');
  assert.equal(parseAsk('melhores no nocaute', index).mode, 'knockout');
});

test('what a brawler is good against', () => {
  assert.equal(parseAsk('what is bibi good against', index).intent, 'strong');
});

test('CJK names without spaces', () => {
  const p = parseAsk('モーティスに勝てるのは？', index);
  assert.deepEqual(p.brawlers, [11]);
  assert.equal(p.intent, 'counters');
});

test('the player asking about themselves', () => {
  assert.equal(parseAsk('what should i pick on out in the open', index).mine, true);
  assert.equal(parseAsk('best picks on out in the open', index).mine, false);
});

test('what to upgrade, in a few languages', () => {
  assert.equal(parseAsk('what should I upgrade next?', index).intent, 'upgrade');
  assert.equal(parseAsk('o que devo upar agora', index).intent, 'upgrade');
  assert.equal(parseAsk('¿Qué brawler mejorar con mis monedas?', index).intent, 'upgrade');
  assert.equal(parseAsk('кого прокачать', index).intent, 'upgrade');
  assert.equal(parseAsk('次に強化するのは', index).intent, 'upgrade');
  // A build question stays a build question.
  assert.equal(parseAsk('best gadget for bea', index).intent, 'build');
});
