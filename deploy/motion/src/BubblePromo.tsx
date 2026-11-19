// BrawlZone Bubble promo, v3 (2026-11-19, owner: "show everything we can do,
// and also the panel, with different settings"). Twelve features, numbered,
// with a progress bar: the hook promises the list, the bar keeps people for
// the end. make.py voices each line (Piper, on the box) and sets the scene
// lengths from the voice; `seg.hits` (beats into a scene) time the animation
// here and the sound effects there, in the order make.py's cues list them.
//
// The panel is the real one: every state the video taps through was captured
// headless as the Play app opens it (plan.shots, 2.5x; the owner's name
// painted over as "YOU", club mates' names replaced), and the taps land where
// the captured buttons are. The native screens (the bubble, the account and
// bubble settings, My season, friends, widgets, alerts, the break card) are
// drawn from the app's own layouts, colours and strings.
import React, {useEffect, useState} from 'react';
import {AbsoluteFill, Img, continueRender, delayRender, random, staticFile} from 'remotion';
import {Backdrop, Banner, Burst, Chip, Confetti, Flare, FollowButton, Halo, Label, SearchBar, Star, Title} from './fx';
import {pop} from './Formats';
import {SceneProps, Stage} from './Stage';
import {BODY, DEEP, HEAD, INK, TIER, W, clamp, outBack, outCubic, Plan} from './theme';

// The app's palette (android res/values/colors.xml).
const APP = {bg: '#0A1233', surface: '#1A2759', surface2: '#22316C', surface3: '#2C3E86', border: '#33468F', borderStrong: '#4A62B8', fg: '#EEF1FA',
  muted: '#A9B6E0', brand: '#FFC53D', victory: '#35D07F', accent: '#8B6BFF', defeat: '#FF4F64', blueFace: '#3550B8', blueDepth: '#142060'};
const VIOLET = '#7a4cff', BLUE = '#2f7bff', GREEN = '#2fbf5c', ORANGE = '#ff9a28', RED = '#e8283c', TEAL = '#1aa6a0', PINK = '#e0409a', MARK = '#ffe45a';
/** The app's body text (Nunito, the site's and the panel's font). */
const SANS = "'Nunito', 'Liberation Sans', sans-serif";

// Landscape phone: the screen and where it sits in the frame.
const LW = 1000, LH = 462, PY = 1040;
const SX = W / 2 - LW / 2, SY = PY - LH / 2;
// The panel inside the landscape phone: 460dp of a 915dp screen, on the right.
const PNW = 503, PNX = LW - PNW, PX = PNW / 460;
// The bubble, on the left edge where most people park it.
const BX = 64, BY = 118, BS = 74;

const ease = (a: number, b: number, u: number) => a + (b - a) * outCubic(clamp(u));
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s.-])(\w)/g, (_m, p, c) => p + c.toUpperCase());
const at = (seg: any, i: number, spb: number) => Math.round((seg.hits?.[i] ?? 0) * spb);
const shot = (plan: Plan, name: string) => staticFile((plan as any).shots?.[name] || (plan as any).shots?.meta);

// ---------------------------------------------------------------- frame tools
/** A camera over the frame: (fx, fy) in frame pixels lands on (W/2, cy), scaled s. */
const Cam: React.FC<{s: number; fx: number; fy: number; cy?: number; children: React.ReactNode}> = ({s, fx, fy, cy = PY, children}) => (
  <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${W / 2 - fx * s}px, ${cy - fy * s}px) scale(${s})`}}>{children}</AbsoluteFill>
);

/** A phone with a screen of w x h at (cx, cy). */
const Phone: React.FC<{w: number; h: number; cx?: number; cy?: number; rot?: number; scale?: number; children: React.ReactNode}> = ({
  w, h, cx = W / 2, cy = PY, rot = 0, scale = 1, children,
}) => {
  const bz = 20;
  return (
    <div style={{position: 'absolute', left: cx - w / 2 - bz, top: cy - h / 2 - bz, width: w + bz * 2, height: h + bz * 2, borderRadius: 64,
      background: 'linear-gradient(145deg,#4a5068,#16181f 40%,#2c2f3d 70%,#565c76)', boxShadow: `0 0 0 6px ${INK}, 0 34px 70px rgba(0,0,0,0.5), inset 0 0 0 3px #6a7090`,
      transform: `rotate(${rot}deg) scale(${scale})`}}>
      <div style={{position: 'absolute', left: bz, top: bz, width: w, height: h, borderRadius: 46, overflow: 'hidden', background: '#000'}}>
        {children}
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 28%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.05) 100%)', pointerEvents: 'none'}} />
      </div>
    </div>
  );
};

/** The voice's words: the current chunk, keywords in gold; the feature's number as its own big slam. */
const CaptionTrack: React.FC<{seg: any; frame: number; fps: number}> = ({seg, frame, fps}) => {
  const chunks: any[] = seg.vo?.chunks || [];
  let i = -1;
  for (let j = 0; j < chunks.length; j++) if (frame >= chunks[j].t0 * fps - 1) i = j;
  if (i < 0) return null;
  const c = chunks[i];
  const f = frame - c.t0 * fps;
  if (c.num) {
    const k = outBack(f / 6, 2.4);
    return (
      <div style={{position: 'absolute', left: W / 2, top: 400, transform: `translate(-50%,-50%) scale(${0.4 + 0.6 * k}) rotate(-4deg)`, fontFamily: HEAD, fontSize: 190, lineHeight: 1,
        color: MARK, WebkitTextStroke: `26px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 16px 0 ${DEEP}, 0 24px 30px rgba(0,0,0,0.45)`}}>{`#${seg.num}`}</div>
    );
  }
  const text = c.words.map((w: any) => w.w).join(' ');
  const size = Math.min(104, 980 / Math.max(6, text.length * 0.58));
  const k = outBack(f / 6, 2.6);
  return (
    <div style={{position: 'absolute', left: W / 2, top: 400, transform: `translate(-50%,-50%) scale(${0.55 + 0.45 * k}) rotate(${i % 2 ? 1.5 : -1.5}deg)`, whiteSpace: 'nowrap',
      fontFamily: HEAD, fontSize: size, lineHeight: 1, letterSpacing: size * 0.01}}>
      {c.words.map((w: any, j: number) => (
        <span key={j} style={{color: w.hi ? MARK : '#fff', WebkitTextStroke: `${size * 0.16}px ${INK}`, paintOrder: 'stroke fill',
          textShadow: `0 ${size * 0.09}px 0 ${DEEP}, 0 ${size * 0.14}px 18px rgba(0,0,0,0.45)`, marginRight: j < c.words.length - 1 ? size * 0.28 : 0}}>{w.w}</span>
      ))}
    </div>
  );
};

/** Twelve segments across the top: what is done, what is playing, what is left. */
const Progress: React.FC<{num: number; u: number; bonus?: boolean}> = ({num, u, bonus}) => {
  const x0 = 250, x1 = 990, gap = 8, n = 12, sw = (x1 - x0 - gap * (n - 1)) / n;
  return (
    <>
      <div style={{position: 'absolute', left: 150, top: 160, transform: 'translate(-50%,-50%) rotate(-3deg)', fontFamily: HEAD, fontSize: bonus ? 46 : 60, color: '#fff',
        WebkitTextStroke: `9px ${INK}`, paintOrder: 'stroke fill', whiteSpace: 'nowrap'}}>{bonus ? 'BONUS' : `${num}/12`}</div>
      {[...Array(n).keys()].map((i) => {
        const fill = bonus || i < num - 1 ? 1 : i === num - 1 ? clamp(u) : 0;
        return (
          <div key={i} style={{position: 'absolute', left: x0 + i * (sw + gap), top: 150, width: sw, height: 20, borderRadius: 10, background: 'rgba(8,10,30,0.55)',
            boxShadow: `0 0 0 4px ${INK}`, overflow: 'hidden'}}>
            <div style={{width: `${fill * 100}%`, height: '100%', background: i === num - 1 && !bonus ? MARK : '#ffd23f'}} />
          </div>
        );
      })}
    </>
  );
};

