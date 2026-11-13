// The pieces every Remotion Short is built from (2026-11-13). Everything is
// drawn with gradients, transforms and solid shadows: the box has no GPU, and
// a CSS blur over a 1080x1920 frame costs ~2 s a frame there (measured), so
// glows are radial gradients and outlines are text-stroke + stacked shadows.
import React from 'react';
import {AbsoluteFill, Img, random, staticFile} from 'remotion';
import {DEEP, H, HEAD, BODY, INK, NAVY, W, alpha, clamp, mix, outBack, outCubic, shade} from './theme';

// ------------------------------------------------------------ background
export const Backdrop: React.FC<{color: string; t: number; rays?: number; cy?: number; dark?: boolean}> = ({
  color, t, rays = 0.55, cy = 960, dark = false,
}) => {
  const lit = mix(color, '#ffffff', 0.18);
  const mid = shade(color, dark ? 0.35 : 0.62);
  const edge = mix(shade(color, 0.22), NAVY, 0.45);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: `radial-gradient(130% 75% at 50% ${(cy / H) * 100}%, ${lit} 0%, ${mid} 38%, ${edge} 100%)`}}>
      {/* drifting colour pools */}
      <div style={{position: 'absolute', width: 1400, height: 1400, left: -500 + 160 * Math.sin(t * 0.35), top: -380 + 120 * Math.cos(t * 0.3),
        background: `radial-gradient(circle, ${alpha(mix(color, '#ff4fa3', 0.55), 0.45)} 0%, transparent 62%)`}} />
      <div style={{position: 'absolute', width: 1500, height: 1500, left: 200 + 140 * Math.cos(t * 0.27), top: 1000 + 160 * Math.sin(t * 0.33),
        background: `radial-gradient(circle, ${alpha(mix(color, '#36d6ff', 0.55), 0.4)} 0%, transparent 62%)`}} />
      {/* turning light rays behind the subject */}
      <div style={{position: 'absolute', width: 3000, height: 3000, left: W / 2 - 1500, top: cy - 1500, opacity: rays,
        transform: `rotate(${t * 9}deg)`,
        background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.16) 0deg 6deg, rgba(255,255,255,0) 6deg 18deg)',
        WebkitMaskImage: 'radial-gradient(circle, black 0%, rgba(0,0,0,0.6) 25%, transparent 55%)'}} />
      {/* slow diagonal light bands */}
      <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(118deg, rgba(255,255,255,0.045) 0 46px, transparent 46px 150px)',
        backgroundPosition: `${(t * 40) % 300}px 0`}} />
      {/* comic halftone top and bottom */}
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 560,
        backgroundImage: `radial-gradient(${alpha(DEEP, 0.38)} 32%, transparent 34%)`, backgroundSize: '28px 28px',
        WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)'}} />
      <div style={{position: 'absolute', left: 0, bottom: 0, width: W, height: 620,
        backgroundImage: `radial-gradient(${alpha(DEEP, 0.42)} 32%, transparent 34%)`, backgroundSize: '28px 28px', backgroundPosition: '14px 0',
        WebkitMaskImage: 'linear-gradient(to top, black, transparent)'}} />
      <Gems t={t} color={color} />
      <Sparkles t={t} />
      <AbsoluteFill style={{background: 'radial-gradient(85% 60% at 50% 48%, transparent 55%, rgba(0,0,0,0.5) 100%)'}} />
    </AbsoluteFill>
  );
};

