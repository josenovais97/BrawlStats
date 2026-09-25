/**
 * Renders the daily carousel to files, from a report supplied by hand.
 *
 * Exists because the slides cannot otherwise be looked at without a database
 * and a deploy: the box is a mirror of origin/main, so "see what it looks
 * like" would mean shipping it first. Not part of any timer.
 *
 * Run: npm run slides:preview -- <outDir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { ImageResponse } from 'next/og';

import { SLIDE_SIZE, dailySlides, toJpeg } from '../src/lib/daily-slides';
import type { StoredDailyReport } from '../src/lib/stats';

const report: StoredDailyReport = {
  day: '2026-09-25',
  findings: 3,
  discoveries: [
    {
      kind: 'secret-pick',
      brawlerIds: [16000008],
      brawlerNames: ['NITA'],
      value: 0.555,
      comparison: 0.004,
      sampleSize: 4812,
      href: '/brawlers/nita',
    },
    {
      kind: 'meta-trap',
      brawlerIds: [16000099],
      brawlerNames: ['PIERCE'],
      value: 0.439,
      comparison: 0.03,
      sampleSize: 31904,
      href: '/brawlers/pierce',
    },
    {
      kind: 'giant-killer',
      brawlerIds: [16000089, 16000000],
      brawlerNames: ['MEEPLE', 'SHELLY'],
      value: 0.891,
      comparison: 0.604,
      sampleSize: 742,
      href: '/brawlers/meeple',
    },
  ],
};

async function main() {
  const out = process.argv[2] ?? 'slides-preview';
  mkdirSync(out, { recursive: true });

  const slides = await dailySlides(report.day, report);
  for (const [i, slide] of slides.entries()) {
    const png = new ImageResponse(slide, SLIDE_SIZE);
    const jpeg = await toJpeg(await png.arrayBuffer());
    writeFileSync(`${out}/slide-${i}.jpg`, jpeg);
    console.log(`slide-${i}.jpg  ${(jpeg.length / 1024).toFixed(0)} KB`);
  }
}

void main();