/** A hand-drawn ring around something, then its label; f in frames since it starts. */
const Mark: React.FC<{cx: number; cy: number; rx: number; ry: number; f: number; label?: string; side?: 'left' | 'right' | 'below' | 'above'; size?: number}> = ({
  cx, cy, rx, ry, f, label, side = 'below', size = 30,
}) => {
  if (f < 0) return null;
  const pts: string[] = [];
  for (let k = 0; k <= 96; k++) {
    const a = -Math.PI * 0.6 + (k / 96) * Math.PI * 2.2;
    const j = 1 + 0.025 * Math.sin(a * 2.3) + 0.04 * (k / 96);
    pts.push(`${k ? 'L' : 'M'}${(cx + Math.cos(a) * rx * j).toFixed(1)} ${(cy + Math.sin(a) * ry * j).toFixed(1)}`);
  }
  const len = Math.PI * (rx + ry) * 2.4;
  const u = clamp(f / 10);
  const lk = pop(f, 8, 8, 2.2);
  const lx = side === 'left' ? cx - rx - 14 : side === 'right' ? cx + rx + 14 : cx;
  const ly = side === 'below' ? cy + ry + size : side === 'above' ? cy - ry - size : cy;
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <path d={pts.join(' ')} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - u)} />
        <path d={pts.join(' ')} fill="none" stroke={MARK} strokeWidth={7} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - u)} />
      </svg>
      {label && lk > 0 && (
        <div style={{position: 'absolute', left: lx, top: ly, transform: `translate(${side === 'left' ? '-100%' : side === 'right' ? '0' : '-50%'},-50%) scale(${lk}) rotate(-3deg)`,
          padding: `${size * 0.2}px ${size * 0.55}px ${size * 0.27}px`, borderRadius: 999, background: MARK, boxShadow: `0 0 0 4px ${INK}, 0 6px 0 4px ${DEEP}`, whiteSpace: 'nowrap'}}>
          <span style={{fontFamily: HEAD, fontSize: size, color: INK}}>{label}</span>
        </div>
      )}
    </>
  );
};

/** A finger's tap: a soft dot and rings; f in frames since the touch. */
const Tap: React.FC<{x: number; y: number; f: number; hold?: number; r?: number}> = ({x, y, f, hold = 5, r: rad = 34}) => {
  if (f < -6 || f > hold + 16) return null;
  const on = f >= 0 && f <= hold;
  const r = (f - hold) / 16;
  return (
    <>
      <div style={{position: 'absolute', left: x - rad, top: y - rad, width: rad * 2, height: rad * 2, borderRadius: '50%', background: `rgba(255,255,255,${on ? 0.6 : Math.max(0, 0.6 * (1 - r))})`,
        boxShadow: '0 0 0 4px rgba(255,255,255,0.35), 0 4px 14px rgba(0,0,0,0.35)', transform: `scale(${f < 0 ? 1.4 - 0.4 * (f + 6) / 6 : 1})`, opacity: f < 0 ? (f + 6) / 6 : 1}} />
      {f > hold && <div style={{position: 'absolute', left: x - rad - r * 50, top: y - rad - r * 50, width: rad * 2 + r * 100, height: rad * 2 + r * 100, borderRadius: '50%',
        border: `5px solid rgba(255,255,255,${1 - r})`}} />}
    </>
  );
};

const Flash: React.FC<{f: number; len?: number; color?: string}> = ({f, len = 6, color = '#fff'}) =>
  f >= 0 && f < len ? <AbsoluteFill style={{background: color, opacity: 0.85 * (1 - f / len)}} /> : null;

// ---------------------------------------------------------------- the game
const SPOTS = [[-1, 0], [-1, 1], [-1, 2], [1, 0], [1, 1], [1, 2]];
const spot = (i: number, t: number) => {
  const [side, k] = SPOTS[i];
  return [LW / 2 + side * (150 + k * 95) + 34 * Math.sin(t * 1.3 + k * 2 + side), 150 + k * 105 + 20 * Math.cos(t * 1.1 + k + side)];
};

/** The match under the bubble: the map tilted like the game camera, six brawlers, health, shots, the controls. */
const Game: React.FC<{plan: Plan; t: number; dim?: number; hp?: number}> = ({plan, t, dim = 0, hp = 1}) => {
  const all = [...(plan.blue || []), ...(plan.red || [])];
  const shots = [0, 1, 2, 3].map((n) => {
    const from = (n * 2 + Math.floor(t * 0.8 + n * 0.37)) % 6;
    return {from, to: (from + 3) % 6, ph: (t * 0.8 + n * 0.37) % 1};
  });
  return (
    <AbsoluteFill style={{background: '#2f7a3a', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: LW / 2, top: LH / 2 + 40, width: 1250, height: 821, transform: 'translate(-50%,-50%) perspective(900px) rotateX(32deg)'}}>
        <Img src={staticFile(plan.map)} style={{position: 'absolute', left: '50%', top: '50%', width: 821, height: 1250, transform: 'translate(-50%,-50%) rotate(90deg)'}} />
      </div>
      {shots.map(({from, to, ph}, n) => {
        const [x0, y0] = spot(from, t), [x1, y1] = spot(to, t);
        const x = x0 + (x1 - x0) * ph, y = y0 - 40 + (y1 - y0) * ph;
        const ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
        const blue = from < 3;
        return (
          <React.Fragment key={n}>
            <div style={{position: 'absolute', left: x - 30, top: y - 5, width: 60, height: 10, borderRadius: 5, transform: `rotate(${ang}deg)`,
              background: `linear-gradient(90deg, transparent, ${blue ? '#9fd4ff' : '#ffb08a'})`, boxShadow: `0 0 12px ${blue ? '#5ab8ff' : '#ff7a4a'}`}} />
            {ph > 0.82 && <div style={{position: 'absolute', left: x1, top: y1 - 120 - (ph - 0.82) * 160, transform: 'translate(-50%,-50%)', opacity: 1 - (ph - 0.82) / 0.18,
              fontFamily: HEAD, fontSize: 30, color: '#fff', WebkitTextStroke: `5px ${INK}`, paintOrder: 'stroke fill'}}>{`-${800 + Math.floor(random(`d${n}${from}`) * 900)}`}</div>}
          </React.Fragment>
        );
      })}
      {all.map((b: any, i: number) => {
        const [x, y] = spot(i, t);
        const blue = i < 3;
        const life = clamp(i === 0 ? hp : 0.55 + 0.4 * Math.abs(Math.sin(t * 0.7 + i)));
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%,-100%)'}}>
            <div style={{position: 'absolute', left: '50%', bottom: -8, width: 74, height: 26, transform: 'translateX(-50%)', borderRadius: '50%',
              border: `5px solid ${blue ? '#3c8cff' : '#ff4a4a'}`, background: 'rgba(0,0,0,0.25)'}} />
            <div style={{position: 'absolute', left: '50%', top: -18, width: 72, height: 10, transform: 'translateX(-50%)', borderRadius: 5, background: '#1a1a24', boxShadow: `0 0 0 2px ${INK}`}}>
              <div style={{width: `${life * 100}%`, height: '100%', borderRadius: 5, background: blue ? '#5aff7a' : '#ff4a5a'}} />
            </div>
            <Img src={staticFile(b.art)} style={{height: 96, transform: blue ? 'none' : 'scaleX(-1)', filter: 'drop-shadow(0 6px 0 rgba(0,0,0,0.3))'}} />
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 70, bottom: 40, width: 130, height: 130, borderRadius: '50%', border: '6px solid rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.12)'}} />
      <div style={{position: 'absolute', right: 70, bottom: 40, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,#ff8a4a,#d8401e)', boxShadow: '0 0 0 6px rgba(255,255,255,0.4)'}} />
      <div style={{position: 'absolute', right: 210, bottom: 60, width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle,#ffe45a,#ffaa00)', boxShadow: '0 0 0 5px rgba(255,255,255,0.4)'}} />
      <div style={{position: 'absolute', left: LW / 2, top: 14, transform: 'translateX(-50%)', padding: '6px 22px', borderRadius: 14, background: 'rgba(5,10,31,0.7)',
        fontFamily: BODY, fontSize: 30, color: '#fff', display: 'flex', gap: 18}}>
        <span style={{color: '#5aa8ff'}}>0</span><span>1:{String(49 - Math.floor(t % 40)).padStart(2, '0')}</span><span style={{color: '#ff6a6a'}}>1</span>
      </div>
      {dim > 0 && <AbsoluteFill style={{background: `rgba(5,8,25,${0.55 * dim})`}} />}
    </AbsoluteFill>
  );
};

/** The bubble as the app draws it: the player's icon in a gold ring; ✓/✗ after a game; the session pill. */
const Bubble: React.FC<{src: string; x?: number; y?: number; s?: number; badge?: 'win' | 'loss' | null; pill?: string | null; pulse?: number; press?: number; alpha?: number}> = ({
  src, x = BX, y = BY, s = 1, badge = null, pill = null, pulse = 0, press = 0, alpha = 1,
}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${s * (1 - 0.1 * press)})`, opacity: alpha}}>
    {pulse > 0 && <div style={{position: 'absolute', left: '50%', top: '50%', width: BS * (1 + pulse), height: BS * (1 + pulse), transform: 'translate(-50%,-50%)', borderRadius: '50%',
      border: `5px solid rgba(255,197,61,${1 - pulse})`}} />}
    <div style={{width: BS, height: BS, borderRadius: '50%', overflow: 'hidden', background: APP.surface2, boxShadow: `0 0 0 5px ${APP.brand}, 0 0 0 9px ${INK}, 0 10px 18px rgba(0,0,0,0.5)`}}>
      <Img src={staticFile(src)} style={{width: BS, height: BS}} />
    </div>
    {badge && <div style={{position: 'absolute', right: -10, top: -10, width: 34, height: 34, borderRadius: '50%', background: badge === 'win' ? APP.victory : APP.defeat,
      boxShadow: `0 0 0 4px ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BODY, fontSize: 22, color: '#fff'}}>{badge === 'win' ? '✓' : '✗'}</div>}
    {pill && <div style={{position: 'absolute', left: '50%', top: BS + 12, transform: 'translateX(-50%)', padding: '4px 12px 5px', borderRadius: 999, background: 'rgba(10,18,51,0.92)',
      boxShadow: `0 0 0 3px ${INK}`, fontFamily: BODY, fontSize: 20, color: '#fff', whiteSpace: 'nowrap'}}>{pill}</div>}
  </div>
);