// Faceted gems drifting at three depths: near ones big, fast and sharp, far
// ones small and faint, so the background has parallax.
const GEMS = Array.from({length: 11}, (_, i) => ({
  x: random(`gx${i}`) * W, y: random(`gy${i}`) * H, z: [0.45, 0.7, 1][i % 3], ph: random(`gp${i}`) * 6.28, hue: i % 3,
}));
export const Gems: React.FC<{t: number; color: string}> = ({t, color}) => (
  <>
    {GEMS.map((g, i) => {
      const size = 70 + 90 * g.z;
      const y = (((g.y - t * 60 * g.z) % (H + 300)) + H + 300) % (H + 300) - 150;
      const c = [mix(color, '#ffffff', 0.45), '#ffd23f', mix(color, '#36d6ff', 0.6)][g.hue];
      return (
        <svg key={i} width={size} height={size * 1.2} viewBox="0 0 100 120" style={{position: 'absolute', left: g.x + Math.sin(t * 0.8 + g.ph) * 40, top: y,
          opacity: 0.25 + 0.45 * g.z, transform: `rotate(${Math.sin(t * 0.9 + g.ph) * 25}deg) scaleX(${Math.cos(t * 1.4 + g.ph)})`}}>
          <path d="M50 4 L94 40 L50 116 L6 40 Z" fill={c} stroke={INK} strokeWidth="6" strokeLinejoin="round" />
          <path d="M6 40 L94 40 M30 40 L50 4 L70 40 L50 116 L30 40" fill="none" stroke={INK} strokeWidth="4" strokeLinejoin="round" opacity="0.55" />
          <path d="M50 4 L30 40 L50 40 Z" fill="rgba(255,255,255,0.55)" />
        </svg>
      );
    })}
  </>
);

/** A soft halo of `color` (a radial gradient, so free to draw). */
export const Halo: React.FC<{x: number; y: number; r: number; color: string; a?: number}> = ({x, y, r, color, a = 0.8}) => (
  <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%',
    background: `radial-gradient(circle, ${alpha(color, a)} 0%, ${alpha(color, a * 0.45)} 32%, transparent 68%)`}} />
);

/** A lens-flare streak across the frame and a bright core, on a hit. */
export const Flare: React.FC<{f: number; y: number; color?: string}> = ({f, y, color = '#ffffff'}) => {
  if (f < 0 || f > 16) return null;
  const k = f / 16;
  return (
    <>
      <div style={{position: 'absolute', left: -200, top: y - 40, width: W + 400, height: 80, opacity: 1 - k,
        background: `radial-gradient(50% 50% at 50% 50%, #ffffff 0%, ${alpha(color, 0.8)} 12%, transparent 70%)`, transform: `scaleY(${1 - k * 0.7})`}} />
      <div style={{position: 'absolute', left: W / 2 - 60, top: y - 60, width: 120, height: 120, borderRadius: '50%', opacity: 1 - k,
        background: 'radial-gradient(circle, #fff 0%, rgba(255,255,255,0.4) 40%, transparent 70%)', transform: `scale(${1 + k * 3})`}} />
    </>
  );
};

/** Anime speed lines from the edges toward a centre: pressure, last second. */
export const SpeedLines: React.FC<{t: number; a: number; cy?: number}> = ({t, a, cy = 1000}) => {
  if (a <= 0.01) return null;
  return (
    <div style={{position: 'absolute', left: W / 2 - 1600, top: cy - 1600, width: 3200, height: 3200, opacity: a,
      transform: `rotate(${Math.floor(t * 24) * 7}deg)`,
      background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.75) 0deg 0.6deg, transparent 0.6deg 7deg)',
      WebkitMaskImage: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.9) 38%, black 60%)'}} />
  );
};

const STAR = 'M50 0 L61 39 L100 50 L61 61 L50 100 L39 61 L0 50 L39 39 Z';
export const Star: React.FC<{size: number; color?: string; style?: React.CSSProperties}> = ({size, color = '#fff', style}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path d={STAR} fill={color} />
  </svg>
);

const SPARKS = Array.from({length: 22}, (_, i) => ({
  x: random(`sx${i}`) * W, y: random(`sy${i}`) * H, v: 18 + random(`sv${i}`) * 40, s: 18 + random(`ss${i}`) * 30, ph: random(`sp${i}`) * 6.28,
}));
export const Sparkles: React.FC<{t: number}> = ({t}) => (
  <>
    {SPARKS.map((p, i) => {
      const a = 0.5 + 0.5 * Math.sin(t * 2.4 + p.ph);
      if (a < 0.2) return null;
      const y = (((p.y - t * p.v) % H) + H) % H;
      return <Star key={i} size={p.s * (0.6 + 0.4 * a)} color="#fff"
        style={{position: 'absolute', left: p.x + Math.sin(t + p.ph) * 14, top: y, opacity: a * 0.9, transform: `rotate(${t * 40 + i * 20}deg)`}} />;
    })}
  </>
);

