import 'server-only';

import sharp from 'sharp';

import { answerFor, dayIndex, fmix32, type BrawldleBrawler } from '@/lib/brawldle';

/**
 * The two picture puzzles beside the classic one (2026-10-22): Shadow, a
 * brawler's silhouette, and Zoom, an extreme close-up that pulls back with
 * every wrong guess. The same two clues the daily quiz video uses, so a viewer
 * who liked the video finds more of it here.
 *
 * Both are drawn from Brawlify's full-body model and cut on the server. The
 * browser gets only the processed image, under a URL that does not name the
 * brawler: a model URL carries the brawler id, and an id is the answer.
 */

export type PictureMode = 'shadow' | 'zoom';
export const PICTURE_MODES: readonly PictureMode[] = ['shadow', 'zoom'];
export const PICTURE_TRIES = 6;

const SALT: Record<PictureMode, number> = { shadow: 0x5bd1e995, zoom: 0x27d4eb2f };

/** How far in the zoom is at each step (wrong guesses so far). */
const ZOOM = [5, 3.9, 3.0, 2.4, 1.9, 1.5];

const modelUrl = (id: number) => `https://cdn.brawlify.com/brawlers/model/${id}.png`;

/*
 * The models, kept in memory for the day they are asked for. One or two
 * brawlers a day, ~200 KB each: a map is all the cache this needs, and it is
 * emptied when the date moves on so it cannot grow.
 */
const models = new Map<number, Buffer | null>();
let modelsDay = '';

async function model(id: number, date: string): Promise<Buffer | null> {
  if (modelsDay !== date) {
    models.clear();
    modelsDay = date;
  }
  if (!models.has(id)) {
    const body = await fetch(modelUrl(id), { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((b) => (b ? Buffer.from(b) : null))
      .catch(() => null);
    models.set(id, body);
  }
  return models.get(id) ?? null;
}

/**
 * The day's answer for a picture mode: a pure function of the date, like the
 * classic one, but salted per mode so the three puzzles are three different
 * brawlers. Brand-new brawlers have no model on Brawlify for a while, so it
 * walks on from the seeded pick to the first one that has.
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

  if (mode === 'shadow') {
    // Keep only the outline: every visible pixel goes to one flat colour.
    const alpha = await sharp(trimmed.data).extractChannel('alpha').toBuffer();
    return sharp({ create: { width, height, channels: 3, background: { r: 14, g: 16, b: 34 } } })
      .joinChannel(alpha)
      .resize(560, 560, { fit: 'inside' })
      .webp({ quality: 90 })
      .toBuffer();
  }

  // Zoom: a square around the upper part of the model (the face, usually),
  // nudged per day so it is not always the same spot.
  const zoom = ZOOM[Math.min(step, ZOOM.length - 1)];
  const side = Math.max(24, Math.round(Math.min(width, height) / zoom));
  const jitter = (fmix32(dayIndex(date) * 7 + 3) % 1000) / 1000 - 0.5;
  const cx = width / 2 + jitter * width * 0.25;
  const cy = height * 0.3;
  const left = Math.round(Math.min(Math.max(cx - side / 2, 0), width - side));
  const top = Math.round(Math.min(Math.max(cy - side / 2, 0), height - side));
  return sharp(trimmed.data)
    .extract({ left, top, width: side, height: side })
    .resize(560, 560, { fit: 'fill' })
    .flatten({ background: { r: 30, g: 34, b: 80 } })
    .webp({ quality: 88 })
    .toBuffer();
}