/** A panel capture inside the landscape phone, sliding in from the right. */
const PanelShot: React.FC<{src: string; k: number; children?: React.ReactNode}> = ({src, k, children}) => (
  <div style={{position: 'absolute', left: PNX + (1 - clamp(k)) * (PNW + 30), top: 0, width: PNW, height: LH, background: APP.bg, overflow: 'hidden',
    boxShadow: '-14px 0 30px rgba(0,0,0,0.45)', borderLeft: `3px solid ${APP.border}`}}>
    <Img src={src} style={{position: 'absolute', left: 0, top: 0, width: PNW}} />
    <div style={{position: 'absolute', left: 0, top: 0, width: PNW}}>{children}</div>
  </div>
);

// ---------------------------------------------------------------- the panel, big
// Every tour scene shows the panel as a large card, so the reader can see
// what the panel says: the captured page at 860 px wide, with a camera
// inside it. Views are in the capture's CSS pixels (460 wide): z zoom, (x, y)
// the point at the centre of the card.
type View = {z: number; x: number; y: number};
type Step = {f: number; shot?: string; v?: View; tap?: [number, number]};
type Ring = {f: number; until?: number; cx: number; cy: number; rx: number; ry: number; label?: string; side?: 'left' | 'right' | 'below' | 'above'};
type Geo = {cx: number; ct: number; cw: number; ch: number};
const CARD: Geo = {cx: W / 2, ct: 520, cw: 860, ch: 1180};
// Page heights (CSS px) of the captures; the viewport ones are 860.
const SHOT_H: Record<string, number> = {meta: 934, 'meta-ko': 910, 'draft-board': 968, trophies: 1123, 'f-all': 934, 'f-p11': 934, 'f-p11-hide': 896};
const kOf = (g: Geo) => g.cw / 460;
const top = (g: Geo, scroll = 0, z = 1): View => ({z, x: 230, y: g.ch / (2 * kOf(g) * z) + scroll});
const VD = 14;
const lerpV = (a: View, b: View, u: number): View => ({z: a.z + (b.z - a.z) * u, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u});

const tourAt = (steps: Step[], frame: number, g: Geo) => {
  let cur = steps[0].shot || 'meta', prev: string | null = null, shotF = -999;
  let from = steps[0].v || top(g), to = from, vf = -999;
  for (const s of steps) {
    if (s.f > frame) break;
    if (s.shot && s.shot !== cur) { prev = cur; cur = s.shot; shotF = s.f; }
    if (s.v) { from = lerpV(from, to, outCubic(clamp((s.f - vf) / VD))); to = s.v; vf = s.f; }
  }
  const v = lerpV(from, to, outCubic(clamp((frame - vf) / VD)));
  // never show past the page
  const k = kOf(g), hw = g.cw / (2 * k * v.z), hh = g.ch / (2 * k * v.z), H = SHOT_H[cur] || 860;
  v.x = Math.min(Math.max(v.x, hw), 460 - hw);
  v.y = Math.min(Math.max(v.y, hh), Math.max(hh, H - hh));
  return {cur, prev, shotF, v};
};

