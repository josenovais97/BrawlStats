// The app film's kit (2026-11-25, v2): a studio, a phone with a body, a
// headline, and interface cards that lift off the glass. Every time in here is
// in thirtieths of a second whatever the film's frame rate, so the same
// numbers play at 30 and at 60 frames a second.
import React from 'react';
import {AbsoluteFill, Img, random, staticFile} from 'remotion';
import {BODY, H, HEAD, INK, W, alpha, clamp, mix, outCubic} from './theme';

export const APP = {bg: '#0A1233', surface: '#1A2759', surface2: '#22316C', surface3: '#2C3E86', border: '#33468F', fg: '#EEF1FA',
  muted: '#A9B6E0', gold: '#FFC53D', win: '#35D07F', loss: '#FF4F64', violet: '#8B6BFF', cyan: '#35d0ff'};
export const CX = W / 2;
export const GOLD = '#FFD45E';

export type P = {seg: any; plan: any; frame: number; dur: number; t: number; spb: number};
export const ease = (a: number, b: number, u: number) => a + (b - a) * outCubic(clamp(u));
export const num = ease;
export const inOut = (u: number) => { const x = clamp(u); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** A spring that settles: 0 at f=0, ~1 after `len`, a touch of overshoot. */
export const sp = (f: number, len = 16, over = 0.9) => {
  if (f <= 0) return 0;
  const x = f / len;
  return 1 - Math.exp(-5.2 * x) * (Math.cos(5.4 * x * over) + 0.35 * Math.sin(5.4 * x * over));
};
export const hit = (seg: any, i: number, spb: number) => (seg.hits?.[i] ?? 0) * spb;
/** A knock on the camera: 0 except just after `f` = 0. */
export const knock = (f: number, len = 10) => (f < 0 || f > len ? 0 : Math.sin(f * 2.4) * (1 - f / len));

// ------------------------------------------------------------------ the studio
const STAR = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><g fill='none' stroke='white' stroke-width='5' stroke-linejoin='round' opacity='0.9'><path d='M38 18 L45 33 L61 35 L49 46 L52 62 L38 54 L24 62 L27 46 L15 35 L31 33 Z'/><circle cx='112' cy='112' r='15'/><path d='M103 112 h18 M112 103 v18'/></g></svg>\")";
/** A dark studio: the game's own pattern on the wall, two soft lights, a floor that catches them, dust. */
export const Studio: React.FC<{color: string; t: number; cy?: number; floor?: number; power?: number}> = ({color, t, cy = 1020, floor = 1560, power = 1}) => (
  <AbsoluteFill style={{background: `radial-gradient(130% 70% at 50% 34%, ${mix('#0b1230', color, 0.26 * power)} 0%, #080c20 52%, #03040a 100%)`, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: -200, backgroundImage: STAR, backgroundSize: '150px 150px', opacity: 0.035, transform: `rotate(-14deg) translate(${(t * 16) % 150}px, ${(-t * 11) % 150}px)`}} />
    <div style={{position: 'absolute', left: CX - 900, top: cy - 900, width: 1800, height: 1800, background: `radial-gradient(circle, ${alpha(color, 0.5 * power)} 0%, ${alpha(color, 0.16 * power)} 32%, rgba(0,0,0,0) 62%)`}} />
    {[-1, 1].map((side) => (
      <div key={side} style={{position: 'absolute', left: CX + side * (620 + 40 * Math.sin(t * 0.4)) - 230, top: -340, width: 460, height: 2300, transform: `rotate(${side * (17 + 2 * Math.sin(t * 0.5 + side))}deg)`,
        background: `linear-gradient(180deg, ${alpha(mix(color, '#ffffff', 0.35), 0.3 * power)} 0%, ${alpha(color, 0.08 * power)} 52%, rgba(0,0,0,0) 80%)`, clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)'}} />
    ))}
    <div style={{position: 'absolute', left: -300, top: floor, width: W + 600, height: H - floor + 40, background: `linear-gradient(180deg, ${alpha(color, 0.2 * power)} 0%, rgba(3,4,10,0.96) 62%)`}} />
    <div style={{position: 'absolute', left: -80, top: floor - 1.5, width: W + 160, height: 3, background: `linear-gradient(90deg, rgba(0,0,0,0), ${alpha(mix(color, '#ffffff', 0.4), 0.8 * power)}, rgba(0,0,0,0))`}} />
    <div style={{position: 'absolute', left: CX - 620, top: floor - 60, width: 1240, height: 300, background: `radial-gradient(50% 50% at 50% 30%, ${alpha(color, 0.38 * power)} 0%, rgba(0,0,0,0) 100%)`}} />
    {[...Array(22).keys()].map((i) => {
      const r = random(`kd${i}`), big = i % 7 === 0, s = big ? 46 + random(`ks${i}`) * 60 : 3 + random(`ks${i}`) * 6;
      const y = ((random(`ky${i}`) * 2100 - t * (big ? 60 : 22 + r * 44)) % 2100 + 2100) % 2100 - 60;
      const x = random(`kx${i}`) * W + (big ? 70 : 36) * Math.sin(t * 0.6 + i * 1.7);
      return <div key={i} style={{position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%',
        background: big ? `radial-gradient(circle, ${alpha(mix(color, '#ffffff', 0.5), 0.2)} 0%, rgba(0,0,0,0) 68%)` : i % 3 ? '#ffffff' : color,
        opacity: big ? 1 : 0.1 + 0.3 * random(`ko${i}`) * (0.6 + 0.4 * Math.sin(t * 2 + i))}} />;
    })}
  </AbsoluteFill>
);

/** The corners fall away, over everything. */
export const Vignette: React.FC = () => (
  <AbsoluteFill style={{background: 'radial-gradient(86% 64% at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.5) 100%)', pointerEvents: 'none'}} />
);

export const Glow: React.FC<{x: number; y: number; r: number; color: string; a?: number}> = ({x, y, r, color, a = 0.6}) => (
  <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, background: `radial-gradient(circle, ${alpha(color, a)} 0%, ${alpha(color, a * 0.35)} 35%, rgba(0,0,0,0) 68%)`, pointerEvents: 'none'}} />
);
export const Shock: React.FC<{x: number; y: number; f: number; r?: number; color?: string; len?: number}> = ({x, y, f, r = 620, color = '#fff', len = 18}) => {
  if (f < 0 || f > len) return null;
  const u = outCubic(f / len);
  return <div style={{position: 'absolute', left: x - r * u, top: y - r * u, width: 2 * r * u, height: 2 * r * u, borderRadius: '50%', border: `${30 * (1 - u) + 1}px solid ${alpha(color, 0.85 * (1 - u))}`}} />;
};
export const Sparks: React.FC<{x: number; y: number; f: number; n?: number; color?: string; r?: number; len?: number}> = ({x, y, f, n = 18, color = GOLD, r = 420, len = 24}) => {
  if (f < 0 || f > len) return null;
  const u = f / len;
  return (
    <>
      {[...Array(n).keys()].map((i) => {
        const a = (i / n) * Math.PI * 2 + random(`a${i}`) * 0.5;
        const d = r * (0.4 + 0.6 * random(`l${i}`)) * outCubic(u);
        const s = (9 + 15 * random(`z${i}`)) * (1 - u);
        const stretch = 1 + 3.2 * (1 - u);
        return <div key={i} style={{position: 'absolute', left: x + Math.cos(a) * d - s / 2, top: y + Math.sin(a) * d + 110 * u * u - s / 2, width: s * stretch, height: s, borderRadius: s, background: i % 3 ? color : '#fff', transform: `rotate(${a * 57.3}deg)`, opacity: 1 - u}} />;
      })}
    </>
  );
};
export const Flash: React.FC<{f: number; len?: number; color?: string; a?: number}> = ({f, len = 7, color = '#fff', a = 0.8}) =>
  f >= 0 && f < len ? <AbsoluteFill style={{background: color, opacity: a * (1 - f / len)}} /> : null;