// ------------------------------------------------------------ type
const GOLD_FILL = 'linear-gradient(180deg, #fffbd0 0%, #ffe45a 38%, #ffb21e 70%, #ff8a10 100%)';
const fillFor = (color: string | undefined, gold: boolean) =>
  gold ? GOLD_FILL : `linear-gradient(180deg, #ffffff 0%, ${mix(color || '#ffffff', '#ffffff', 0.25)} 45%, ${color ? shade(color, 0.85) : '#dfe4ff'} 100%)`;

/** A 3D headline: an optional coloured sticker outline, a thick ink outline
 *  with a stepped extrude, a glossy gradient face; letters pop in one after
 *  another from `at` (frames). Drawn as three aligned rows (outlines, ink,
 *  faces) so no letter's outline covers its neighbour's face. */
export const Title: React.FC<{
  text: string; size: number; frame: number; at?: number; gold?: boolean; color?: string; stagger?: number;
  x?: number; y: number; maxWidth?: number; pop?: number; rot?: number; glow?: string;
}> = ({text, size, frame, at = 0, gold = false, color, stagger = 1.6, x = W / 2, y, maxWidth = W - 80, pop = 1, rot = 0, glow}) => {
  const est = text.length * size * 0.62;
  const s = est > maxWidth ? (size * maxWidth) / est : size;
  const stroke = Math.max(6, s * 0.15);
  const depth = Math.max(5, Math.round(s * 0.09));
  const shadow = [...Array(depth).keys()].map((k) => `0 ${k + 1}px 0 ${DEEP}`).join(',') + `, 0 ${depth + 8}px 14px rgba(0,0,0,0.35)`;
  const chars = [...text].map((ch, i) => {
    if (ch === ' ') return {ch, space: true, tf: '', hidden: false};
    const u = (frame - at - i * stagger) / 9;
    const k = outBack(u, 2.1);
    const tilt = (1 - outCubic(u)) * (i % 2 ? 22 : -22);
    return {ch, space: false, hidden: u <= 0, tf: `translateY(${(1 - k) * 70}px) scale(${0.2 + 0.8 * k}) rotate(${tilt}deg)`};
  });
  const row = (layer: 'glow' | 'ink' | 'face') => (
    <div style={{position: layer === 'ink' ? 'relative' : 'absolute', left: 0, top: 0, whiteSpace: 'nowrap'}}>
      {chars.map((c, i) => c.space ? <span key={i} style={{display: 'inline-block', width: s * 0.3}} /> : (
        <span key={i} style={{display: 'inline-block', opacity: c.hidden ? 0 : 1, transform: c.tf,
          ...(layer === 'glow' ? {color: glow, WebkitTextStroke: `${stroke * 2.3}px ${glow}`, paintOrder: 'stroke fill', textShadow: `0 ${depth + 4}px 0 ${shade(glow || '#000000', 0.5)}`}
            : layer === 'ink' ? {color: INK, WebkitTextStroke: `${stroke}px ${INK}`, paintOrder: 'stroke fill', textShadow: shadow}
            : {backgroundImage: fillFor(color, gold), WebkitBackgroundClip: 'text', color: 'transparent'})}}>{c.ch}</span>
      ))}
    </div>
  );
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${pop})`, whiteSpace: 'nowrap',
      fontFamily: HEAD, fontSize: s, lineHeight: 1, letterSpacing: s * 0.01}}>
      {glow && row('glow')}
      {row('ink')}
      {row('face')}
    </div>
  );
};

/** Small solid label text (chips, captions): outline, no extrude. */
export const Label: React.FC<{text: string; size: number; color?: string; stroke?: number; font?: string; style?: React.CSSProperties}> = ({
  text, size, color = '#fff', stroke, font = HEAD, style,
}) => (
  <span style={{fontFamily: font, fontSize: size, lineHeight: 1, color, WebkitTextStroke: `${stroke ?? Math.max(4, size * 0.14)}px ${INK}`,
    paintOrder: 'stroke fill', whiteSpace: 'nowrap', ...style}}>{text}</span>
);

export const Chip: React.FC<{text: string; color: string; size?: number; x: number; y: number; scale?: number; rot?: number; textColor?: string}> = ({
  text, color, size = 54, x, y, scale = 1, rot = 0, textColor = '#fff',
}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`,
    padding: `${size * 0.28}px ${size * 0.6}px ${size * 0.34}px`, borderRadius: 999,
    background: `linear-gradient(180deg, ${mix(color, '#fff', 0.35)} 0%, ${color} 50%, ${shade(color, 0.78)} 100%)`,
    boxShadow: `0 0 0 6px ${INK}, 0 10px 0 6px ${DEEP}, inset 0 4px 0 rgba(255,255,255,0.35)`}}>
    <Label text={text} size={size} color={textColor} />
  </div>
);