const PanelCard: React.FC<{plan: Plan; frame: number; t: number; steps: Step[]; rings?: Ring[]; g?: Geo; enter?: number; bubble?: boolean; children?: React.ReactNode}> = ({
  plan, frame, t, steps, rings = [], g = CARD, enter = -999, bubble = true, children,
}) => {
  const {cur, prev, shotF, v} = tourAt(steps, frame, g);
  const k = kOf(g);
  const ek = enter > -999 ? outBack(clamp((frame - enter) / 10), 1.5) : 1;
  const toCard = (x: number, y: number): [number, number] => [g.cw / 2 + (x - v.x) * k * v.z, g.ch / 2 + (y - v.y) * k * v.z];
  const fade = clamp((frame - shotF) / 3);
  const page = (name: string, o = 1) => (
    <Img src={shot(plan, name)} style={{position: 'absolute', left: 0, top: 0, width: 460 * k, opacity: o}} />
  );
  return (
    <div style={{position: 'absolute', left: g.cx - g.cw / 2, top: g.ct, width: g.cw, height: g.ch, transform: `perspective(2600px) rotateX(${1.5}deg) rotateY(${1.6 * Math.sin(t * 0.9)}deg) scale(${0.86 + 0.14 * ek})`,
      opacity: clamp(ek * 3)}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 40, overflow: 'hidden', background: APP.bg, boxShadow: `0 0 0 7px ${INK}, 0 0 0 12px ${APP.borderStrong}, 0 0 0 18px ${INK}, 0 36px 70px rgba(0,0,0,0.55)`}}>
        <div style={{position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${g.cw / 2 - v.x * k * v.z}px, ${g.ch / 2 - v.y * k * v.z}px) scale(${v.z})`}}>
          {prev && fade < 1 && page(prev)}
          {page(cur, prev ? fade : 1)}
          {rings.map((r, i) => (frame >= r.f && (r.until === undefined || frame < r.until)) && (
            <Mark key={i} cx={r.cx * k} cy={r.cy * k} rx={r.rx * k} ry={r.ry * k} f={frame - r.f} label={r.label} side={r.side} size={46 / v.z} />
          ))}
        </div>
        {steps.filter((s) => s.tap).map((s, i) => {
          const [x, y] = toCard(s.tap![0], s.tap![1]);
          return <Tap key={i} x={x} y={y} f={frame - (s.f - 5)} />;
        })}
        {children}
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 22%)', pointerEvents: 'none'}} />
      </div>
      {bubble && <Bubble src={plan.me.face} x={-6} y={-6} s={1.2} />}
    </div>
  );
};

/** A scene of the tour: backdrop, the card, the progress bar. */
const TourScene: React.FC<SceneProps & {color: string; steps: Step[]; rings?: Ring[]; enter?: number; g?: Geo; children?: React.ReactNode}> = ({
  plan, frame, t, color, steps, rings, enter, g, children,
}) => (
  <AbsoluteFill>
    <Backdrop color={color} t={t} rays={0.6} cy={1100} />
    <PanelCard plan={plan} frame={frame} t={t} steps={steps} rings={rings} enter={enter} g={g} />
    {children}
  </AbsoluteFill>
);

// Tab buttons (CSS centres) and the rows the rings go round, from the captures.
const TAB = {meta: [53, 82], comps: [141, 82], draft: [230, 82], counters: [318, 82], trophies: [407, 82]} as const;

// ================================================================ scenes
/** The promise: the bubble lands on the game, and five panel views fan out of it. */
const HOOK_SHOTS = ['meta-map', 'draft-e2b1', 'counters-mrp', 'review', 'trophies'];
const HPY = 1300, HSY = HPY - LH / 2;
const Hook: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const h = at(seg, 0, spb);
  const u = clamp((frame - h) / 10);
  const kb = outBack(u, 1.3);
  const bs = 3.2 - 2.2 * kb;
  return (
    <AbsoluteFill>
      <Backdrop color={VIOLET} t={t} rays={0.9} cy={900} />
      <Halo x={W / 2} y={800} r={650} color="#c9a8ff" a={0.55} />
      <Phone w={LW} h={LH} cy={HPY}>
        <Game plan={plan} t={t} />
        <Bubble src={plan.me.face} x={ease(LW / 2, BX, u)} y={ease(LH / 2, BY, u)} s={bs} pulse={frame > h + 12 ? ((frame - h - 12) % 22) / 22 : 0} />
      </Phone>
      <Burst f={frame - h - 6} x={SX + BX} y={HSY + BY} />
      {HOOK_SHOTS.map((name, i) => {
        const f0 = at(seg, 1 + i, spb);
        const p = clamp((frame - f0) / 10);
        if (p <= 0) return null;
        const kk = outBack(p, 1.5);
        const d = i - 2;
        const tx = W / 2 + d * 175, ty = 790 + Math.abs(d) * 34 + 8 * Math.sin(t * 2 + i);
        const x = SX + BX + (tx - SX - BX) * kk, y = HSY + BY + (ty - HSY - BY) * kk;
        return (
          <div key={name} style={{position: 'absolute', left: x, top: y, width: 290, height: 470, transform: `translate(-50%,-50%) rotate(${d * 9 * kk}deg) scale(${0.3 + 0.7 * kk})`,
            borderRadius: 26, overflow: 'hidden', background: APP.bg, boxShadow: `0 0 0 5px ${INK}, 0 0 0 9px ${APP.borderStrong}, 0 0 0 13px ${INK}, 0 24px 40px rgba(0,0,0,0.5)`, zIndex: 10 - Math.abs(d)}}>
            <Img src={shot(plan, name)} style={{width: 290}} />
          </div>
        );
      })}
      {frame >= at(seg, 6, spb) && <Banner text="12 FEATURES" color={APP.brand} size={104} y={1620} frame={frame} at={at(seg, 6, spb)} />}
      <Flash f={frame - h - 6} />
    </AbsoluteFill>
  );
};

/** 1. It floats over the game: drag it to the edge, tap it, the panel slides in. */
const Float: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const dragF = at(seg, 0, spb), tapF = at(seg, 1, spb), openF = at(seg, 2, spb), pickF = at(seg, 3, spb);
  const du = clamp((frame - dragF) / 20);
  const bx = ease(LW - 90, BX, du), by = ease(300, BY, du) - 50 * Math.sin(Math.PI * du);
  const open = (frame - openF) / 12;
  const zoomU = (frame - openF - 6) / 16;
  const s = ease(1, 1.75, zoomU);
  const [mx, my] = [PNX + 230 * PX, 201 * PX];
  return (
    <AbsoluteFill>
      <Backdrop color={BLUE} t={t} rays={0.6} cy={PY} />
      <Cam s={s} fx={ease(W / 2, SX + PNX + PNW / 2, zoomU)} fy={PY}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} dim={clamp(open) * 0.8} />
          <Bubble src={plan.me.face} x={bx} y={by} press={frame >= tapF - 5 && frame <= tapF ? 1 : 0} />
          {frame >= dragF - 4 && frame < dragF + 24 && <Tap x={bx} y={by} f={frame - dragF + 4} hold={22} />}
          <Tap x={BX} y={BY} f={frame - (tapF - 5)} />
          {frame >= openF && <PanelShot src={shot(plan, 'chooser')} k={open} />}
          <Tap x={mx} y={my} f={frame - (pickF - 5)} />
        </Phone>
      </Cam>
    </AbsoluteFill>
  );
};

/** 2. The best picks: Meta, Knockout, the map, the list. */
const Meta: React.FC<SceneProps> = (p) => {
  const {seg, spb} = p;
  const [a, b, c] = [0, 1, 2].map((i) => at(seg, i, spb));
  return (
    <TourScene {...p} color={BLUE} enter={0}
      steps={[{f: 0, shot: 'meta', v: top(CARD)}, {f: a, shot: 'meta-ko', tap: [97, 185]}, {f: b, shot: 'meta-map', tap: [65, 214]},
        {f: c, v: {z: 1.4, x: 230, y: 330}}]}
      rings={[{f: c + 6, cx: 230, cy: 291, rx: 226, ry: 24, label: '#1 ON THIS MAP', side: 'below'}]} />
  );
};

/** 3. Who to ban on that map. */
const Bans: React.FC<SceneProps> = (p) => {
  const {seg, spb} = p;
  const [a, b] = [0, 1].map((i) => at(seg, i, spb));
  return (
    <TourScene {...p} color={RED}
      steps={[{f: 0, shot: 'meta-map', v: top(CARD)}, {f: a, shot: 'meta-map-bans', tap: [342, 231]}, {f: b, v: {z: 1.4, x: 230, y: 340}}]}
      rings={[{f: b + 6, cx: 230, cy: 304, rx: 226, ry: 24, label: 'BAN THIS ONE', side: 'below'}]} />
  );
};

/** 4. The draft board: add their pick, the list re-sorts. */
const Draft: React.FC<SceneProps> = (p) => {
  const {seg, spb} = p;
  const [a, b, c, d, e] = [0, 1, 2, 3, 4].map((i) => at(seg, i, spb));
  return (
    <TourScene {...p} color={VIOLET}
      steps={[{f: 0, shot: 'meta-map-bans', v: top(CARD)}, {f: a, shot: 'draft-board', tap: [...TAB.draft]}, {f: b, shot: 'draft-picker', tap: [164, 162]},
        {f: c, shot: 'draft-e1', tap: [36, 278]}, {f: d, v: {z: 1.3, x: 230, y: 330}}, {f: e, shot: 'draft-e2b1', tap: [208, 162]}]}
      rings={[{f: d + 4, until: e, cx: 230, cy: 210, rx: 224, ry: 23, label: 'BEST PICK NOW', side: 'below'},
        {f: e + 4, cx: 230, cy: 210, rx: 224, ry: 23, label: 'UPDATED', side: 'below'}]} />
  );
};

/** 5. Counters: they picked Mr. P. */
const Counters: React.FC<SceneProps> = (p) => {
  const {seg, spb} = p;
  const [a, b, c] = [0, 1, 2].map((i) => at(seg, i, spb));
  return (
    <TourScene {...p} color={ORANGE}
      steps={[{f: 0, shot: 'draft-e2b1', v: top(CARD)}, {f: a, shot: 'counters0', tap: [...TAB.counters]}, {f: b, shot: 'counters-mrp', tap: [149, 200]},
        {f: c, v: {z: 1.35, x: 230, y: 270}}]}
      rings={[{f: c + 5, cx: 230, cy: 196, rx: 216, ry: 23, label: 'BEATS MR. P', side: 'below'}]} />
  );
};

/** 6. Team comps, then the build sheet of any brawler. */
const Comps: React.FC<SceneProps> = (p) => {
  const {seg, spb} = p;
  const [a, b, c, d, e] = [0, 1, 2, 3, 4].map((i) => at(seg, i, spb));
  return (
    <TourScene {...p} color={TEAL}
      steps={[{f: 0, shot: 'counters-mrp', v: top(CARD)}, {f: a, shot: 'comps', tap: [...TAB.comps]}, {f: b, v: {z: 1.25, x: 230, y: 330}},
        {f: c, shot: 'meta', v: top(CARD), tap: [...TAB.meta]}, {f: d, shot: 'build', tap: [72, 277]}, {f: e, v: {z: 1.2, x: 230, y: 520}}]}
      rings={[{f: b + 4, until: c, cx: 230, cy: 302, rx: 224, ry: 30, label: 'BEST TRIO', side: 'below'},
        {f: e + 5, cx: 230, cy: 607, rx: 218, ry: 21, label: 'THE BUILD', side: 'above'}]} />
  );
};

// ---------------------------------------------------------------- native screens
const Radio: React.FC<{on: boolean; k?: number}> = ({on, k = 1}) => (
  <div style={{width: 46, height: 46, borderRadius: '50%', border: `5px solid ${on ? APP.brand : APP.borderStrong}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
    {on && <div style={{width: 22 * k, height: 22 * k, borderRadius: '50%', background: APP.brand}} />}
  </div>
);

const Switch: React.FC<{on: number}> = ({on}) => (
  <div style={{position: 'relative', width: 84, height: 44, borderRadius: 22, background: on > 0.5 ? '#3d6f8a' : '#2a3566', flexShrink: 0}}>
    <div style={{position: 'absolute', top: 2, left: 2 + 40 * on, width: 40, height: 40, borderRadius: '50%', background: on > 0.5 ? '#7fd3c3' : '#8e9bc7', boxShadow: '0 2px 6px rgba(0,0,0,0.35)'}} />
  </div>
);

const Caption: React.FC<{text: string; style?: React.CSSProperties}> = ({text, style}) => (
  <div style={{fontFamily: BODY, fontSize: 24, letterSpacing: 3, color: APP.muted, ...style}}>{text}</div>
);

/** The app's account card: what the panel shows, and hide the rest (activity_main: account_chips, hide_unusable). */
const AccountCard: React.FC<{plan: Plan; sel: number; hide: number; press: number; x: number; y: number; w: number; enter: number}> = ({plan, sel, hide, press, x, y, w, enter}) => {
  const rows: [string, string, string, React.ReactNode][] = [
    ['All my brawlers', 'Mark everything you own; grey out the rest', '60', <Img src={staticFile(plan.me.face)} style={{width: 46, height: 46, borderRadius: 12}} />],
    ['Power 11 only', 'Just what is fully upgraded for Ranked', '17', (plan as any).power11 ? <Img src={staticFile((plan as any).power11)} style={{width: 50, height: 50, objectFit: 'contain'}} /> : null],
    ['Power 11 + hypercharge', 'Only brawlers at their absolute strongest', '3',
      <svg width={46} height={50} viewBox="0 0 40 44"><path d="M20 2c4 8 14 12 14 24a14 14 0 0 1-28 0C6 18 12 14 13 8c3 4 3 7 7 9 0-6-2-10 0-15z" fill="#c23cff" stroke={INK} strokeWidth="3" /><path d="M20 22l-5 9h5l-2 8 7-11h-5l3-6z" fill="#fff" /></svg>],
  ];
  const k = outBack(clamp(enter), 1.4);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, padding: '22px 24px 20px', boxSizing: 'border-box', borderRadius: 34, background: 'rgba(20,30,80,0.96)',
      boxShadow: `0 0 0 5px ${INK}, inset 0 0 0 3px ${APP.border}, 0 24px 50px rgba(0,0,0,0.5)`, transform: `scale(${0.85 + 0.15 * k})`, opacity: clamp(k * 3), transformOrigin: '50% 0'}}>
      <Caption text="SHOW IN THE PANEL · TAP TO CHOOSE" />
      {rows.map(([title, body, n, icon], i) => {
        const on = sel === i;
        return (
          <div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 14, padding: '14px 18px', borderRadius: 24, background: on ? '#2a3a86' : APP.surface2,
            boxShadow: `0 0 0 4px ${on ? APP.brand : INK}, inset 0 0 0 2px ${on ? APP.brand : APP.border}`, transform: `scale(${on ? 1 - 0.03 * press : 1})`}}>
            <Radio on={on} />
            <div style={{width: 50, display: 'flex', justifyContent: 'center'}}>{icon}</div>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontFamily: BODY, fontSize: 33, color: APP.fg}}>{title}</div>
              <div style={{fontFamily: SANS, fontSize: 22, color: APP.muted, marginTop: 2}}>{body}</div>
            </div>
            <div style={{fontFamily: BODY, fontSize: 32, color: APP.fg, padding: '4px 18px', borderRadius: 999, background: APP.bg, boxShadow: `0 0 0 3px ${INK}`}}>{n}</div>
          </div>
        );
      })}
      <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 20, paddingTop: 16, borderTop: `2px solid ${APP.border}`}}>
        <div style={{flex: 1}}>
          <div style={{fontFamily: BODY, fontSize: 32, color: APP.fg}}>Hide unavailable brawlers</div>
          <div style={{fontFamily: SANS, fontSize: 22, color: APP.muted, marginTop: 2}}>Show only what you can play, instead of greying the rest</div>
        </div>
        <Switch on={hide} />
      </div>
    </div>
  );
};

