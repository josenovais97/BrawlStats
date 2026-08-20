import { inflateSync } from 'node:zlib';

/**
 * Just enough PNG decoding to answer "does this image have transparency?".
 *
 * Written because the failure it catches is invisible. An icon exported with
 * the editor's transparency checkerboard baked in as real pixels is a valid,
 * good-looking PNG — it simply renders as a white box on a dark page, and the
 * only way to notice is for somebody to look at it. `trophy-gain.png` shipped
 * that way and was spotted by eye.
 *
 * Deliberately not a dependency: the site ships no image library, and reading
 * four corner pixels does not justify adding one. Only the subset our own
 * assets use is handled — 8-bit truecolour with alpha — and anything else is
 * reported rather than guessed at.
 */

export interface PngAlpha {
  width: number;
  height: number;
  /** PNG colour type: 6 is truecolour with alpha, which is what we require. */
  colorType: number;
  bitDepth: number;
  /** Alpha of the four corners, clockwise from top-left. */
  corners: [number, number, number, number];
  /** True when any pixel is not fully opaque. */
  hasTransparency: boolean;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Paeth predictor, straight from the PNG spec. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function readPngAlpha(file: Buffer): PngAlpha {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  // Walk the chunk list: length, type, data, CRC.
  for (let at = 8; at + 8 <= file.length; ) {
    const length = file.readUInt32BE(at);
    const type = file.toString('ascii', at + 4, at + 8);
    const data = file.subarray(at + 8, at + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    at += 12 + length;
  }

  if (colorType !== 6 || bitDepth !== 8 || interlace !== 0) {
    // Not decodable here, and not a shape any of our icons use.
    return {
      width,
      height,
      colorType,
      bitDepth,
      corners: [255, 255, 255, 255],
      hasTransparency: false,
    };
  }

  const bpp = 4;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);

  // Undo the per-scanline filter. Each row is prefixed with its filter type.
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const row = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      const value = src[x];

      row[x] =
        (filter === 0
          ? value
          : filter === 1
            ? value + a
            : filter === 2
              ? value + b
              : filter === 3
                ? value + ((a + b) >> 1)
                : value + paeth(a, b, c)) & 0xff;
    }
  }

  const alphaAt = (x: number, y: number) => out[y * stride + x * bpp + 3];

  let transparent = false;
  for (let i = 3; i < out.length; i += bpp) {
    if (out[i] !== 255) {
      transparent = true;
      break;
    }
  }

  return {
    width,
    height,
    colorType,
    bitDepth,
    corners: [
      alphaAt(0, 0),
      alphaAt(width - 1, 0),
      alphaAt(width - 1, height - 1),
      alphaAt(0, height - 1),
    ],
    hasTransparency: transparent,
  };
}
