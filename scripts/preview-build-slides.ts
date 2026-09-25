/**
 * Renders the brawler-build carousel to files, from a day supplied by hand.
 *
 * Same reason as `preview-slides.ts`: the box is a mirror of origin/main, so
 * "see what it looks like" would otherwise mean shipping it first. The figures
 * below are Cosmo's, read off the live brawler page, so the layout is checked
 * against the shape of real data rather than round numbers.
 *
 * Run: npm run slides:preview:build -- <outDir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { ImageResponse } from 'next/og';

import type { BrawlerOfDay } from '../src/lib/brawler-of-day';
import { SLIDE_SIZE, buildCaption, buildSlides, toJpeg } from '../src/lib/build-slides';

const day: BrawlerOfDay = {
  brawlerId: 16000109,
  name: 'COSMO',
  slug: 'cosmo',
  // The mirror has no art for Cosmo at all; this is the wiki fallback the
  // catalogue resolves to, which is the whole point of carrying it.
  imageUrl:
    'https://static.wikia.nocookie.net/brawlstars/images/e/e5/Cosmo_Skin-Default.png',
  choices: {
    starPowers: [
      { itemId: 23001442, choosers: 191, share: 0.63, winRate: 0.795, decidedSampleSize: 1900 },
      { itemId: 23001443, choosers: 112, share: 0.37, winRate: 0.803, decidedSampleSize: 1100 },
    ],
    gadgets: [
      { itemId: 23001445, choosers: 166, share: 0.529, winRate: 0.8, decidedSampleSize: 1600 },
      { itemId: 23001444, choosers: 148, share: 0.471, winRate: 0.79, decidedSampleSize: 1400 },
    ],
    sampleSize: 617,
    confidence: 'high',
  },
  build: {
    brawlerId: 16000109,
    sampleSize: 1665,
    starPowers: [],
    gadgets: [],
    gears: [
      { itemId: 62000000, share: 0.363, unlockRate: 0.526, owners: 876 },
      { itemId: 62000001, share: 0.326, unlockRate: 0.473, owners: 787 },
      { itemId: 62000002, share: 0.096, unlockRate: 0.14, owners: 233 },
      { itemId: 62000003, share: 0.075, unlockRate: 0.109, owners: 181 },
      { itemId: 62000004, share: 0.075, unlockRate: 0.109, owners: 181 },
      { itemId: 62000017, share: 0.064, unlockRate: 0.092, owners: 153 },
    ],
  },
  starPowerNames: new Map([
    [23001442, 'Precession'],
    [23001443, 'Ammo Attractor'],
  ]),
  gadgetNames: new Map([
    [23001444, 'Planetary Pushback'],
    [23001445, 'Telescope Trap'],
  ]),
  gearNames: new Map([
    [62000000, 'Shield'],
    [62000001, 'Damage'],
    [62000002, 'Vision'],
    [62000003, 'Gadget Cooldown'],
    [62000004, 'Health'],
    [62000017, 'Speed'],
  ]),
};

async function main() {
  const out = process.argv[2] ?? 'build-preview';
  mkdirSync(out, { recursive: true });

  const slides = await buildSlides(day);
  for (const [i, slide] of slides.entries()) {
    const png = new ImageResponse(slide, SLIDE_SIZE);
    const jpeg = await toJpeg(await png.arrayBuffer());
    writeFileSync(`${out}/build-${i}.jpg`, jpeg);
    console.log(`build-${i}.jpg  ${(jpeg.length / 1024).toFixed(0)} KB`);
  }

  const caption = buildCaption(day, 'https://brawlzone.net');
  console.log('\ntitle:      ', caption.title);
  console.log('description:', caption.description);
}

void main();