// ------------------------------------------------------------ cards
/** A holographic card: a spinning prism rim, ink outline and lip, a deep
 *  inside with a light sweep across it every beat. */
export const HoloCard: React.FC<{
  size: number; rim: string; t: number; beat: number; inner?: string; lit?: boolean; children?: React.ReactNode; radius?: number;
}> = ({size, rim, t, beat, inner = '#5f87ff', lit = false, children, radius = 70}) => {
  const sweep = ((beat % 1) * 1.6 - 0.3) * (size + 400) - 200;
  const prism = lit
    ? `conic-gradient(from ${t * 140}deg, #fff6b0, #ffb21e, #fff6b0, #ff8a10, #fff6b0)`
    : `conic-gradient(from ${t * 140}deg, ${rim}, #ffffff, ${rim}, ${mix(rim, '#36d6ff', 0.5)}, ${rim}, #ffffff, ${rim})`;
  return (
    <div style={{width: size, height: size, borderRadius: radius, padding: 14, background: prism,
      boxShadow: `0 0 0 9px ${INK}, 0 24px 0 9px ${DEEP}`}}>
      <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: radius - 14, overflow: 'hidden',
        background: `radial-gradient(90% 80% at 50% 38%, ${mix(inner, '#ffffff', 0.12)} 0%, ${shade(inner, 0.55)} 55%, ${mix(shade(inner, 0.25), NAVY, 0.4)} 100%)`}}>
        <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 22px, transparent 22px 64px)'}} />
        <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{children}</AbsoluteFill>
        <div style={{position: 'absolute', top: -200, left: sweep, width: 150, height: size + 400, transform: 'rotate(20deg)',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)'}} />
        <div style={{position: 'absolute', left: 16, right: 16, top: 12, height: size * 0.3, borderRadius: radius - 20,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0))'}} />
      </div>
    </div>
  );
};

/** The countdown: a ring draining around a number (or "?"). */
export const Ring: React.FC<{n: string; frac: number; color: string; size?: number; pulse?: number}> = ({n, frac, color, size = 210, pulse = 1}) => {
  const r = size / 2 - 22, c = 2 * Math.PI * r;
  return (
    <div style={{position: 'relative', width: size, height: size, transform: `scale(${pulse})`}}>
      <svg width={size} height={size} style={{position: 'absolute', left: 0, top: 0}}>
        <circle cx={size / 2} cy={size / 2 + 10} r={size / 2 - 6} fill={DEEP} />
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} fill={INK} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={18} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={18} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - clamp(frac))} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 10}}>
        <Label text={n} size={size * 0.52} color="#fff" />
      </div>
    </div>
  );
};

// ------------------------------------------------------------ hits
const BURST = Array.from({length: 26}, (_, i) => ({
  a: (i / 26) * Math.PI * 2 + random(`ba${i}`) * 0.4, d: 380 + random(`bd${i}`) * 420, s: 34 + random(`bs${i}`) * 40,
  c: ['#fff6b0', '#ffffff', '#ff5f8f', '#5fe0ff', '#ffd23f'][i % 5],
}));
/** A reveal's pop: a shockwave ring and glints flying off; f in frames since the hit. */
export const Burst: React.FC<{f: number; x: number; y: number; color?: string}> = ({f, x, y, color = '#fff6b0'}) => {
  if (f < 0 || f > 26) return null;
  const k = f / 26;
  const r = 140 + 760 * outCubic(k);
  return (
    <>
      <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%',
        border: `${Math.max(2, 34 * (1 - k))}px solid ${color}`, opacity: 1 - k}} />
      {BURST.map((p, i) => {
        const d = p.d * outCubic(k);
        return <Star key={i} size={p.s * (1 - k * 0.6)} color={p.c}
          style={{position: 'absolute', left: x + Math.cos(p.a) * d - p.s / 2, top: y + Math.sin(p.a) * d - p.s / 2 + 200 * k * k,
            opacity: 1 - k, transform: `rotate(${f * 18}deg)`}} />;
      })}
    </>
  );
};

