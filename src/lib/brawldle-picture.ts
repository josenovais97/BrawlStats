import 'server-only';

import sharp from 'sharp';

import { answerFor, dayIndex, fmix32, type BrawldleBrawler } from '@/lib/brawldle';
import { fankitBodySource } from '@/lib/fankit';

/**
 * The two picture puzzles beside the classic one (2026-10-22): Shadow, a
 * brawler's silhouette, and Zoom, an extreme close-up that pulls back with
 * every wrong guess. The same two clues the daily quiz video uses, so a viewer
 * who liked the video finds more of it here.
 *
 * Both are drawn from the brawler's full body -- Supercell's Fan Kit render,
 * fetched large so the zoom stays sharp (2026-11-02), else Brawlify's model --
 * and cut on the server. The browser gets only the processed image, under a
 * URL that does not name the brawler: an art URL carries the brawler id, and
 * an id is the answer.
 */

export type PictureMode = 'shadow' | 'zoom';
export const PICTURE_MODES: readonly PictureMode[] = ['shadow', 'zoom'];
export const PICTURE_TRIES = 6;

const SALT: Record<PictureMode, number> = { shadow: 0x5bd1e995, zoom: 0x27d4eb2f };

/** How far in the zoom is at each step (wrong guesses so far). */
const ZOOM = [5, 3.9, 3.0, 2.4, 1.9, 1.5];

/*
 * Harder from FANKIT_FROM (owner, 2026-11-02: "people are getting
 * everything"; that day Shadow was solved by 9 of 9 players at the first
 * guess, Zoom by 5 of 5 in 3.6). The shadow stops being the whole outline
 * from the start: it is a window on part of the silhouette, sometimes
 * mirrored, that widens with each wrong guess to the whole of it at the last.
 * The zoom starts deeper and, on most days, on the body rather than the face.
 */
const SHADOW_HARD = [2.4, 1.95, 1.6, 1.35, 1.15, 1.0];
const ZOOM_HARD = [7, 5.4, 4.2, 3.2, 2.4, 1.7];
const SILHOUETTE = { r: 14, g: 16, b: 34 };
const ZOOM_FACE_CHECKED_FROM = '2026-11-04';

/** A seeded run of numbers in [0, 1) for one day and one purpose. */
function seeded(date: string, salt: number): () => number {
  let x = fmix32((dayIndex(date) * 2654435761 + salt) >>> 0) || 1;
  return () => {
    x = fmix32((x + 0x9e3779b9) >>> 0);
    return x / 4294967296;
  };
}

/**
 * Where the hard zoom looks, in the figure's own pixels: a spot whose
 * tightest window is mostly figure rather than background, the face on about
 * one day in three. Fixed for the day, so the pull-back stays on it.
 */
async function zoomSpot(figure: Buffer, width: number, height: number, date: string): Promise<[number, number]> {
  const rnd = seeded(date, 0x51ed270b);
  const alpha = await sharp(figure).extractChannel('alpha').raw().toBuffer();
  const side = Math.min(width, height) / ZOOM_HARD[0];
  const solidAt = (cx: number, cy: number) => {
    let solid = 0;
    let all = 0;
    const step = Math.max(1, Math.floor(side / 24));
    for (let y = Math.max(0, cy - side / 2); y < Math.min(height, cy + side / 2); y += step) {
      for (let x = Math.max(0, cx - side / 2); x < Math.min(width, cx + side / 2); x += step) {
        all += 1;
        if (alpha[Math.floor(y) * width + Math.floor(x)] > 128) solid += 1;
      }
    }
    return all > 0 ? solid / all : 0;
  };
  const face: [number, number] = [width / 2 + (rnd() - 0.5) * width * 0.25, height * 0.28];
  // The face spot is a guess at where a face is, and on some figures it is
  // beside the head: 2026-11-03 opened on a frame of mostly background. From
  // the next day it must be mostly figure too, or the day takes a body spot.
  if (rnd() < 0.34 && (date < ZOOM_FACE_CHECKED_FROM || solidAt(...face) > 0.6)) return face;
  for (let tries = 0; tries < 40; tries++) {
    const cx = width * (0.25 + rnd() * 0.5);
    const cy = height * (0.3 + rnd() * 0.45);
    if (solidAt(cx, cy) > 0.75) return [cx, cy];
  }
  return face;
}

const brawlifyModel = (id: number) => `https://cdn.brawlify.com/brawlers/model/${id}.png`;

/*
 * The Fan Kit from this day on. It also has bodies Brawlify lacks (Nori,
 * Wendy, Cosmo), which changes which brawlers can be the answer, so the day
 * the art changed keeps the answers and pictures it started with.
 */
const FANKIT_FROM = '2026-11-03';
const modelUrl = (id: number, date: string) =>
  (date >= FANKIT_FROM ? fankitBodySource(id) : null) ?? brawlifyModel(id);

/*
 * The models, kept in memory, trimmed to the figure and at most 2,000px tall
 * (the Fan Kit's canvases are loose and large). A handful of brawlers a day
 * (today's two, and yesterday's for the answers line), ~1 MB each. Not keyed
 * by day: asking for yesterday's answers must not empty today's (2026-10-23).
 * Emptied at 24 entries so it cannot grow.
 */
