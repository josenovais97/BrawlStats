import assert from 'node:assert/strict';
import { test } from 'node:test';

import { updateHeadliners, type ReleaseNotes, type RichNode } from '@/lib/release-notes';

const p = (text: string): RichNode => ({ type: 'paragraph', spans: [{ type: 'text', value: text, marks: [] }] });

const notes: ReleaseNotes = {
  title: 'Release Notes November 2026',
  publishedAt: '2026-11-03T05:00:00.000+02:00',
  url: 'https://supercell.com/',
  slug: 'november-2026',
  heroImageUrl: null,
  sections: [
    { title: 'Ranked Refresh', nodes: [p('Lou is mentioned here and is not a headliner.')] },
    {
      title: 'NEW Brawlers',
      nodes: [
        p('Thunder Frogs - Legendary - Artillery'),
        p('Zap, Zee, and Volt are the Thunder Frogs! Gifted a magical hat by Ziggy, they perform.'),
        p('Rey - Mythic - Marksman'),
        p('Ruby - Mythic - Damage Dealer'),
      ],
    },
    {
      title: 'NEW Hypercharges',
      nodes: [p('Cosmo (COSMIC CAPTURE): The hyper projectile homes in.'), p('Vince (BUG SWARM): Always at max power.')],
    },
    {
      title: 'NEW Buffies',
      nodes: [p('Mr. P'), p("Mr. P's Buffies give him more ways to interact with Lou's freeze."), p('Gadget 1: Service Bell'), p('Lou'), p('Base Kit Changes'), p('Berry')],
    },
  ],
};

test('updateHeadliners reads the introducing lines, not every mention', () => {
  const known = ['Ziggy', 'Lou', 'Mr. P', 'Berry', 'Cosmo', 'Vince', 'Rey'];
  assert.deepEqual(updateHeadliners(notes, known), {
    brawlers: ['Thunder Frogs', 'Rey', 'Ruby'],
    buffies: ['Mr. P', 'Lou', 'Berry'],
    hypercharges: ['Cosmo', 'Vince'],
  });
});