const CONF = Array.from({length: 90}, (_, i) => ({
  x: random(`cx${i}`) * (W + 200) - 100, y: -100 - random(`cy${i}`) * 1400, v: 380 + random(`cv${i}`) * 420, sw: random(`cw${i}`) * 6.28,
  s: 16 + random(`cs${i}`) * 18, c: ['#ffd23f', '#ff5f8f', '#5fe0ff', '#ffffff', '#7cff8a', '#b77bff'][i % 6],
}));
export const Confetti: React.FC<{t: number}> = ({t}) => (
  <>
    {CONF.map((p, i) => {
      const y = p.y + p.v * t;
      if (y > H + 60 || y < -60) return null;
      return <div key={i} style={{position: 'absolute', left: p.x + Math.sin(t * 3 + p.sw) * 40, top: y, width: p.s, height: p.s * 0.55,
        background: p.c, borderRadius: 3, transform: `rotate(${t * 300 + i * 37}deg) scaleY(${Math.cos(t * 6 + p.sw)})`}} />;
    })}
  </>
);

// ------------------------------------------------------------ banners
// A headline in normal flow (no pop-in), for text inside bands and buttons.
export const InlineTitle: React.FC<{text: string; size: number; gold?: boolean; color?: string}> = ({text, size, gold, color}) => {
  const stroke = Math.max(6, size * 0.15);
  const depth = Math.max(5, Math.round(size * 0.08));
  const shadow = [...Array(depth).keys()].map((k) => `0 ${k + 1}px 0 ${DEEP}`).join(',');
  return (
    <span style={{position: 'relative', display: 'inline-block', fontFamily: HEAD, fontSize: size, lineHeight: 1, whiteSpace: 'nowrap'}}>
      <span style={{color: INK, WebkitTextStroke: `${stroke}px ${INK}`, textShadow: shadow, paintOrder: 'stroke fill'}}>{text}</span>
      <span style={{position: 'absolute', left: 0, top: 0, backgroundImage: fillFor(color, !!gold), WebkitBackgroundClip: 'text', color: 'transparent'}}>{text}</span>
    </span>
  );
};

export const Banner: React.FC<{text: string; color: string; size?: number; x?: number; y: number; frame: number; at?: number}> = ({
  text, color, size = 130, x = W / 2, y, frame, at = 0,
}) => {
  const u = (frame - at) / 10;
  if (u <= 0) return null;
  const k = outBack(u, 1.6);
  const est = text.length * size * 0.6;
  const s = est > 780 ? (size * 780) / est : size;
  const h = s * 1.3;
  const tail = (side: number) => (
    <div style={{position: 'absolute', top: h * 0.3, [side < 0 ? 'left' : 'right']: -h * 0.8, width: h * 1.2, height: h,
      background: `linear-gradient(180deg, ${shade(color, 0.7)}, ${shade(color, 0.5)})`, zIndex: -1,
      clipPath: side < 0 ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 32% 50%)' : 'polygon(0 0, 100% 0, 68% 50%, 100% 100%, 0 100%)'}} />
  );
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scaleX(${k}) scaleY(${0.5 + 0.5 * k})`, isolation: 'isolate'}}>
      {tail(-1)}{tail(1)}
      <div style={{position: 'relative', height: h, padding: `0 ${s * 0.5}px`, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(180deg, ${mix(color, '#fff', 0.4)} 0%, ${color} 46%, ${shade(color, 0.72)} 100%)`,
        boxShadow: `0 0 0 9px ${INK}, 0 16px 0 9px ${DEEP}, inset 0 7px 0 rgba(255,255,255,0.38)`}}>
        <InlineTitle text={text} size={s} />
      </div>
    </div>
  );
};

// ------------------------------------------------------------ calls to action
export const Logo: React.FC<{size: number}> = ({size}) => (
  <Img src={staticFile('app-icon.png')} style={{width: size, height: size, borderRadius: size * 0.24}} />
);

