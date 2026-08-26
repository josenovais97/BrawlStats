/**
 * Builds a vertical Short from a full-page mobile screenshot, panned inside a
 * phone frame.
 *
 *   node scripts/make-short.mjs <name> "<caption>" "<subtitle>" \
 *     "<end line 1>" "<end line 2>" <shot[:from:to:secs]> [shot …]
 *
 * Screenshots are expected at $SHORTS_DIR/shots/<name>.png, captured from the
 * running site at a mobile viewport — see the README section this links to.
 *
 * Shots are captured at 3x device pixel ratio (1170px wide) and downscaled into
 * a 660px screen, which is what keeps the site's text legible at Shorts size.
 * `from`/`to` are fractions of the scrollable height, so a section deep in a
 * long page can be framed without hand-measuring pixels.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Where the screenshots live and the videos are written. Override with
 * SHORTS_DIR; defaults to a sibling of the repo so renders never land in git.
 */
const SP = process.env.SHORTS_DIR ?? `${process.cwd()}/.shorts`;
const W = 1080, H = 1920, FPS = 30;
// Screen box. Sized so the phone clears the bottom ~13% that YouTube's own UI
// (title, channel, buttons) draws over on Shorts.
const SW = 660, SH = 1430, SX = (W - SW) / 2, SY = 322;
const SRCW = 1170, SRCH = Math.round((SRCW * 844) / 390);

const DEFS = `<defs>
<linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b6bff" stop-opacity="0.42"/><stop offset="0.6" stop-color="#080b16" stop-opacity="0"/></linearGradient>
<linearGradient id="wash2" x1="1" y1="1" x2="0.2" y2="0.3"><stop offset="0" stop-color="#35d0ff" stop-opacity="0.32"/><stop offset="0.6" stop-color="#080b16" stop-opacity="0"/></linearGradient></defs>`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const plate = (cap, sub) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}
<rect width="${W}" height="${H}" fill="#080b16"/><rect width="${W}" height="${H}" fill="url(#wash)"/><rect width="${W}" height="${H}" fill="url(#wash2)"/>
<text x="${W / 2}" y="132" text-anchor="middle" font-family="DejaVu Sans" font-size="66" font-weight="bold" fill="#eef1fa">${esc(cap)}</text>
<text x="${W / 2}" y="206" text-anchor="middle" font-family="DejaVu Sans" font-size="40" fill="#ffc53d">${esc(sub)}</text>
<text x="${W / 2}" y="272" text-anchor="middle" font-family="DejaVu Sans" font-size="32" font-weight="bold" fill="#98a3c4" letter-spacing="4">BRAWLZONE.NET</text>
<rect x="${SX - 20}" y="${SY - 24}" width="${SW + 40}" height="${SH + 48}" rx="58" fill="#11162a" stroke="#2c3453" stroke-width="6"/>
<rect x="${SX + SW / 2 - 64}" y="${SY - 13}" width="128" height="11" rx="6" fill="#2c3453"/></svg>`;

const endCard = (line1, line2) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}
<rect width="${W}" height="${H}" fill="#080b16"/><rect width="${W}" height="${H}" fill="url(#wash)"/><rect width="${W}" height="${H}" fill="url(#wash2)"/>
<text x="${W / 2}" y="800" text-anchor="middle" font-family="DejaVu Sans" font-size="88" font-weight="bold" fill="#eef1fa">${esc(line1)}</text>
<text x="${W / 2}" y="915" text-anchor="middle" font-family="DejaVu Sans" font-size="88" font-weight="bold" fill="#ffc53d">${esc(line2)}</text>
<text x="${W / 2}" y="1030" text-anchor="middle" font-family="DejaVu Sans" font-size="46" fill="#98a3c4">Free · no login</text>
<rect x="230" y="1140" width="620" height="140" rx="44" fill="#ffc53d"/>
<text x="${W / 2}" y="1230" text-anchor="middle" font-family="DejaVu Sans" font-size="54" font-weight="bold" fill="#1a1200">BRAWLZONE.NET</text></svg>`;

const [name, cap, sub, endA, endB, ...specs] = process.argv.slice(2);
const dir = `${SP}/vf-${name}`;
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

let n = 0;
for (const spec of specs) {
  const [shot, from = '0', to = '0.5', secs = '5'] = spec.split(':');
  const src = `${SP}/shots/${shot}.png`;
  const meta = await sharp(src).metadata();
  const maxTop = Math.max(0, meta.height - SRCH);
  const bg = await sharp(Buffer.from(plate(cap, sub))).png().toBuffer();
  const total = Math.round(Number(secs) * FPS);
  for (let f = 0; f < total; f++) {
    const t = total === 1 ? 0 : f / (total - 1);
    const eased = t * t * (3 - 2 * t);                 // settles rather than stopping dead
    const top = Math.round(maxTop * (Number(from) + (Number(to) - Number(from)) * eased));
    const screen = await sharp(src).extract({ left: 0, top, width: SRCW, height: SRCH })
      .resize(SW, SH).png().toBuffer();
    await sharp(bg).composite([{ input: screen, left: SX, top: SY }])
      .png({ compressionLevel: 1 }).toFile(`${dir}/f${String(n++).padStart(5, '0')}.png`);
  }
}
const end = await sharp(Buffer.from(endCard(endA, endB))).png({ compressionLevel: 1 }).toBuffer();
for (let f = 0; f < 3 * FPS; f++) fs.writeFileSync(`${dir}/f${String(n++).padStart(5, '0')}.png`, end);

execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS),
  '-i', `${dir}/f%05d.png`, '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow',
  '-crf', '20', '-movflags', '+faststart', `${SP}/short-${name}.mp4`]);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`  short-${name}.mp4  ${(n / FPS).toFixed(1)}s  ${(fs.statSync(`${SP}/short-${name}.mp4`).size / 1048576).toFixed(1)} MB`);
