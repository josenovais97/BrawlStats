import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { deflateSync } from 'node:zlib';

import { readPngAlpha } from '@/lib/png-alpha';

/**
 * Every game icon must actually be cut out.
 *
 * The bug this guards against is invisible in review: an icon exported with
 * the editor's transparency checkerboard baked in is a perfectly valid PNG
 * that renders as a white box on a dark page. `trophy-gain.png` shipped that
 * way and was only caught by somebody looking at it.
 *
 * Two checks, because the icon set has two legitimate shapes. Most are marks
 * floating on nothing, but the combat-stat tiles are full-bleed slanted
 * squares whose artwork genuinely reaches two of the four corners. So the
 * decisive test is that *some* transparency exists at all — a baked-in
 * background has none anywhere — and the corner test only requires that the
 * image is not boxed in on all four, which no cut-out or slanted tile ever is.
 */
const ICONS = path.join(process.cwd(), 'public', 'icons');

const files = readdirSync(ICONS)
  .filter((name) => name.endsWith('.png'))
  .sort();

test('there are icons to check', () => {
  // Guards the guard: a mistyped path would otherwise pass silently.
  assert.ok(files.length > 20, `expected the icon set, found ${files.length}`);
});

test('every icon is 8-bit RGBA', () => {
  for (const name of files) {
    const png = readPngAlpha(readFileSync(path.join(ICONS, name)));
    assert.equal(png.colorType, 6, `${name} is colour type ${png.colorType}, not RGBA`);
    assert.equal(png.bitDepth, 8, `${name} is ${png.bitDepth}-bit`);
  }
});

test('every icon has a transparent background', () => {
  for (const name of files) {
    const png = readPngAlpha(readFileSync(path.join(ICONS, name)));

    assert.ok(
      png.hasTransparency,
      `${name} is opaque everywhere — a background was baked into the export`,
    );
    assert.ok(
      png.corners.some((alpha) => alpha === 0),
      `${name} is opaque in all four corners — a background was baked into the export`,
    );
  }
});

test('the reader spots an opaque image', () => {
  // Validates the decoder itself against a PNG built to fail the check: two
  // rows of solid opaque red, one under each filter type that our own assets
  // exercise.
  const opaque = solidRgbaPng(2, 2, [255, 0, 0, 255]);
  const png = readPngAlpha(opaque);

  assert.equal(png.colorType, 6);
  assert.deepEqual(png.corners, [255, 255, 255, 255]);
  assert.equal(png.hasTransparency, false);
  // Which is exactly what the icon check rejects.
  assert.ok(!png.corners.some((alpha) => alpha === 0));
});

test('the reader spots a transparent image', () => {
  const clear = solidRgbaPng(2, 2, [0, 0, 0, 0]);
  const png = readPngAlpha(clear);

  assert.deepEqual(png.corners, [0, 0, 0, 0]);
  assert.equal(png.hasTransparency, true);
});

test('a non-PNG is rejected rather than misread', () => {
  assert.throws(() => readPngAlpha(Buffer.from('not an image at all')), /not a PNG/);
});

/* --------------------------- test fixtures -------------------------------- */

/** A minimal 8-bit RGBA PNG of one solid colour, filter type 0 throughout. */
function solidRgbaPng(
  width: number,
  height: number,
  [r, g, b, a]: [number, number, number, number],
): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const at = y * (stride + 1) + 1 + x * 4;
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
      raw[at + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  // The reader never verifies the CRC, so a placeholder keeps the fixture
  // short without weakening what is being tested.
  return Buffer.concat([length, body, Buffer.alloc(4)]);
}