/** The address typed into a search box, the caret blinking, then the search
 *  button pressed: most people find the site by typing its name. */
export const SearchBar: React.FC<{text?: string; frame: number; at?: number; y: number; width?: number; height?: number; fps?: number}> = ({
  text = 'brawlzone.net', frame, at = 0, y, width = 940, height = 150, fps = 30,
}) => {
  const f = frame - at;
  if (f < 0) return null;
  const k = outBack(f / 10, 1.8);
  const n = Math.min(text.length, Math.max(0, Math.floor((f - 8) / 2.2)));
  const done = n >= text.length;
  const caret = !done || Math.floor(f / 9) % 2 === 0;
  const tap = done ? ((f - 8 - text.length * 2.2) % (fps * 1.6)) : -1;
  const press = tap >= 0 && tap < 6;
  return (
    <div style={{position: 'absolute', left: W / 2, top: y, transform: `translate(-50%, -50%) scale(${k * (press ? 0.97 : 1)})`}}>
      <div style={{position: 'relative', width, height, borderRadius: height / 2, background: 'linear-gradient(180deg, #ffffff, #eef1ff)',
        boxShadow: `0 0 0 8px ${INK}, 0 16px 0 8px ${DEEP}`, display: 'flex', alignItems: 'center', paddingLeft: height * 0.16}}>
        <Logo size={height * 0.66} />
        <span style={{marginLeft: height * 0.2, fontFamily: BODY, fontSize: height * 0.46, color: INK}}>{text.slice(0, n)}</span>
        {caret && <span style={{width: 7, height: height * 0.5, marginLeft: 4, background: '#2f7bff', borderRadius: 3}} />}
        <div style={{position: 'absolute', right: height * 0.11, top: height * 0.11, width: height * 0.78, height: height * 0.78, borderRadius: '50%',
          background: 'linear-gradient(180deg, #ffe45a, #ff9f1a)', boxShadow: `0 0 0 6px ${INK}, 0 7px 0 6px ${shade('#ff9f1a', 0.55)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <svg width={height * 0.46} height={height * 0.46} viewBox="0 0 100 100">
            <circle cx="42" cy="42" r="28" fill="none" stroke={INK} strokeWidth="13" />
            <line x1="63" y1="63" x2="90" y2="90" stroke={INK} strokeWidth="16" strokeLinecap="round" />
          </svg>
        </div>
        {tap >= 0 && tap < 22 && (
          <div style={{position: 'absolute', right: height * 0.5 - 30 - tap * 6, top: height / 2 - 30 - tap * 6, width: 60 + tap * 12, height: 60 + tap * 12,
            borderRadius: '50%', border: `8px solid rgba(255,255,255,${1 - tap / 22})`}} />
        )}
      </div>
    </div>
  );
};

/** The address at the top of every frame, as a small search box. */
export const BrandBug: React.FC<{y?: number}> = ({y = 200}) => (
  <div style={{position: 'absolute', left: W / 2, top: y, transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: 14,
    padding: '10px 14px 10px 12px', borderRadius: 999, background: 'linear-gradient(180deg,#ffffff,#e9edff)',
    boxShadow: `0 0 0 5px ${INK}, 0 9px 0 5px ${DEEP}`}}>
    <Logo size={56} />
    <span style={{fontFamily: BODY, fontSize: 44, color: INK, paddingRight: 8}}>brawlzone.net</span>
    <div style={{width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(180deg, #ffe45a, #ff9f1a)', boxShadow: `0 0 0 4px ${INK}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <svg width={30} height={30} viewBox="0 0 100 100">
        <circle cx="42" cy="42" r="28" fill="none" stroke={INK} strokeWidth="14" />
        <line x1="63" y1="63" x2="90" y2="90" stroke={INK} strokeWidth="17" strokeLinecap="round" />
      </svg>
    </div>
  </div>
);

export const FollowButton: React.FC<{frame: number; at?: number; y: number; fps?: number}> = ({frame, at = 0, y, fps = 30}) => {
  const f = frame - at;
  if (f < 0) return null;
  const k = outBack(f / 10, 2.2);
  const pulse = 1 + 0.05 * Math.abs(Math.sin((f / fps) * Math.PI * 2));
  const ring = (f % 24) / 24;
  return (
    <div style={{position: 'absolute', left: W / 2, top: y, transform: `translate(-50%, -50%) scale(${k * pulse})`}}>
      {f > 10 && <div style={{position: 'absolute', left: '50%', top: '50%', width: 520 + ring * 320, height: 170 + ring * 160,
        transform: 'translate(-50%, -50%)', borderRadius: 999, border: `8px solid rgba(255,255,255,${0.7 * (1 - ring)})`}} />}
      <div style={{display: 'flex', alignItems: 'center', gap: 24, padding: '20px 56px 24px 24px', borderRadius: 999,
        background: 'linear-gradient(180deg, #ff7a9a 0%, #ff345c 50%, #d81c48 100%)', boxShadow: `0 0 0 8px ${INK}, 0 14px 0 8px ${DEEP}, inset 0 6px 0 rgba(255,255,255,0.35)`}}>
        <div style={{width: 100, height: 100, borderRadius: '50%', background: '#fff', boxShadow: `0 0 0 6px ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <svg width={56} height={56} viewBox="0 0 10 10"><path d="M4 0h2v4h4v2H6v4H4V6H0V4h4z" fill="#ff345c" /></svg>
        </div>
        <InlineTitle text="FOLLOW" size={92} />
      </div>
    </div>
  );
};

// ------------------------------------------------------------ transitions
/** Two diagonal bands that sweep across a cut; p from 0 to 1 across it. */
export const Swipe: React.FC<{p: number; color?: string}> = ({p, color = '#ffd23f'}) => {
  if (p <= 0 || p >= 1) return null;
  const x = -1900 + p * 3800;
  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
      <div style={{position: 'absolute', top: -400, left: x - 260, width: 1700, height: H + 800, transform: 'skewX(-16deg)',
        background: `linear-gradient(90deg, ${shade(color, 0.7)}, ${color})`, boxShadow: `0 0 0 14px ${INK}`}} />
      <div style={{position: 'absolute', top: -400, left: x + 120, width: 1300, height: H + 800, transform: 'skewX(-16deg)',
        background: `linear-gradient(90deg, #ff4f86, #ff2f6a)`, boxShadow: `0 0 0 14px ${INK}`,
        backgroundImage: `radial-gradient(rgba(0,0,0,0.18) 30%, transparent 33%), linear-gradient(90deg, #ff4f86, #ff2f6a)`, backgroundSize: '26px 26px, 100% 100%'}} />
      <div style={{position: 'absolute', top: H / 2 - 130, left: x + 560, transform: 'skewX(-16deg)'}}>
        <Logo size={260} />
      </div>
    </AbsoluteFill>
  );
};

export const Art: React.FC<{src: string; size: number; style?: React.CSSProperties}> = ({src, size, style}) => (
  <Img src={staticFile(src)} style={{maxWidth: size, maxHeight: size, objectFit: 'contain', ...style}} />
);

export const Arrow: React.FC<{x: number; y: number; color?: string; size?: number}> = ({x, y, color = '#ffd23f', size = 200}) => (
  <svg width={size} height={size * 1.15} viewBox="0 0 100 115" style={{position: 'absolute', left: x - size / 2, top: y - size * 0.57}}>
    <path d="M32 4 H68 V58 H94 L50 110 L6 58 H32 Z" fill={color} stroke={INK} strokeWidth="7" strokeLinejoin="round" />
    <path d="M38 10 H62 V62 H80 L50 98" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="5" strokeLinejoin="round" />
  </svg>
);

export const Crown: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size * 0.8} viewBox="0 0 120 96">
    <defs>
      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff6b0" /><stop offset="0.5" stopColor="#ffd23f" /><stop offset="1" stopColor="#ff8a10" />
      </linearGradient>
    </defs>
    <path d="M8 84 L8 30 L34 52 L60 8 L86 52 L112 30 L112 84 Z" fill="url(#cg)" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
    <rect x="8" y="70" width="104" height="18" rx="4" fill="#ffe45a" stroke={INK} strokeWidth="6" />
    {[[8, 30], [60, 8], [112, 30]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r="9" fill="#ff3c64" stroke={INK} strokeWidth="5" />)}
  </svg>
);