/** 7. Your brawlers: the account card's settings, and the panel answering each one. */
const YOURS_SHOTS = ['f-all', 'f-p11', 'f-p11-hide', 'f-hyper-hide'];
const YOURS_LABELS = ['YOU OWN THE BRIGHT ONES', 'ONLY POWER 11 LIT', 'THE REST, HIDDEN', 'HYPERCHARGED ONLY'];
const Yours: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const [e, a, b, c] = [0, 1, 2, 3].map((i) => at(seg, i, spb));
  const n = [a, b, c].filter((f) => frame >= f).length;
  const sel = frame >= c ? 2 : frame >= a ? 1 : 0;
  const hide = clamp((frame - b) / 6);
  const g: Geo = {cx: W / 2, ct: 1150, cw: 820, ch: 600};
  // where the taps land on the account card (frame px): Power 11 row, the switch, hypercharge row
  // measured on the rendered card: rows at 603 + 113 i, the switch at 949
  const cardX = 90, cardY = 500, rowY = (i: number) => 603 + 113 * i;
  const taps: [number, number, number][] = [[a, cardX + 60, rowY(1)], [b, cardX + 900 - 70, 949], [c, cardX + 60, rowY(2)]];
  const labelF = [e + 8, a + 4, b + 4, c + 4][n];
  return (
    <AbsoluteFill>
      <Backdrop color={GREEN} t={t} rays={0.6} cy={1100} />
      <AccountCard plan={plan} sel={sel} hide={hide} press={0} x={cardX} y={cardY} w={900} enter={(frame - e) / 10} />
      {taps.map(([f, x, y], i) => <Tap key={i} x={x} y={y} f={frame - (f - 5)} />)}
      <PanelCard plan={plan} frame={frame} t={t} g={g} enter={e + 4} bubble={false}
        steps={[{f: 0, shot: 'f-all', v: {z: 1, x: 230, y: 236 + 600 / (2 * 820 / 460)}}, {f: a, shot: 'f-p11'}, {f: b, shot: 'f-p11-hide'}, {f: c, shot: 'f-hyper-hide'}]} />
      {frame >= labelF && (
        <div key={n} style={{position: 'absolute', left: W / 2, top: 1150, transform: `translate(-50%,-50%) scale(${pop(frame, labelF, 8, 2.2)}) rotate(-3deg)`,
          padding: '8px 26px 11px', borderRadius: 999, background: MARK, boxShadow: `0 0 0 5px ${INK}, 0 7px 0 5px ${DEEP}`, whiteSpace: 'nowrap', zIndex: 5}}>
          <span style={{fontFamily: HEAD, fontSize: 40, color: INK}}>{YOURS_LABELS[n]}</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** 8. Trophy maps: the best brawlers there, and yours to push. */
const Trophies: React.FC<SceneProps> = (p) => {
  const {seg, spb} = p;
  const [a, b, c] = [0, 1, 2].map((i) => at(seg, i, spb));
  return (
    <TourScene {...p} color="#e0a020" enter={0}
      steps={[{f: 0, shot: 'meta', v: top(CARD)}, {f: a, shot: 'trophies', tap: [...TAB.trophies]}, {f: b, v: {z: 1.25, x: 250, y: 300}}, {f: c, v: top(CARD, 330)}]}
      rings={[{f: b + 5, until: c, cx: 393, cy: 162, rx: 62, ry: 30, label: 'YOUR BEST HERE', side: 'left'}]} />
  );
};

/** 9. After the game: ✓ on the bubble with the session score, then the review. */
const Review: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const [badgeF, tapF, r1, r2] = [0, 1, 2, 3].map((i) => at(seg, i, spb));
  const cardF = tapF + 6;
  if (frame >= cardF) {
    return (
      <TourScene plan={plan} seg={seg} frame={frame} t={t} spb={spb} beat={0} color={GREEN} enter={cardF}
        steps={[{f: 0, shot: 'review', v: {z: 1.12, x: 230, y: 280}}]}
        rings={[{f: r1 + 3, until: r2, cx: 230, cy: 190, rx: 222, ry: 30, label: 'YOUR DRAFT: 58%', side: 'below'},
          {f: r2 + 3, cx: 230, cy: 368, rx: 222, ry: 40, label: 'THE BETTER PICK', side: 'below'}]} />
    );
  }
  const z = (frame) / 12;
  const f = frame - badgeF;
  return (
    <AbsoluteFill>
      <Backdrop color={GREEN} t={t} rays={0.6} cy={PY} />
      <Cam s={ease(1, 2.4, z)} fx={ease(W / 2, SX + BX + 80, z)} fy={ease(PY, SY + BY + 40, z)} cy={1080}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} />
          <Bubble src={plan.me.face} badge={frame >= badgeF ? 'win' : null} pill={frame >= badgeF ? '3–1 +21' : '2–1 +10'} pulse={f >= 0 && f < 14 ? f / 14 : 0}
            s={1 + 0.15 * Math.max(0, 1 - Math.abs(f) / 6)} press={frame >= tapF - 5 && frame <= tapF ? 1 : 0} />
          <Tap x={BX} y={BY} f={frame - (tapF - 5)} r={26} />
        </Phone>
      </Cam>
    </AbsoluteFill>
  );
};

// A portrait phone with the app (activity_main) on it.
const AW = 620, AH = 1260, ACY = 1150;

const AppHeader: React.FC = () => (
  <div style={{display: 'flex', alignItems: 'center', gap: 16, padding: '26px 28px 8px'}}>
    <Img src={staticFile('app-icon.png')} style={{width: 76, height: 76, borderRadius: '50%', boxShadow: `0 0 0 3px ${INK}`}} />
    <div style={{flex: 1}}>
      <div style={{fontFamily: BODY, fontSize: 52, color: '#fff', lineHeight: 1}}>Bubble</div>
      <div style={{fontFamily: BODY, fontSize: 18, letterSpacing: 5, color: APP.muted, marginTop: 4}}>BRAWLZONE</div>
    </div>
    <div style={{fontFamily: BODY, fontSize: 22, color: '#fff', padding: '6px 14px', borderRadius: 999, background: APP.bg, boxShadow: `0 0 0 3px ${INK}, inset 0 0 0 2px ${APP.border}`}}>EN</div>
  </div>
);

const AppCard: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{margin: '10px 24px 0', padding: '20px 22px', borderRadius: 30, background: 'rgba(22,32,86,0.95)', boxShadow: `0 0 0 4px ${INK}, inset 0 0 0 2px ${APP.border}`, ...style}}>{children}</div>
);