// ---------------------------------------------------------------- the headline
/** The line being said: one or two lines of clean type, each word tipping up as it is spoken. */
export const Say: React.FC<{seg: any; frame: number; y?: number; max?: number}> = ({seg, frame, y = 330, max = 150}) => {
  const words: any[] = (seg.vo?.chunks || []).flatMap((c: any) => c.words.map((w: any) => ({...w, t: w.t ?? c.t0})));
  if (!words.length) return null;
  const pages: any[][] = [[]];
  words.forEach((w, i) => {
    pages[pages.length - 1].push({...w, text: w.w.replace(/[,.:]$/, '')});
    if (/[,.?!:]$/.test(w.w) && i < words.length - 1) pages.push([]);
  });
  let n = 0;
  pages.forEach((pg, i) => { if (frame >= pg[0].t * 30 - 3) n = i; });
  const page = pages[n];
  const all = page.map((w) => w.text).join(' ');
  let cut = page.length;
  if (all.length > 14 && page.length > 1) {
    let best = 1e9;
    for (let i = 1; i < page.length; i++) {
      const l = page.slice(0, i).map((w) => w.text).join(' ').length, r = page.slice(i).map((w) => w.text).join(' ').length;
      if (Math.max(l, r) < best) { best = Math.max(l, r); cut = i; }
    }
  }
  const lines = [page.slice(0, cut), page.slice(cut)].filter((l) => l.length);
  const widest = Math.max(...lines.map((l) => l.map((w) => w.text).join(' ').length));
  const size = Math.min(lines.length > 1 ? max * 0.87 : max, 968 / Math.max(5, widest * 0.56));
  return (
    <div style={{position: 'absolute', left: 0, width: W, top: y, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.03, perspective: 900, zIndex: 50}}>
      {lines.map((line, li) => (
        <div key={li} style={{fontFamily: HEAD, fontSize: size, lineHeight: 1.06, whiteSpace: 'nowrap', display: 'flex', gap: size * 0.24}}>
          {line.map((w, j) => {
            const k = sp(frame - w.t * 30 + 3, 11, 0.8);
            return (
              <span key={j} style={{display: 'inline-block', color: w.hi ? GOLD : '#fff', opacity: clamp(k * 1.8), transformOrigin: '50% 100%',
                transform: `translateY(${0.34 * size * (1 - k)}px) rotateX(${-64 * (1 - k)}deg) scale(${0.92 + 0.08 * k})`,
                WebkitTextStroke: `${size * 0.075}px ${INK}`, paintOrder: 'stroke fill',
                textShadow: w.hi ? `0 ${size * 0.05}px 0 #7a4b00, 0 0 ${size * 0.5}px rgba(255,197,61,0.45), 0 ${size * 0.14}px ${size * 0.34}px rgba(0,0,0,0.65)` : `0 ${size * 0.05}px 0 #1b2350, 0 ${size * 0.14}px ${size * 0.34}px rgba(0,0,0,0.65)`}}>{w.text}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** A glass label: what the numbers are from. */
export const Pill: React.FC<{text: string; y: number; k?: number; icon?: string; x?: number; color?: string; size?: number}> = ({text, y, k = 1, icon, x = CX, color = '#fff', size = 36}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * k})`, opacity: clamp(k * 2), display: 'flex', alignItems: 'center', gap: 14, padding: `${size * 0.32}px ${size * 0.74}px ${size * 0.38}px`, borderRadius: 999, zIndex: 40,
    background: 'linear-gradient(180deg, rgba(44,62,134,0.72), rgba(14,20,52,0.82))', boxShadow: `inset 0 2px 0 rgba(255,255,255,0.28), 0 0 0 2px rgba(255,255,255,0.14), 0 14px 34px rgba(0,0,0,0.5)`, whiteSpace: 'nowrap'}}>
    {icon && <Img src={staticFile(icon)} style={{height: size * 1.25}} />}
    <span style={{fontFamily: BODY, fontSize: size, letterSpacing: 1, color}}>{text}</span>
  </div>
);

// ------------------------------------------------------------------- the phone
/** A phone with a body: a stack of plates for its side, a screen on the front, and what floats over the glass (`above`, in screen pixels). */
export const Device: React.FC<{w: number; h: number; x?: number; y?: number; rx?: number; ry?: number; rz?: number; s?: number; light?: number; persp?: number; above?: React.ReactNode; children: React.ReactNode}> = ({
  w, h, x = CX, y = 1060, rx = 0, ry = 0, rz = 0, s = 1, light = 0.6, persp = 2300, above, children,
}) => {
  const bz = Math.round(Math.min(w, h) * 0.024) + 5, r = Math.min(w, h) * 0.125, T = Math.min(w, h) * 0.075, N = 9;
  const W0 = w + bz * 2, H0 = h + bz * 2;
  const tall = h > w;
  return (
    <div style={{position: 'absolute', left: x - W0 / 2, top: y - H0 / 2, width: W0, height: H0, perspective: persp}}>
      <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`}}>
        <div style={{position: 'absolute', inset: 10, borderRadius: r + bz, transform: `translateZ(${-T - 30}px) translateY(34px)`, boxShadow: '0 70px 130px 10px rgba(0,0,0,0.75), 0 20px 50px rgba(0,0,0,0.6)'}} />
        {[...Array(N).keys()].map((i) => {
          const u = i / (N - 1), edge = Math.abs(u - 0.5) * 2;
          const c = mix('#c8d2ee', '#39425f', edge);
          return <div key={i} style={{position: 'absolute', inset: 0, borderRadius: r + bz, transform: `translateZ(${-T * (1 - u)}px)`,
            background: i === N - 1 ? 'linear-gradient(140deg, #7c86a6 0%, #1a1e2d 26%, #0b0d15 60%, #565f7c 100%)' : `linear-gradient(${120 + ry * 2}deg, ${c} 0%, ${mix(c, '#0b0d15', 0.62)} 40%, ${mix(c, '#0b0d15', 0.75)} 62%, ${c} 100%)`}} />;
        })}
        {/* buttons on the side */}
        {tall && [0.2, 0.3].map((f, i) => <div key={i} style={{position: 'absolute', right: -5, top: H0 * f, width: 8, height: H0 * (i ? 0.1 : 0.06), borderRadius: 4, background: '#8d97b6', transform: `translateZ(${-T / 2}px)`}} />)}
        <div style={{position: 'absolute', inset: bz - 6, borderRadius: r + 6, background: '#010206', transform: 'translateZ(0.5px)'}} />
        <div style={{position: 'absolute', left: bz, top: bz, width: w, height: h, borderRadius: r, overflow: 'hidden', background: '#000', transform: 'translateZ(1px)'}}>
          {children}
          <div style={{position: 'absolute', inset: 0, background: `linear-gradient(${112 + ry * 1.6}deg, rgba(255,255,255,${0.2 * light}) 0%, rgba(255,255,255,${0.04 * light}) 24%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 74%, rgba(255,255,255,${0.09 * light}) 100%)`, pointerEvents: 'none'}} />
          <div style={{position: 'absolute', inset: 0, borderRadius: r, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.1), inset 0 0 40px rgba(0,0,0,0.35)', pointerEvents: 'none'}} />
        </div>
        {above && <div style={{position: 'absolute', left: bz, top: bz, width: w, height: h, transformStyle: 'preserve-3d', transform: 'translateZ(2px)'}}>{above}</div>}
      </div>
    </div>
  );
};

/** A piece of a screen, as a card of its own: `box` is [x, y, w, h] in the picture's pixels, `iw` the picture's width. */
export const Piece: React.FC<{src: string; iw: number; box: number[]; w: number; r?: number; style?: React.CSSProperties; rim?: string}> = ({src, iw, box, w, r = 24, style, rim = 'rgba(255,255,255,0.22)'}) => {
  const k = w / box[2];
  return (
    <div style={{position: 'absolute', width: w, height: box[3] * k, borderRadius: r, overflow: 'hidden', boxShadow: `0 0 0 3px ${INK}, 0 0 0 5px ${rim}, 0 30px 60px rgba(0,0,0,0.6)`, ...style}}>
      <Img src={src} style={{position: 'absolute', left: -box[0] * k, top: -box[1] * k, width: iw * k, maxWidth: 'none'}} />
    </div>
  );
};

/** One card lifted off a phone's glass; the hole it left is dark. All in the phone's screen pixels. */
export const Lift: React.FC<{src: string; iw: number; box: number[]; sw: number; scroll?: number; z: number; dx?: number; dy?: number; grow?: number; r?: number; k: number}> = ({src, iw, box, sw, scroll = 0, z, dx = 0, dy = 0, grow = 0, r = 18, k}) => {
  const m = sw / iw, u = clamp(k);
  const l = box[0] * m, t = box[1] * m - scroll, w = box[2] * m, h = box[3] * m;
  return (
    <>
      <div style={{position: 'absolute', left: l, top: t, width: w, height: h, borderRadius: r, background: `rgba(3,5,16,${0.82 * u})`}} />
      <div style={{position: 'absolute', left: l + 8, top: t + 18, width: w - 16, height: h - 8, borderRadius: r, transform: `translateZ(${z * 0.25 * u}px)`, boxShadow: `0 ${40 * u}px ${80 * u}px rgba(0,0,0,${0.6 * u})`}} />
      <div style={{position: 'absolute', left: l, top: t, width: w, height: h, borderRadius: r, overflow: 'hidden', transform: `translate3d(${dx * u}px, ${dy * u}px, ${z * k}px) scale(${1 + grow * u})`,
        boxShadow: u > 0.02 ? `0 0 0 2px rgba(255,255,255,${0.3 * u}), 0 10px 30px rgba(0,0,0,0.5)` : 'none'}}>
        <Img src={src} style={{position: 'absolute', left: -l, top: -box[1] * m, width: sw, maxWidth: 'none'}} />
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 60%)', transform: `translateX(${-130 + 260 * clamp(k)}%)`}} />
      </div>
    </>
  );
};

/** A finger. */
export const Touch: React.FC<{x: number; y: number; f: number; r?: number}> = ({x, y, f, r = 36}) => {
  if (f < -7 || f > 18) return null;
  const on = f >= 0 && f <= 4, u = clamp((f - 4) / 14);
  return (
    <>
      <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: `rgba(255,255,255,${on ? 0.65 : 0.5 * (1 - u) * (f < 0 ? (f + 7) / 7 : 1)})`,
        boxShadow: '0 6px 18px rgba(0,0,0,0.4), inset 0 0 0 4px rgba(255,255,255,0.5)', transform: `scale(${f < 0 ? 1.5 - 0.5 * ((f + 7) / 7) : on ? 0.9 : 1})`}} />
      {f > 2 && <div style={{position: 'absolute', left: x - r - 70 * u, top: y - r - 70 * u, width: (r + 70 * u) * 2, height: (r + 70 * u) * 2, borderRadius: '50%', border: `5px solid rgba(255,255,255,${0.9 * (1 - u)})`}} />}
    </>
  );
};

// the rings the Bubble Pass unlocks (app Rings.kt)
export const RINGS: Record<string, string[]> = {
  gold: ['#FFE37A', '#FFC53D', '#FFAB00', '#FFE37A'], ember: ['#FF5C2A', '#FFB13D', '#FF2E63', '#FF5C2A'], frost: ['#9BE8FF', '#FFFFFF', '#4FB8FF', '#9BE8FF'],
  toxic: ['#7CFF4F', '#B44DFF', '#7CFF4F', '#B44DFF', '#7CFF4F'], galaxy: ['#7A5CFF', '#FF5CE1', '#4FD8FF', '#7A5CFF'], lava: ['#FF3D00', '#FFB300', '#FF1744', '#FF3D00'],
  rainbow: ['#FF5C5C', '#FFC53D', '#5CFF8A', '#4FB8FF', '#B45CFF', '#FF5C5C'],
};
/** The bubble, as the app draws it: the player's face in a turning ring. */
export const Orb: React.FC<{src: string; x: number; y: number; d: number; ring?: string; t?: number; press?: number; glow?: number; rot?: number}> = ({src, x, y, d, ring = 'gold', t = 0, press = 0, glow = 0.5, rot = 0}) => {
  const c = RINGS[ring] || RINGS.gold, band = d * 0.085;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0, transform: `scale(${1 - 0.12 * press}) rotate(${rot}deg)`}}>
      {glow > 0 && <Glow x={0} y={0} r={d * 1.15} color={c[0]} a={glow} />}
      <div style={{position: 'absolute', left: -d / 2 - band, top: -d / 2 - band, width: d + band * 2, height: d + band * 2, borderRadius: '50%', background: `conic-gradient(from ${t * 90}deg, ${c.join(',')})`,
        boxShadow: `0 0 0 ${d * 0.03}px ${INK}, 0 ${d * 0.1}px ${d * 0.24}px rgba(0,0,0,0.55)`}} />
      <div style={{position: 'absolute', left: -d / 2 - d * 0.012, top: -d / 2 - d * 0.012, width: d * 1.024, height: d * 1.024, borderRadius: '50%', background: INK}} />
      <div style={{position: 'absolute', left: -d / 2, top: -d / 2, width: d, height: d, borderRadius: '50%', overflow: 'hidden', background: APP.surface2}}>
        <Img src={staticFile(src)} style={{width: d, height: d}} />
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(150deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 38%)'}} />
      </div>
    </div>
  );
};
