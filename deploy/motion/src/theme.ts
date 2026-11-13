// Shared look for the Remotion Shorts (2026-11-13). Colours match the
// Pillow engine's (deploy/viral/engine.py) so both render paths read as one
// channel while formats move across.
import {continueRender, delayRender, staticFile} from 'remotion';

export const W = 1080;
export const H = 1920;
export const INK = '#0c0e1e';
export const DEEP = '#05060f';
export const NAVY = '#090c1a';
export const TIER: Record<string, string> = {
  S: '#ff3c64', A: '#ff8c28', B: '#ffcd28', C: '#46d778', D: '#3caaff', E: '#9669ff', F: '#7d87aa',
};
export const LEVEL: Record<string, string> = {EASY: '#3cd26e', MEDIUM: '#ffb428', HARD: '#ff3c5a', EXPERT: '#be46ff'};
export const HEAD = "'Head', 'Lilita', sans-serif";
export const BODY = "'Lilita', sans-serif";

// The headline font is the game's Nougat, from the Fan Kit: rendered into
// video only, copied into the render's public folder from the cache and never
// into the repo or the site. Lilita (OFL) covers what it lacks.
let fontsRequested = false;
export const loadFonts = () => {
  if (fontsRequested || typeof document === 'undefined') return;
  fontsRequested = true;
  const handle = delayRender('fonts');
  const faces = [
    new FontFace('Head', `url(${staticFile('fonts/head.ttf')})`),
    new FontFace('Lilita', `url(${staticFile('fonts/lilita.ttf')})`),
  ];
  Promise.allSettled(faces.map((f) => f.load().then((ff) => document.fonts.add(ff)))).then(() => continueRender(handle));
};

const hex = (c: string) => {
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b);
  return toHex(x.map((v, i) => v * (1 - t) + y[i] * t));
};
export const shade = (c: string, k: number) => toHex(hex(c).map((v) => v * k));
export const alpha = (c: string, a: number) => {
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${a})`;
};

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const outBack = (t: number, s = 1.7) => {
  const u = clamp(t) - 1;
  return 1 + (s + 1) * u ** 3 + s * u ** 2;
};
export const outCubic = (t: number) => 1 - (1 - clamp(t)) ** 3;
export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export type Brawler = {
  id: string; name: string; tier?: string; wr?: number; use?: number; face?: string; art?: string;
  skin?: string; ability?: {kind: string; label: string; name: string}; rank?: number;
};
export type Segment = {kind: string; start: number; len: number; [k: string]: any};
export type Plan = {
  kind: string; fps: number; step: number; beats: number; duration: number; period: number; episode: number;
  segments: Segment[]; word?: string; bestLine?: string; season?: number; count?: number; wall?: string[];
};