const models = new Map<string, Buffer | null>();

async function model(id: number, date: string): Promise<Buffer | null> {
  const url = modelUrl(id, date);
  if (models.size >= 24 && !models.has(url)) models.clear();
  if (!models.has(url)) {
    const body = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) =>
        b
          ? sharp(Buffer.from(b))
              .trim()
              .resize({ height: 2000, width: 2000, fit: 'inside', withoutEnlargement: true })
              .png()
              .toBuffer()
          : null,
      )
      .catch(() => null);
    models.set(url, body);
  }
  return models.get(url) ?? null;
}

/**
 * The day's answer for a picture mode: a pure function of the date, like the
 * classic one, but salted per mode so the three puzzles are three different
 * brawlers. A brawler with no full-body art yet (the newest reach the Fan Kit
 * and Brawlify late) cannot be drawn, so it walks on from the seeded pick to
 * the first one that can.
 */
export async function pictureAnswer(
  mode: PictureMode,
  date: string,
  roster: BrawldleBrawler[],
): Promise<BrawldleBrawler | null> {
  if (roster.length === 0) return null;
  const taken = new Set<number>([answerFor(date, roster)?.id ?? -1]);
  for (const other of PICTURE_MODES) {
    if (other === mode) break;
    const a = await pictureAnswer(other, date, roster);
    if (a) taken.add(a.id);
  }
  const start = fmix32((dayIndex(date) ^ SALT[mode]) >>> 0) % roster.length;
  for (let i = 0; i < roster.length; i++) {
    const b = roster[(start + i) % roster.length];
    if (taken.has(b.id)) continue;
    if (await model(b.id, date)) return b;
  }
  return null;
}

/**
 * The image for `step` wrong guesses so far, as WebP. At PICTURE_TRIES (the
 * puzzle is over, won or lost) both modes show the model itself.
 */
export async function pictureImage(
  mode: PictureMode,
  answer: BrawldleBrawler,
  date: string,
  step: number,
): Promise<Buffer | null> {
  const src = await model(answer.id, date);
  if (!src) return null;
  const trimmed = await sharp(src).trim().png().toBuffer({ resolveWithObject: true });
  const { width, height } = trimmed.info;

  if (step >= PICTURE_TRIES) {
    return sharp(trimmed.data).resize(560, 560, { fit: 'inside' }).webp({ quality: 88 }).toBuffer();
  }

  const hard = date >= FANKIT_FROM;

  if (mode === 'shadow') {
    // Keep only the outline: every visible pixel goes to one flat colour.
    const alpha = await sharp(trimmed.data).extractChannel('alpha').toBuffer();
    const shadow = sharp({ create: { width, height, channels: 3, background: SILHOUETTE } }).joinChannel(alpha);
    if (!hard) return shadow.resize(560, 560, { fit: 'inside' }).webp({ quality: 90 }).toBuffer();

    // A window on part of it, centred on a spot of the figure that slides to
    // the middle as the window widens, so the last step is the whole outline.
    const S = Math.max(width, height);
    const square = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await shadow.png().toBuffer(), left: Math.round((S - width) / 2), top: Math.round((S - height) / 2) }])
      .png()
      .toBuffer();
    const rnd = seeded(date, 0x2f6b1c3d);
    const spotX = (S - width) / 2 + width * (0.3 + rnd() * 0.4);
    const spotY = (S - height) / 2 + height * (0.25 + rnd() * 0.4);
    const mirror = rnd() < 0.5;
    const z = SHADOW_HARD[Math.min(step, SHADOW_HARD.length - 1)];
    const t = (z - 1) / (SHADOW_HARD[0] - 1);
    const side = Math.max(24, Math.round(S / z));
    const cx = S / 2 + (spotX - S / 2) * t;
    const cy = S / 2 + (spotY - S / 2) * t;
    const left = Math.round(Math.min(Math.max(cx - side / 2, 0), S - side));
    const top = Math.round(Math.min(Math.max(cy - side / 2, 0), S - side));
    const window = sharp(square).extract({ left, top, width: side, height: side }).resize(560, 560, { fit: 'fill' });
    return (mirror ? window.flop() : window).webp({ quality: 90 }).toBuffer();
  }

  // Zoom: a square around the upper part of the model (the face, usually),
  // nudged per day so it is not always the same spot.
  const zooms = hard ? ZOOM_HARD : ZOOM;
  const zoom = zooms[Math.min(step, zooms.length - 1)];
  const side = Math.max(24, Math.round(Math.min(width, height) / zoom));
  const jitter = (fmix32(dayIndex(date) * 7 + 3) % 1000) / 1000 - 0.5;
  const [cx, cy] = hard
    ? await zoomSpot(trimmed.data, width, height, date)
    : [width / 2 + jitter * width * 0.25, height * 0.3];
  const left = Math.round(Math.min(Math.max(cx - side / 2, 0), width - side));
  const top = Math.round(Math.min(Math.max(cy - side / 2, 0), height - side));
  return sharp(trimmed.data)
    .extract({ left, top, width: side, height: side })
    .resize(560, 560, { fit: 'fill' })
    .flatten({ background: { r: 30, g: 34, b: 80 } })
    .webp({ quality: 88 })
    .toBuffer();
}