const AppButton: React.FC<{text: string; gold?: boolean}> = ({text, gold}) => (
  <div style={{flex: 1, textAlign: 'center', padding: '14px 8px 16px', borderRadius: 20, fontFamily: BODY, fontSize: 25, color: gold ? '#1A1200' : '#fff',
    background: gold ? 'linear-gradient(180deg,#FFE37A,#FFC53D 55%,#FFAB00)' : `linear-gradient(180deg,#4A6AE0,${APP.blueFace})`,
    boxShadow: `0 0 0 3px ${INK}, 0 6px 0 3px ${gold ? '#B86A00' : APP.blueDepth}`}}>{text}</div>
);

/** 10. My season (rank, elo, streak, daily goal) and Friends and rivals. */
const FRIENDS: [string, string, string, string][] = [['Leo', 'mythic', '4,120', '12–5'], ['YOU', 'diamond', '3,500', '9–4'], ['Maya', 'diamond', '3,240', '7–6'], ['Kai', 'gold', '2,610', '4–3']];
const Season: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const [inF, barF, goalF, scrollF, notifF] = [0, 1, 2, 3, 4].map((i) => at(seg, i, spb));
  const lg = (plan as any).leagues || {};
  const bar = 0.64 * clamp((frame - barF) / 16);
  const dots = frame >= goalF ? 3 : 2;
  const scroll = 430 * outCubic(clamp((frame - scrollF) / 16));
  const nu = clamp((frame - notifF) / 9);
  const faces = (plan as any).top5 || [];
  return (
    <AbsoluteFill>
      <Backdrop color={PINK} t={t} rays={0.6} cy={ACY} />
      <Phone w={AW} h={AH} cy={ACY} scale={ease(0.88, 1, (frame - inF) / 12)}>
        <AbsoluteFill style={{background: 'linear-gradient(180deg,#2f56b0 0%,#1d2f86 35%,#0d1440 100%)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: -scroll}}>
          <AppHeader />
          <Caption text="MY SEASON" style={{margin: '18px 30px 4px'}} />
          <AppCard>
            <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
              {lg.diamond && <Img src={staticFile(lg.diamond)} style={{width: 112, height: 112, objectFit: 'contain', transform: `scale(${frame >= barF ? 1 : 0.9})`}} />}
              <div style={{flex: 1}}>
                <div style={{fontFamily: BODY, fontSize: 44, color: APP.fg}}>Diamond II</div>
                <div style={{fontFamily: SANS, fontSize: 24, fontWeight: 700, color: APP.muted}}>3,500 elo</div>
              </div>
              <div style={{textAlign: 'center', padding: '8px 16px', borderRadius: 18, background: APP.surface2, boxShadow: `inset 0 0 0 2px ${APP.border}`}}>
                <div style={{fontFamily: BODY, fontSize: 40, color: '#ff9a3c', lineHeight: 1}}>5🔥</div>
                <div style={{fontFamily: SANS, fontSize: 18, color: APP.muted}}>streak</div>
              </div>
            </div>
            <div style={{height: 22, borderRadius: 11, background: APP.bg, marginTop: 16, overflow: 'hidden', boxShadow: `0 0 0 2px ${INK}`}}>
              <div style={{width: `${bar * 100}%`, height: '100%', background: 'linear-gradient(90deg,#FFC53D,#FFAB00)'}} />
            </div>
            <div style={{fontFamily: SANS, fontSize: 22, fontWeight: 700, color: APP.muted, marginTop: 8}}>500 elo to Diamond III · ≈7 wins</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, padding: '12px 16px', borderRadius: 18, background: APP.surface2}}>
              <div style={{flex: 1}}>
                <div style={{fontFamily: BODY, fontSize: 28, color: APP.fg}}>Daily goal</div>
                <div style={{fontFamily: SANS, fontSize: 21, fontWeight: 700, color: dots === 3 ? APP.victory : APP.muted}}>{dots === 3 ? 'Done for today ✓' : 'Ranked wins a day: 3'}</div>
              </div>
              {[0, 1, 2].map((i) => <div key={i} style={{width: 30, height: 30, borderRadius: '50%', background: i < dots ? APP.brand : APP.bg, boxShadow: `0 0 0 3px ${INK}`,
                transform: `scale(${i === 2 && dots === 3 ? pop(frame, goalF, 8, 2.6) : 1})`}} />)}
            </div>
            <div style={{fontFamily: SANS, fontSize: 21, fontWeight: 700, color: APP.muted, marginTop: 14}}>Season 51: 24–15 · Diamond II · Best: Bibi</div>
            <div style={{display: 'flex', gap: 14, marginTop: 16}}><AppButton text="Share my rank" gold /><AppButton text="Season Wrapped" /></div>
          </AppCard>
          <Caption text="FRIENDS AND RIVALS" style={{margin: '26px 30px 4px'}} />
          <AppCard>
            {FRIENDS.map(([name, rank, elo, week], i) => (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px', marginTop: i ? 8 : 0, borderRadius: 18,
                background: name === 'YOU' ? '#2a3a86' : 'transparent', boxShadow: name === 'YOU' ? `inset 0 0 0 3px ${APP.brand}` : 'none'}}>
                <div style={{width: 28, fontFamily: BODY, fontSize: 28, color: APP.muted}}>{i + 1}</div>
                <Img src={staticFile(name === 'YOU' ? plan.me.face : faces[(i + 1) % Math.max(1, faces.length)]?.face || plan.me.face)} style={{width: 62, height: 62, borderRadius: 14}} />
                <div style={{flex: 1}}>
                  <div style={{fontFamily: BODY, fontSize: 30, color: APP.fg}}>{name === 'YOU' ? 'YOU (you)' : name}</div>
                  <div style={{fontFamily: SANS, fontSize: 19, fontWeight: 700, color: APP.muted}}>{`This week ${week}`}</div>
                </div>
                {lg[rank] && <Img src={staticFile(lg[rank])} style={{width: 52, height: 52, objectFit: 'contain'}} />}
                <div style={{fontFamily: BODY, fontSize: 28, color: APP.fg, width: 86, textAlign: 'right'}}>{elo}</div>
              </div>
            ))}
            <div style={{marginTop: 12, fontFamily: BODY, fontSize: 24, color: APP.brand}}>+ Add a friend</div>
          </AppCard>
        </div>
        {nu > 0 && (
          <div style={{position: 'absolute', left: 16, right: 16, top: 18, transform: `translateY(${(1 - outBack(nu, 1.4)) * -140}px)`, padding: '16px 18px', borderRadius: 26,
            background: 'rgba(30,34,52,0.96)', boxShadow: '0 10px 24px rgba(0,0,0,0.5)', display: 'flex', gap: 14}}>
            <Img src={staticFile('app-icon.png')} style={{width: 50, height: 50, borderRadius: 12}} />
            <div>
              <div style={{fontFamily: SANS, fontSize: 17, fontWeight: 700, color: APP.muted}}>BrawlZone Bubble · now</div>
              <div style={{fontFamily: SANS, fontSize: 24, fontWeight: 800, color: '#fff'}}>Leo reached Mythic I</div>
              <div style={{fontFamily: SANS, fontSize: 20, color: '#c9cfe8'}}>Now 620 elo above you. Your move!</div>
            </div>
          </div>
        )}
      </Phone>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- home screen
const PW = 470, PH = 1000, PCY = 1120;

const Widget: React.FC<{k: number; w: number; h: number; x: number; y: number; children: React.ReactNode}> = ({k, w, h, x, y, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 26, padding: 16, background: APP.surface, border: `2px solid ${APP.border}`,
    boxShadow: '0 10px 20px rgba(0,0,0,0.35)', transform: `scale(${k})`, opacity: clamp(k * 2), boxSizing: 'border-box', overflow: 'hidden'}}>{children}</div>
);

const Wallpaper: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill style={{background: `radial-gradient(120% 70% at ${50 + 10 * Math.sin(t * 0.4)}% 0%, #4a3aa8, #182060 55%, #0a0f2e)`}} />
);

/** 11. Widgets on the home screen, then the alerts landing on top. */
const Home: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const k = (i: number) => pop(frame, at(seg, i, spb), 10, 1.8);
  const lg = (plan as any).leagues || {};
  const notes: [string, string][] = [
    ['🎁 New free reward!', 'Free Starr Drop. Tap to claim it before it expires.'],
    ['Balance changes to your brawlers', 'Shade nerfed · Gus nerfed'],
    ['⏳ Ranked season ends in 2 days', 'Last chance to climb. The bubble has the best picks for every map.'],
  ];
  const n0 = at(seg, 4, spb);
  const dim = clamp((frame - n0 + 4) / 8);
  return (
    <AbsoluteFill>
      <Backdrop color={VIOLET} t={t} rays={0.6} cy={PCY} />
      <Cam s={1.42} fx={W / 2} fy={PCY - PH / 2 + 430} cy={1140}>
        <Phone w={PW} h={PH} cy={PCY} scale={ease(0.86, 1, frame / 10)}>
          <Wallpaper t={t} />
          <div style={{position: 'absolute', left: 0, right: 0, top: 26, textAlign: 'center', fontFamily: BODY, fontSize: 66, color: '#fff'}}>20:41</div>
          <Widget k={k(0)} w={430} h={170} x={20} y={130}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
              {lg.diamond && <Img src={staticFile(lg.diamond)} style={{width: 92, height: 92, objectFit: 'contain'}} />}
              <div style={{display: 'flex', flexDirection: 'column', gap: 4, flex: 1}}>
                <span style={{fontFamily: BODY, fontSize: 15, color: APP.muted}}>MY RANK</span>
                <span style={{fontFamily: BODY, fontSize: 32, color: APP.fg}}>Diamond II</span>
                <span style={{fontFamily: BODY, fontSize: 17, color: APP.brand}}>≈7 wins to Diamond III</span>
              </div>
              <div style={{fontFamily: BODY, fontSize: 18, color: '#ff9a3c', textAlign: 'center'}}><div style={{fontSize: 34}}>5</div>streak</div>
            </div>
            <div style={{height: 12, borderRadius: 6, background: APP.bg, marginTop: 10, overflow: 'hidden'}}>
              <div style={{width: `${64 * clamp((frame - at(seg, 0, spb) - 4) / 20)}%`, height: '100%', background: `linear-gradient(90deg, ${APP.brand}, #ffab00)`}} />
            </div>
            <div style={{fontFamily: BODY, fontSize: 15, color: APP.muted, marginTop: 6}}>Last 5: 4–1 · ★2</div>
          </Widget>
          <Widget k={k(1)} w={430} h={196} x={20} y={318}>
            <span style={{fontFamily: BODY, fontSize: 15, color: APP.brand, letterSpacing: 1}}>TROPHY MAPS NOW</span>
            {[['Pinhole Punt', 'Brawl Ball · 21h left', plan.push?.[0]], ['Hot Potato', 'Heist · 7h left', plan.push?.[1]]].map(([m, sub, b]: any, j) => (
              <div key={j} style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: 8, borderRadius: 14, background: APP.surface2}}>
                <div style={{display: 'flex', flexDirection: 'column', flex: 1}}>
                  <span style={{fontFamily: BODY, fontSize: 21, color: APP.fg}}>{m}</span>
                  <span style={{fontFamily: BODY, fontSize: 14, color: APP.muted}}>{sub}</span>
                </div>
                <span style={{fontFamily: BODY, fontSize: 13, color: APP.muted}}>PUSH</span>
                {b?.face && <Img src={staticFile(b.face)} style={{width: 50, height: 50, borderRadius: 12}} />}
              </div>
            ))}
          </Widget>
          <Widget k={k(2)} w={205} h={186} x={20} y={532}>
            <span style={{fontFamily: BODY, fontSize: 15, color: APP.brand, letterSpacing: 1}}>FREE REWARD</span>
            <div style={{fontFamily: BODY, fontSize: 21, color: APP.fg, marginTop: 10}}>Free Starr Drop</div>
            <div style={{marginTop: 18, textAlign: 'center', padding: '8px 0', borderRadius: 12, fontFamily: BODY, fontSize: 20, color: '#1A1200', background: APP.brand}}>Claim</div>
          </Widget>
          <Widget k={k(3)} w={205} h={186} x={245} y={532}>
            <span style={{fontFamily: BODY, fontSize: 15, color: APP.brand, letterSpacing: 1}}>TOP RANKED PICKS</span>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10}}>
              {((plan as any).top5 || []).map((b: any, j: number) => (
                <div key={j} style={{position: 'relative'}}>
                  <Img src={staticFile(b.face)} style={{width: 50, height: 50, borderRadius: 11}} />
                  <span style={{position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 6, background: TIER[b.tier] || '#999', fontFamily: BODY,
                    fontSize: 14, color: '#fff', textAlign: 'center', lineHeight: '20px', boxShadow: `0 0 0 2px ${INK}`}}>{b.tier}</span>
                </div>
              ))}
            </div>
          </Widget>
          <div style={{position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'space-evenly', opacity: 0.9}}>
            {[0, 1, 2, 3].map((j) => <div key={j} style={{width: 86, height: 86, borderRadius: 24, background: j === 1 ? 'transparent' : 'rgba(255,255,255,0.12)', overflow: 'hidden'}}>
              {j === 1 && <Img src={staticFile('app-icon.png')} style={{width: 86, height: 86}} />}</div>)}
          </div>
          {dim > 0 && <AbsoluteFill style={{background: `rgba(4,6,20,${0.55 * dim})`}} />}
          {notes.map(([title, text], j) => {
            const u = (frame - at(seg, 4 + j, spb)) / 9;
            if (u <= 0) return null;
            return (
              <div key={j} style={{position: 'absolute', left: 14, right: 14, top: 120 + j * 150, transform: `translateY(${(1 - outBack(u, 1.4)) * -90}px)`, opacity: clamp(u * 2),
                padding: '14px 16px', borderRadius: 24, background: 'rgba(30,34,52,0.96)', boxShadow: '0 8px 18px rgba(0,0,0,0.45)', display: 'flex', gap: 14}}>
                <Img src={staticFile('app-icon.png')} style={{width: 44, height: 44, borderRadius: 12}} />
                <div style={{display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0}}>
                  <span style={{fontFamily: SANS, fontSize: 15, fontWeight: 700, color: APP.muted}}>BrawlZone Bubble · now</span>
                  <span style={{fontFamily: SANS, fontSize: 21, fontWeight: 800, color: '#fff'}}>{title}</span>
                  <span style={{fontFamily: SANS, fontSize: 17, color: '#c9cfe8'}}>{text}</span>
                </div>
                {j === 1 && <Mark cx={205} cy={46} rx={222} ry={54} f={frame - at(seg, 5, spb) - 8} />}
              </div>
            );
          })}
        </Phone>
      </Cam>
    </AbsoluteFill>
  );
};

/** 12. Make it yours: the bubble's size and fade (look_size, look_idle), then the panel in 21 languages. */
const SIZES = [0.72, 1, 1.32];
const LANGS: [string, string][] = [['lang-es', '🇪🇸'], ['lang-pt', '🇧🇷'], ['lang-fr', '🇫🇷'], ['lang-de', '🇩🇪'], ['lang-ja', '🇯🇵'], ['lang-ko', '🇰🇷'],
  ['lang-ru', '🇷🇺'], ['lang-ar', '🇸🇦'], ['lang-tr', '🇹🇷'], ['lang-zh-Hans', '🇨🇳']];
const Style: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const [aF, bF, cF, swF] = [0, 1, 2, 3].map((i) => at(seg, i, spb));
  const size = frame >= cF ? 1 : frame >= bF ? 2 : frame >= aF ? 0 : 1;
  const prevSize = frame >= cF ? 2 : frame >= bF ? 0 : 1;
  const lastF = frame >= cF ? cF : frame >= bF ? bF : aF;
  const s = SIZES[prevSize] + (SIZES[size] - SIZES[prevSize]) * outBack(clamp((frame - lastF) / 8), 2);
  const out = clamp((frame - swF) / 10);
  if (frame >= swF + 4) {
    const flips = LANGS.map((_, i) => at(seg, 4 + i, spb));
    const i = Math.max(0, flips.filter((f) => frame >= f).length - 1);
    const fi = frame - flips[i];
    return (
      <TourScene plan={plan} seg={seg} frame={frame} t={t} spb={spb} beat={0} color={BLUE} enter={swF + 4}
        steps={[{f: 0, shot: LANGS[0][0], v: top(CARD)}, ...LANGS.map(([name], j) => ({f: flips[j], shot: name}))]}>
        <div style={{position: 'absolute', left: W / 2 + 300, top: 560, transform: `translate(-50%,-50%) scale(${pop(fi, 0, 6, 2.4)}) rotate(8deg)`, fontSize: 130, lineHeight: 1,
          filter: `drop-shadow(0 0 0 ${INK}) drop-shadow(0 8px 0 ${DEEP})`}}>{LANGS[i][1]}</div>
        <div style={{position: 'absolute', left: W / 2, top: 1720, transform: `translate(-50%,-50%) scale(${pop(frame, swF + 8, 9, 2.2)})`}}>
          <Label text="21 LANGUAGES" size={76} color="#fff6b0" />
        </div>
      </TourScene>
    );
  }
  const segs: [string, number][] = [['Small', 0], ['Normal', 1], ['Large', 2]];
  const tapX = [W / 2 - 250, W / 2, W / 2 + 250];
  const tapAt = [[aF, 0], [bF, 2], [cF, 1]] as const;
  return (
    <AbsoluteFill style={{transform: `translateX(${-W * outCubic(out)}px)`}}>
      <Backdrop color={BLUE} t={t} rays={0.6} cy={1000} />
      <Phone w={LW} h={LH} cy={760} scale={0.88}>
        <Game plan={plan} t={t} />
        <Bubble src={plan.me.face} s={s} />
      </Phone>
      <div style={{position: 'absolute', left: 90, top: 1090, width: 900, padding: '24px 28px', boxSizing: 'border-box', borderRadius: 34, background: 'rgba(20,30,80,0.96)',
        boxShadow: `0 0 0 5px ${INK}, inset 0 0 0 3px ${APP.border}, 0 24px 50px rgba(0,0,0,0.5)`}}>
        <Caption text="BUBBLE" />
        <div style={{fontFamily: BODY, fontSize: 34, color: APP.fg, marginTop: 14}}>Size</div>
        <div style={{display: 'flex', gap: 14, marginTop: 12}}>
          {segs.map(([label, i]) => (
            <div key={label} style={{flex: 1, textAlign: 'center', padding: '16px 0 18px', borderRadius: 20, fontFamily: BODY, fontSize: 32,
              color: size === i ? '#1A1200' : '#fff', background: size === i ? 'linear-gradient(180deg,#FFE37A,#FFC53D 55%,#FFAB00)' : APP.surface2,
              boxShadow: `0 0 0 3px ${INK}, 0 6px 0 3px ${size === i ? '#B86A00' : APP.blueDepth}`}}>{label}</div>
          ))}
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 28}}>
          <div style={{flex: 1}}>
            <div style={{fontFamily: BODY, fontSize: 32, color: APP.fg}}>Tuck into the edge</div>
            <div style={{fontFamily: SANS, fontSize: 22, color: APP.muted, marginTop: 2}}>While idle, it slides halfway off the screen.</div>
          </div>
          <Switch on={1} />
        </div>
      </div>
      {tapAt.map(([f, i], j) => <Tap key={j} x={tapX[i]} y={1090 + 24 + 30 + 14 + 48 + 12 + 36} f={frame - (f - 5)} />)}
    </AbsoluteFill>
  );
};

/** Bonus: the break card (BubbleService.showTiltCard). */
const Take5: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const h = at(seg, 0, spb);
  const k = pop(frame, h, 10, 1.8);
  return (
    <AbsoluteFill>
      <Backdrop color="#5a5f8a" t={t} rays={0.4} cy={PY} />
      <Cam s={1.6} fx={SX + 300} fy={SY + 170}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} hp={0.2} />
          <Bubble src={plan.me.face} badge="loss" pill="0–3 −36" />
          {k > 0 && (
            <div style={{position: 'absolute', left: BX + BS / 2 + 20, top: BY - 50, transform: `scale(${k})`, transformOrigin: 'left center', display: 'flex', alignItems: 'center',
              gap: 12, padding: '14px 20px 14px 14px', borderRadius: 20, background: 'rgba(16,23,51,0.95)', boxShadow: '0 0 0 3px #050A1F, 0 10px 20px rgba(0,0,0,0.45)'}}>
              <svg width={42} height={42} viewBox="0 0 40 40"><path d="M6 14h22v10a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9z" fill="#fff" /><path d="M28 17h3a4 4 0 0 1 0 8h-3" fill="none" stroke="#fff" strokeWidth="3" />
                <path d="M12 5c-2 3 2 4 0 7M19 4c-2 3 2 4 0 7" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" /></svg>
              <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                <span style={{fontFamily: BODY, fontSize: 24, color: '#fff'}}>3 losses in a row</span>
                <span style={{fontFamily: SANS, fontWeight: 700, fontSize: 18, color: '#B8C2E0', maxWidth: 300}}>Take 5? A short break helps more than one more game.</span>
                <span style={{fontFamily: BODY, fontSize: 18, color: '#FFC53D'}}>Keep playing</span>
              </div>
            </div>
          )}
        </Phone>
      </Cam>
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const k = outBack((frame + 2) / 12, 1.8);
  return (
    <AbsoluteFill>
      <Backdrop color={GREEN} t={t} rays={1} cy={720} />
      <Confetti t={frame / 30} />
      <Halo x={W / 2} y={720} r={330} color="#c8ffd8" a={0.9} />
      <div style={{position: 'absolute', left: W / 2, top: 720, transform: `translate(-50%,-50%) scale(${k}) rotate(${(1 - outCubic(frame / 14)) * -20 + 3 * Math.sin(t * 2)}deg)`}}>
        <Img src={staticFile('app-icon.png')} style={{width: 290, height: 290, borderRadius: 70, boxShadow: `0 0 0 10px ${INK}, 0 22px 0 10px ${DEEP}`}} />
      </div>
      <Burst f={frame} x={W / 2} y={720} />
      <Title text="BRAWLZONE BUBBLE" size={120} gold frame={frame} at={at(seg, 1, spb)} y={1000} glow="#0a4a2a" />
      {frame > at(seg, 1, spb) + 6 && <Chip text="FREE ON GOOGLE PLAY" color="#1d6a3a" size={66} x={W / 2} y={1150} rot={-3} scale={pop(frame, at(seg, 1, spb) + 6, 9, 2.2)} />}
      <SearchBar frame={frame} at={at(seg, 2, spb)} y={1320} text="BrawlZone Bubble" />
      <FollowButton frame={frame} at={at(seg, 3, spb)} y={1520} />
      {frame > at(seg, 3, spb) + 10 && <div style={{position: 'absolute', left: W / 2, top: 1660, transform: `translate(-50%,-50%) scale(${pop(frame, at(seg, 3, spb) + 10)})`}}>
        <Label text="COMMENT YOUR RANK" size={56} color="#fff6b0" /></div>}
      {[0, 1].map((i) => <Star key={i} size={80} color="#fff6b0" style={{position: 'absolute', left: i ? 900 : 90, top: 860 + 30 * Math.sin(t * 3 + i), transform: `rotate(${t * 70}deg)`}} />)}
      <Flare f={frame} y={720} color={GREEN} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- wrapper
/** Every scene: a small zoom punch on each caption, the progress bar, the caption on top. */
const withVoice = (Scene: React.FC<SceneProps>): React.FC<SceneProps> => (props) => {
  const fps = props.plan.fps;
  const chunks: any[] = props.seg.vo?.chunks || [];
  let since = 99;
  for (const c of chunks) if (props.frame >= c.t0 * fps) since = props.frame - c.t0 * fps;
  const punch = 1 + 0.03 * Math.max(0, 1 - since / 7);
  const num = (props.seg as any).num || 0;
  const len = props.seg.len * props.spb;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{transform: `scale(${punch})`}}><Scene {...props} /></AbsoluteFill>
      {(num > 0 || props.seg.kind === 'bp_take5') && <Progress num={num} u={props.frame / len} bonus={props.seg.kind === 'bp_take5'} />}
      <CaptionTrack seg={props.seg} frame={props.frame} fps={fps} />
    </AbsoluteFill>
  );
};

const SCENES: Record<string, React.FC<SceneProps>> = {bp_hook: Hook, bp_float: Float, bp_meta: Meta, bp_bans: Bans, bp_draft: Draft, bp_counters: Counters,
  bp_comps: Comps, bp_yours: Yours, bp_trophies: Trophies, bp_review: Review, bp_season: Season, bp_home: Home, bp_style: Style, bp_take5: Take5, bp_outro: Outro};
const VOICED = Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, withVoice(v)]));

export const BubblePromo: React.FC<{plan: Plan}> = ({plan}) => {
  // The app's body font (Nunito), only this video needs it.
  const [handle] = useState(() => delayRender('nunito'));
  useEffect(() => {
    new FontFace('Nunito', `url(${staticFile('fonts/nunito.woff2')})`, {weight: '200 1000'}).load()
      .then((f) => { document.fonts.add(f); }).catch(() => undefined).finally(() => continueRender(handle));
  }, [handle]);
  return <Stage plan={plan} scenes={VOICED} swipeInto={['bp_season', 'bp_home', 'bp_take5', 'bp_outro']} />;
};
