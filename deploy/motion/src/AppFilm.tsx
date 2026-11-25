// BrawlZone Bubble, the film (2026-11-25, owner: "new footage on the new app...
// a really nice video and professional"). Not a feature list like BubblePromo:
// one Ranked game, from the draft to the recap, shot like a product film --
// a dark stage, one light per scene, a camera that never stops, the real
// panel on a real phone. What it says is real: the bans, the odds, the
// counters, the scoreboard and the season card are the site's own answers
// (deploy/viral/app-film-capture.js and film.json), redrawn where they move.
import React from 'react';
import {AbsoluteFill, Img, Sequence, random, staticFile, useCurrentFrame} from 'remotion';
import {BODY, DEEP, H, HEAD, INK, Plan, Segment, W, alpha, clamp, mix, outBack, outCubic} from './theme';

const APP = {bg: '#0A1233', surface: '#1A2759', surface2: '#22316C', surface3: '#2C3E86', border: '#33468F', borderStrong: '#4A62B8', fg: '#EEF1FA',
  muted: '#A9B6E0', gold: '#FFC53D', win: '#35D07F', loss: '#FF4F64', violet: '#8B6BFF', cyan: '#35d0ff'};
const CX = W / 2;
const GOLD = '#FFD45E';

type P = {seg: any; plan: any; frame: number; dur: number; t: number; spb: number};
const ease = (a: number, b: number, u: number) => a + (b - a) * outCubic(clamp(u));
/** A spring that settles: 0 at f=0, ~1 after `len` frames, a touch of overshoot. */
const sp = (f: number, len = 16, over = 0.9) => {
  if (f <= 0) return 0;
  const x = f / len;
  return 1 - Math.exp(-5.2 * x) * (Math.cos(5.4 * x * over) + 0.35 * Math.sin(5.4 * x * over));
};
const hit = (seg: any, i: number, spb: number) => Math.round((seg.hits?.[i] ?? 0) * spb);
const num = (a: number, b: number, u: number) => a + (b - a) * outCubic(clamp(u));

// ------------------------------------------------------------------ the stage
/** The set: a dark room, a floor, one coloured light, dust in the beam. */
const Set: React.FC<{color: string; t: number; cy?: number; floor?: number}> = ({color, t, cy = 1000, floor = 1500}) => (
  <AbsoluteFill style={{background: `radial-gradient(120% 80% at 50% 22%, ${mix('#0a1026', color, 0.2)} 0%, #070a1a 55%, #04050d 100%)`, overflow: 'hidden'}}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{position: 'absolute', left: CX - 260 + (i - 1) * 420 + 60 * Math.sin(t * 0.5 + i * 2), top: -300, width: 520, height: 2100, transformOrigin: '50% 0',
        transform: `rotate(${(i - 1) * 17 + 5 * Math.sin(t * 0.45 + i)}deg)`,
        background: `linear-gradient(180deg, ${alpha(color, i === 1 ? 0.34 : 0.2)} 0%, ${alpha(color, 0.06)} 55%, rgba(0,0,0,0) 85%)`, clipPath: 'polygon(44% 0, 56% 0, 100% 100%, 0 100%)'}} />
    ))}
    <div style={{position: 'absolute', left: CX - 800, top: cy - 800, width: 1600, height: 1600, background: `radial-gradient(circle, ${alpha(color, 0.42)} 0%, ${alpha(color, 0.12)} 34%, rgba(0,0,0,0) 62%)`}} />
    <div style={{position: 'absolute', left: -200, top: floor, width: W + 400, height: H - floor, background: `linear-gradient(180deg, ${alpha(color, 0.16)} 0%, rgba(4,5,13,0.95) 70%)`}} />
    <div style={{position: 'absolute', left: -60, top: floor - 2, width: W + 120, height: 4, background: `linear-gradient(90deg, rgba(0,0,0,0), ${alpha(color, 0.75)}, rgba(0,0,0,0))`}} />
    {[...Array(26).keys()].map((i) => {
      const r = random(`d${i}`), s = 3 + random(`s${i}`) * 7;
      const y = ((random(`y${i}`) * 2000 - t * (24 + r * 46)) % 2000 + 2000) % 2000;
      const x = random(`x${i}`) * W + 40 * Math.sin(t * 0.7 + i * 1.7);
      return <div key={i} style={{position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', background: i % 3 ? '#ffffff' : color, opacity: 0.1 + 0.28 * random(`o${i}`) * (0.6 + 0.4 * Math.sin(t * 2 + i))}} />;
    })}
  </AbsoluteFill>
);

/** A soft light that a thing stands in. */
const Glow: React.FC<{x: number; y: number; r: number; color: string; a?: number}> = ({x, y, r, color, a = 0.6}) => (
  <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, background: `radial-gradient(circle, ${alpha(color, a)} 0%, ${alpha(color, a * 0.35)} 35%, rgba(0,0,0,0) 68%)`, pointerEvents: 'none'}} />
);

/** A ring of light running outwards; f since it starts. */
const Shock: React.FC<{x: number; y: number; f: number; r?: number; color?: string; len?: number}> = ({x, y, f, r = 620, color = '#fff', len = 18}) => {
  if (f < 0 || f > len) return null;
  const u = outCubic(f / len);
  return <div style={{position: 'absolute', left: x - r * u, top: y - r * u, width: 2 * r * u, height: 2 * r * u, borderRadius: '50%', border: `${26 * (1 - u) + 2}px solid ${alpha(color, 0.85 * (1 - u))}`}} />;
};

/** Sparks thrown from a point. */
const Sparks: React.FC<{x: number; y: number; f: number; n?: number; color?: string; r?: number}> = ({x, y, f, n = 16, color = GOLD, r = 420}) => {
  if (f < 0 || f > 22) return null;
  const u = f / 22;
  return (
    <>
      {[...Array(n).keys()].map((i) => {
        const a = (i / n) * Math.PI * 2 + random(`a${i}`) * 0.5;
        const d = r * (0.45 + 0.55 * random(`l${i}`)) * outCubic(u);
        const s = (10 + 14 * random(`z${i}`)) * (1 - u);
        return <div key={i} style={{position: 'absolute', left: x + Math.cos(a) * d - s / 2, top: y + Math.sin(a) * d + 90 * u * u - s / 2, width: s, height: s, borderRadius: 3, background: i % 3 ? color : '#fff', transform: `rotate(${a * 57 + f * 14}deg)`, opacity: 1 - u}} />;
      })}
    </>
  );
};

const Flash: React.FC<{f: number; len?: number; color?: string; a?: number}> = ({f, len = 7, color = '#fff', a = 0.8}) =>
  f >= 0 && f < len ? <AbsoluteFill style={{background: color, opacity: a * (1 - f / len)}} /> : null;

/** The line being said: the whole phrase on one or two lines, each word landing as it is spoken. */
const Say: React.FC<{seg: any; frame: number; fps: number; y?: number}> = ({seg, frame, fps, y = 372}) => {
  const words: any[] = (seg.vo?.chunks || []).flatMap((c: any) => c.words.map((w: any) => ({...w, t: w.t ?? c.t0})));
  if (!words.length) return null;
  // A phrase ends at its punctuation; the next one replaces it.
  const pages: any[][] = [[]];
  words.forEach((w, i) => {
    pages[pages.length - 1].push({...w, text: w.w.replace(/[,.:]$/, '')});
    if (/[,.?!:]$/.test(w.w) && i < words.length - 1) pages.push([]);
  });
  let n = 0;
  pages.forEach((pg, i) => { if (frame >= pg[0].t * fps - 2) n = i; });
  const page = pages[n];
  const all = page.map((w) => w.text).join(' ');
  // Two lines as even as the words allow once it is long.
  let cut = page.length;
  if (all.length > 15 && page.length > 2) {
    let best = 1e9;
    for (let i = 1; i < page.length; i++) {
      const l = page.slice(0, i).map((w) => w.text).join(' ').length, r = page.slice(i).map((w) => w.text).join(' ').length;
      if (Math.max(l, r) < best) { best = Math.max(l, r); cut = i; }
    }
  }
  const lines = [page.slice(0, cut), page.slice(cut)].filter((l) => l.length);
  const widest = Math.max(...lines.map((l) => l.map((w) => w.text).join(' ').length));
  const size = Math.min(lines.length > 1 ? 112 : 132, 980 / Math.max(5.6, widest * 0.565));
  const f0 = frame - page[0].t * fps;
  return (
    <div style={{position: 'absolute', left: 0, width: W, top: y, transform: `translateY(-50%) translateY(${-26 * (1 - sp(f0 + 3, 10))}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.06}}>
      {lines.map((line, li) => (
        <div key={li} style={{fontFamily: HEAD, fontSize: size, lineHeight: 1.04, whiteSpace: 'nowrap', display: 'flex', gap: size * 0.25}}>
          {line.map((w, j) => {
            const k = sp(frame - w.t * fps + 2, 9);
            return (
              <span key={j} style={{display: 'inline-block', color: w.hi ? GOLD : '#fff', opacity: clamp(k * 1.6), transform: `translateY(${28 * (1 - k)}px) scale(${0.8 + 0.2 * k})`,
                WebkitTextStroke: `${size * 0.11}px ${INK}`, paintOrder: 'stroke fill', textShadow: `0 ${size * 0.07}px 0 ${DEEP}, 0 ${size * 0.12}px ${size * 0.3}px rgba(0,0,0,0.6)`}}>{w.text}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** A quiet label: what the numbers are from. */
const Pill: React.FC<{text: string; y: number; k?: number; icon?: string; x?: number; color?: string}> = ({text, y, k = 1, icon, x = CX, color = '#fff'}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${k})`, opacity: clamp(k * 2), display: 'flex', alignItems: 'center', gap: 14, padding: '12px 26px 14px', borderRadius: 999,
    background: 'rgba(10,16,44,0.82)', boxShadow: `0 0 0 3px rgba(255,255,255,0.14), 0 14px 30px rgba(0,0,0,0.5)`, whiteSpace: 'nowrap'}}>
    {icon && <Img src={staticFile(icon)} style={{height: 44}} />}
    <span style={{fontFamily: BODY, fontSize: 36, letterSpacing: 1, color}}>{text}</span>
  </div>
);

// ------------------------------------------------------------------- the phone
const Phone: React.FC<{w: number; h: number; x?: number; y?: number; rx?: number; ry?: number; rz?: number; s?: number; light?: number; children: React.ReactNode}> = ({
  w, h, x = CX, y = 1060, rx = 0, ry = 0, rz = 0, s = 1, light = 0.5, children,
}) => {
  const bz = 18, r = Math.min(w, h) * 0.13;
  return (
    <div style={{position: 'absolute', left: x - w / 2 - bz, top: y - h / 2 - bz, width: w + bz * 2, height: h + bz * 2, transform: `perspective(2200px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: r + bz, background: 'linear-gradient(140deg, #6d7690 0%, #191c27 28%, #0b0d14 62%, #4b5266 100%)',
        boxShadow: '0 0 0 2px #05060c, inset 0 0 0 2px rgba(255,255,255,0.22), 0 60px 110px rgba(0,0,0,0.65), 0 20px 40px rgba(0,0,0,0.5)'}} />
      <div style={{position: 'absolute', left: bz - 5, top: bz - 5, width: w + 10, height: h + 10, borderRadius: r + 5, background: '#020308'}} />
      <div style={{position: 'absolute', left: bz, top: bz, width: w, height: h, borderRadius: r, overflow: 'hidden', background: '#000'}}>
        {children}
        <div style={{position: 'absolute', inset: 0, background: `linear-gradient(${115 + ry}deg, rgba(255,255,255,${0.16 * light}) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 72%, rgba(255,255,255,${0.07 * light}) 100%)`, pointerEvents: 'none'}} />
      </div>
    </div>
  );
};

/** A finger. */
const Touch: React.FC<{x: number; y: number; f: number; r?: number}> = ({x, y, f, r = 36}) => {
  if (f < -7 || f > 18) return null;
  const on = f >= 0 && f <= 4;
  const u = clamp((f - 4) / 14);
  return (
    <>
      <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: `rgba(255,255,255,${on ? 0.65 : 0.5 * (1 - u) * (f < 0 ? (f + 7) / 7 : 1)})`,
        boxShadow: '0 6px 18px rgba(0,0,0,0.4), inset 0 0 0 4px rgba(255,255,255,0.5)', transform: `scale(${f < 0 ? 1.5 - 0.5 * ((f + 7) / 7) : on ? 0.9 : 1})`}} />
      {f > 2 && <div style={{position: 'absolute', left: x - r - 70 * u, top: y - r - 70 * u, width: (r + 70 * u) * 2, height: (r + 70 * u) * 2, borderRadius: '50%', border: `5px solid rgba(255,255,255,${0.9 * (1 - u)})`}} />}
    </>
  );
};

// the rings the Bubble Pass unlocks (app Rings.kt)
const RINGS: Record<string, string[]> = {
  gold: ['#FFE37A', '#FFC53D', '#FFAB00', '#FFE37A'], ember: ['#FF5C2A', '#FFB13D', '#FF2E63', '#FF5C2A'], frost: ['#9BE8FF', '#FFFFFF', '#4FB8FF', '#9BE8FF'],
  toxic: ['#7CFF4F', '#B44DFF', '#7CFF4F', '#B44DFF', '#7CFF4F'], galaxy: ['#7A5CFF', '#FF5CE1', '#4FD8FF', '#7A5CFF'], lava: ['#FF3D00', '#FFB300', '#FF1744', '#FF3D00'],
  rainbow: ['#FF5C5C', '#FFC53D', '#5CFF8A', '#4FB8FF', '#B45CFF', '#FF5C5C'],
};
/** The bubble, as the app draws it: the player's face in a turning ring. */
const Orb: React.FC<{src: string; x: number; y: number; d: number; ring?: string; t?: number; badge?: 'win' | 'loss' | null; press?: number; glow?: number; rot?: number}> = ({
  src, x, y, d, ring = 'gold', t = 0, badge = null, press = 0, glow = 0.5, rot = 0,
}) => {
  const c = RINGS[ring] || RINGS.gold;
  const band = d * 0.085;
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0, transform: `scale(${1 - 0.12 * press}) rotate(${rot}deg)`}}>
      {glow > 0 && <Glow x={0} y={0} r={d * 1.15} color={c[0]} a={glow} />}
      <div style={{position: 'absolute', left: -d / 2 - band, top: -d / 2 - band, width: d + band * 2, height: d + band * 2, borderRadius: '50%', background: `conic-gradient(from ${t * 90}deg, ${c.join(',')})`,
        boxShadow: `0 0 0 ${d * 0.03}px ${INK}, 0 ${d * 0.1}px ${d * 0.24}px rgba(0,0,0,0.55)`}} />
      <div style={{position: 'absolute', left: -d / 2 - d * 0.012, top: -d / 2 - d * 0.012, width: d * 1.024, height: d * 1.024, borderRadius: '50%', background: INK}} />
      <div style={{position: 'absolute', left: -d / 2, top: -d / 2, width: d, height: d, borderRadius: '50%', overflow: 'hidden', background: APP.surface2}}>
        <Img src={staticFile(src)} style={{width: d, height: d}} />
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(150deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 38%)'}} />
      </div>
      {badge && <div style={{position: 'absolute', left: d * 0.26, top: -d * 0.62, width: d * 0.42, height: d * 0.42, borderRadius: '50%', background: badge === 'win' ? APP.win : APP.loss, boxShadow: `0 0 0 ${d * 0.04}px ${INK}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BODY, fontSize: d * 0.28, color: '#fff'}}>{badge === 'win' ? '✓' : '✗'}</div>}
    </div>
  );
};

// ------------------------------------------------------------------- the match
const LW = 980, LH = 452;
const PNW = Math.round(LW * 460 / 915), PX = PNW / 460, PNX = LW - PNW;
const SPOTS = [[-1, 0], [-1, 1], [-1, 2], [1, 0], [1, 1], [1, 2]];
const Game: React.FC<{plan: any; t: number; dim?: number}> = ({plan, t, dim = 0}) => {
  const all = [...plan.blue, ...plan.red];
  const spot = (i: number) => {
    const [side, k] = SPOTS[i];
    return [LW / 2 + side * (140 + k * 92) + 30 * Math.sin(t * 1.3 + k * 2 + side), 150 + k * 102 + 18 * Math.cos(t * 1.1 + k + side)];
  };
  return (
    <AbsoluteFill style={{background: '#2f7a3a', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: LW / 2, top: LH / 2 + 40, width: 1250, height: 821, transform: 'translate(-50%,-50%) perspective(900px) rotateX(32deg)'}}>
        <Img src={staticFile(plan.map)} style={{position: 'absolute', left: '50%', top: '50%', width: 821, height: 1250, transform: 'translate(-50%,-50%) rotate(90deg)'}} />
      </div>
      {[0, 1, 2, 3].map((n) => {
        const from = (n * 2 + Math.floor(t * 0.8 + n * 0.37)) % 6, to = (from + 3) % 6, ph = (t * 0.8 + n * 0.37) % 1;
        const [x0, y0] = spot(from), [x1, y1] = spot(to);
        const a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
        return <div key={n} style={{position: 'absolute', left: x0 + (x1 - x0) * ph - 30, top: y0 - 45 + (y1 - y0) * ph, width: 60, height: 10, borderRadius: 5, transform: `rotate(${a}deg)`,
          background: `linear-gradient(90deg, transparent, ${from < 3 ? '#9fd4ff' : '#ffb08a'})`}} />;
      })}
      {all.map((b: any, i: number) => {
        const [x, y] = spot(i);
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%,-100%)'}}>
            <div style={{position: 'absolute', left: '50%', bottom: -8, width: 74, height: 26, transform: 'translateX(-50%)', borderRadius: '50%', border: `5px solid ${i < 3 ? '#3c8cff' : '#ff4a4a'}`, background: 'rgba(0,0,0,0.25)'}} />
            <Img src={staticFile(b.art)} style={{height: 96, transform: i < 3 ? 'none' : 'scaleX(-1)'}} />
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 66, bottom: 38, width: 124, height: 124, borderRadius: '50%', border: '6px solid rgba(255,255,255,0.32)'}} />
      <div style={{position: 'absolute', right: 66, bottom: 38, width: 114, height: 114, borderRadius: '50%', background: 'radial-gradient(circle,#ff8a4a,#d8401e)', boxShadow: '0 0 0 6px rgba(255,255,255,0.35)'}} />
      {dim > 0 && <AbsoluteFill style={{background: `rgba(5,8,25,${0.6 * dim})`}} />}
    </AbsoluteFill>
  );
};

const shot = (plan: any, name: string) => staticFile(plan.film.shots[name]);

// ===================================================================== scenes
const HY = 1160, HZ = -13, HS = 1.12, HO = 1000;
/** The ring draws itself, the bubble lands, the phone comes up under it. */
const Hook: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = hit(seg, 1, spb), b = hit(seg, 2, spb);
  const draw = clamp(frame / Math.max(6, a - 2));
  const land = sp(frame - a, 15);
  const go = sp(frame - b, 24, 0.7);
  const R = 218;
  // where the bubble rests on the leaning phone
  const ang = HZ * Math.PI / 180, ox = (-LW / 2 + 92) * HS, oy = (-LH / 2 + 112) * HS;
  const tx = CX + ox * Math.cos(ang) - oy * Math.sin(ang), ty = HY + ox * Math.sin(ang) + oy * Math.cos(ang);
  const u = clamp((frame - b) / 18);
  const bx = ease(CX, tx, u), by = ease(HO, ty, u) - 120 * Math.sin(Math.PI * outCubic(u));
  const d = ease(380, 118, u);
  return (
    <AbsoluteFill>
      <Set color="#FFB43D" t={t} cy={1060} />
      <Phone w={LW} h={LH} y={HY + 1500 * (1 - go)} rx={40 - 26 * go + 2 * Math.sin(t)} ry={5 * Math.sin(t * 0.8) - 8} rz={HZ} s={HS}>
        <Game plan={plan} t={t} />
      </Phone>
      {frame < a + 2 && (
        <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
          <circle cx={CX} cy={HO} r={R} fill="none" stroke={GOLD} strokeWidth={22} strokeLinecap="round" strokeDasharray={2 * Math.PI * R} strokeDashoffset={2 * Math.PI * R * (1 - outCubic(draw))} transform={`rotate(-90 ${CX} ${HO})`} />
        </svg>
      )}
      <Shock x={CX} y={HO} f={frame - a} color={GOLD} r={760} />
      <Sparks x={CX} y={HO} f={frame - a} n={26} r={560} />
      {frame >= a && <Orb src={plan.me.face} x={bx} y={by} d={d * (0.3 + 0.7 * land)} t={t} glow={0.55} />}
      <Flash f={frame - a} a={0.6} />
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

/** A tap in the draft: the panel slides over the game and the camera goes in. */
const TapIn: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const tap = hit(seg, 0, spb), open = hit(seg, 1, spb);
  const k = sp(frame - open, 15, 0.6);
  const z = outCubic(clamp((frame - open - 5) / 26));
  const s = 1 + 0.98 * z;
  const cx = PNX + PNW / 2 - LW / 2;
  return (
    <AbsoluteFill>
      <Set color="#3D7BFF" t={t} cy={1080} />
      <AbsoluteFill style={{transform: `translate(${-cx * s * z}px, ${-30 * z}px) scale(${s})`, transformOrigin: `${CX}px 1080px`}}>
        <Phone w={LW} h={LH} y={1080} rx={8 - 8 * z} ry={6 * Math.sin(t * 0.8) * (1 - z)}>
          <Game plan={plan} t={t + 3} dim={clamp(k)} />
          <Orb src={plan.me.face} x={78} y={108} d={84} t={t} glow={0.35} press={frame >= tap - 2 && frame <= tap + 4 ? 1 : 0} />
          <div style={{position: 'absolute', left: LW - PNW * clamp(k, 0, 1.02), top: 0, width: PNW, height: LH, background: APP.bg, overflow: 'hidden', boxShadow: '-16px 0 34px rgba(0,0,0,0.55)'}}>
            <Img src={shot(plan, 'draft0')} style={{width: PNW}} />
          </div>
          <Touch x={78} y={108} f={frame - tap} r={30} />
        </Phone>
      </AbsoluteFill>
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

/** Who gets banned on the map: the real list, off the panel and onto the stage. */
const Bans: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const start = hit(seg, 0, spb);
  const list: any[] = plan.film.bans;
  const fan = [[0, -0.04], [-1, 0.1], [1, 0.1], [-0.52, 1], [0.52, 1]];
  return (
    <AbsoluteFill>
      <Set color="#FF3D5C" t={t} cy={1060} />
      <div style={{position: 'absolute', left: CX - 520, top: 1010, width: 1040, transform: `perspective(1800px) rotateX(52deg) translateY(${40 + 20 * Math.sin(t)}px) scale(${1 + frame * 0.0006})`, transformOrigin: '50% 30%', borderRadius: 40, overflow: 'hidden', opacity: 0.8,
        boxShadow: '0 0 0 4px rgba(255,255,255,0.12), 0 40px 90px rgba(0,0,0,0.6)'}}>
        <Img src={shot(plan, 'draft1')} style={{width: 1040, display: 'block'}} />
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(7,10,26,0.25), rgba(7,10,26,0.85))'}} />
      </div>
      <Pill text={`${plan.film.rank} · ${plan.film.map.toUpperCase()}`} y={560} k={sp(frame - 3, 12)} icon={plan.leagues?.masters} color={GOLD} />
      {list.slice(0, 5).map((b, i) => {
        const at = start + i * Math.round(spb * 0.34);
        const k = sp(frame - at, 15);
        if (k <= 0) return null;
        const [fx, fy] = fan[i];
        const x = CX + fx * 330, y = 880 + fy * 390;
        const pctNow = Math.round(num(0, b.rate * 100, (frame - at) / 16));
        const st = sp(frame - at - 10, 9);
        return (
          <div key={i} style={{position: 'absolute', left: x - 150, top: y - 190 + 620 * (1 - clamp(k)), width: 300, height: 372, opacity: clamp(k * 2), transform: `perspective(1200px) rotateY(${fx * -13 + 4 * Math.sin(t * 1.3 + i)}deg) rotate(${fx * 3}deg) scale(${(i === 0 ? 1.08 : 0.94) * (0.5 + 0.5 * k)})`, zIndex: i === 0 ? 5 : 3}}>
            <div style={{position: 'absolute', inset: 0, borderRadius: 34, overflow: 'hidden', background: 'linear-gradient(165deg, #ff5c72 0%, #8f1230 58%, #2b0512 100%)', boxShadow: `0 0 0 5px ${INK}, 0 0 0 8px rgba(255,255,255,0.25), 0 34px 60px rgba(0,0,0,0.6)`}}>
              <Img src={staticFile(b.face)} style={{position: 'absolute', left: 0, top: 0, width: 300, height: 300, objectFit: 'cover'}} />
              <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 168, background: 'linear-gradient(180deg, rgba(20,2,8,0) 0%, rgba(20,2,8,0.95) 48%)'}} />
              <div style={{position: 'absolute', left: 0, right: 0, bottom: 72, textAlign: 'center', fontFamily: BODY, fontSize: 36, color: '#fff'}}>{b.name}</div>
              <div style={{position: 'absolute', left: 0, right: 0, bottom: 4, textAlign: 'center', fontFamily: HEAD, fontSize: 66, lineHeight: 1.05, color: GOLD}}>{pctNow}%</div>
              <div style={{position: 'absolute', inset: 0, background: `linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 60%)`, transform: `translateX(${-120 + 300 * clamp((frame - at - 8) / 22)}%)`}} />
            </div>
            {st > 0 && (
              <div style={{position: 'absolute', right: -18, top: -22, width: 92, height: 92, transform: `scale(${2.2 - 1.2 * clamp(st)}) rotate(${-14}deg)`, opacity: clamp(st * 2)}}>
                <svg width={92} height={92} viewBox="0 0 92 92"><circle cx={46} cy={46} r={36} fill="#14040a" stroke="#ff3d5c" strokeWidth={13} /><path d="M22 22 L70 70" stroke="#ff3d5c" strokeWidth={13} /></svg>
              </div>
            )}
          </div>
        );
      })}
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

/** The draft's odds: each pick lands and the needle answers. */
const Odds: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const b = plan.film.board;
  const hs = [0, 1, 2, 3, 4].map((i) => hit(seg, i, spb));
  const me = hs[4];
  const steps = [50, b.steps[0], b.steps[0], b.steps[1], b.steps[1]];
  let val = 50;
  for (let i = 0; i < 4; i++) val = num(val, steps[i + 1], clamp((frame - hs[i]) / 12));
  val = num(val, b.final, clamp((frame - me) / 18));
  const hot = frame >= me;
  const R = 236, C = 2 * Math.PI * R;
  const tile = (p: any, x: number, y: number, at: number, side: 'us' | 'them' | 'me', size = 190) => {
    const k = sp(frame - at, 13);
    const col = side === 'them' ? APP.loss : side === 'me' ? GOLD : APP.cyan;
    return (
      <div key={`${side}${x}${y}`} style={{position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 34, border: `5px dashed ${alpha(col, 0.5)}`}} />
        {k > 0 && (
          <div style={{position: 'absolute', inset: 0, borderRadius: 34, overflow: 'hidden', background: APP.surface2, boxShadow: `0 0 0 6px ${col}, 0 0 0 10px ${INK}, 0 24px 44px rgba(0,0,0,0.5)`, transform: `scale(${0.2 + 0.8 * k}) rotate(${(1 - clamp(k)) * 26}deg)`}}>
            <Img src={staticFile(p.face)} style={{width: size, height: size}} />
          </div>
        )}
        <Shock x={size / 2} y={size / 2} f={frame - at - 3} r={190} color={col} len={14} />
      </div>
    );
  };
  const col = hot ? APP.win : val >= 50 ? GOLD : '#ff8a3d';
  return (
    <AbsoluteFill>
      <Set color={hot ? '#22C96E' : '#3D7BFF'} t={t} cy={1010} />
      <Pill text={plan.film.map.toUpperCase()} y={560} k={sp(frame - 2, 12)} icon={plan.film.modeIcon} />
      <div style={{position: 'absolute', left: 60, top: 700, width: 236, textAlign: 'center', fontFamily: BODY, fontSize: 36, color: APP.cyan}}>your team</div>
      <div style={{position: 'absolute', right: 60, top: 700, width: 236, textAlign: 'center', fontFamily: BODY, fontSize: 36, color: '#ff8a9a'}}>enemies</div>
      {tile(b.allies[0], 178, 870, hs[0], 'us', 206)}
      {tile(b.allies[1], 178, 1130, hs[2], 'us', 206)}
      {tile(b.mine, 178, 1390, me, 'me', 222)}
      {tile(b.enemies[0], W - 178, 1000, hs[1], 'them', 206)}
      {tile(b.enemies[1], W - 178, 1260, hs[3], 'them', 206)}
      <Glow x={CX} y={1130} r={470} color={col} a={0.5} />
      <svg width={W} height={H} style={{position: 'absolute', left: 0, top: 0}}>
        <circle cx={CX} cy={1130} r={R} fill="rgba(6,10,28,0.86)" stroke="#1d2a5e" strokeWidth={42} />
        <circle cx={CX} cy={1130} r={R} fill="none" stroke={col} strokeWidth={42} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - val / 100)} transform={`rotate(-90 ${CX} 1130)`} />
      </svg>
      <div style={{position: 'absolute', left: CX - 240, top: 1130 - 108, width: 480, textAlign: 'center', fontFamily: HEAD, fontSize: 168, lineHeight: 1, color: '#fff', transform: `scale(${1 + 0.16 * Math.max(0, 1 - Math.abs(frame - me - 6) / 8)})`}}>{Math.round(val)}%</div>
      <div style={{position: 'absolute', left: CX - 240, top: 1130 + 62, width: 480, textAlign: 'center', fontFamily: BODY, fontSize: 38, color: APP.muted}}>to win</div>
      <Sparks x={178} y={1390} f={frame - me} color={GOLD} />
      <Flash f={frame - me} a={0.35} color={APP.win} />
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

/** They locked in a pick: who beats it. */
const Counter: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const c = plan.film.counter;
  const inF = hit(seg, 0, spb), h = [1, 2, 3].map((i) => hit(seg, i, spb));
  const k = sp(frame - inF, 18, 0.7);
  const hurt = h.reduce((n, x) => n + (frame >= x ? Math.max(0, 1 - (frame - x) / 8) : 0), 0);
  return (
    <AbsoluteFill>
      <Set color="#FF7A2E" t={t} cy={900} />
      <Glow x={760} y={960} r={560} color="#ff3d5c" a={0.55} />
      <Img src={staticFile(c.target.art)} style={{position: 'absolute', right: -70 - 700 * (1 - clamp(k)) + 22 * hurt, top: 590, height: 900, transform: `rotate(${3 * hurt + 1.5 * Math.sin(t)}deg) scale(${1 + 0.03 * Math.sin(t * 1.4)})`}} />
      <div style={{position: 'absolute', right: 70, top: 1400, fontFamily: HEAD, fontSize: 120, lineHeight: 1, color: '#fff', WebkitTextStroke: `16px ${INK}`, paintOrder: 'stroke fill', opacity: clamp(k * 2), transform: `translateX(${300 * (1 - clamp(k))}px)`}}>{c.target.name}</div>
      <Pill text={plan.film.rank} y={570} x={CX} k={sp(frame - 3, 12)} icon={plan.leagues?.masters} color={GOLD} />
      {c.list.slice(0, 3).map((b: any, i: number) => {
        const kk = sp(frame - h[i], 14, 0.8);
        if (kk <= 0) return null;
        return (
          <div key={i} style={{position: 'absolute', left: 60 - 640 * (1 - clamp(kk)), top: 700 + i * 226, width: 540, height: 196, transform: `rotate(${-2 + i}deg) scale(${0.9 + 0.1 * kk})`}}>
            <div style={{position: 'absolute', inset: 0, borderRadius: 38, background: 'linear-gradient(120deg, #2fbf74 0%, #14603f 70%, #0c3626 100%)', boxShadow: `0 0 0 5px ${INK}, 0 0 0 8px rgba(255,255,255,0.22), 0 26px 50px rgba(0,0,0,0.55)`}} />
            <Img src={staticFile(b.face)} style={{position: 'absolute', left: 18, top: 18, width: 160, height: 160, borderRadius: 28, boxShadow: `0 0 0 5px ${INK}`}} />
            <div style={{position: 'absolute', left: 204, top: 36, fontFamily: HEAD, fontSize: 62, lineHeight: 1, color: '#fff'}}>{b.name}</div>
            <div style={{position: 'absolute', left: 204, top: 112, fontFamily: BODY, fontSize: 46, lineHeight: 1, color: '#d8ffe7'}}>+{b.edge.toFixed(1)} points</div>
          </div>
        );
      })}
      {h.map((x, i) => <Shock key={i} x={690} y={860 + i * 180} f={frame - x - 4} r={330} color="#fff" len={12} />)}
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

/** The scoreboard, as the panel draws it, with its numbers counting. */
const Score: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const s = plan.film.score;
  const banner = hit(seg, 0, spb), rows = hit(seg, 1, spb), shine = hit(seg, 2, spb);
  const topK = Math.max(...s.rows.map((r: any) => r.k)), topD = Math.max(...s.rows.map((r: any) => r.dmg));
  const kb = sp(frame - banner, 14);
  const short = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
  const step = Math.max(2, Math.round(spb * 0.16));
  const row = (r: any, i: number) => {
    const at = rows + i * step;
    const k = sp(frame - at, 13);
    const u = clamp((frame - at - 3) / 22);
    const best = frame >= shine && r.k === topK, bestD = frame >= shine && r.dmg === topD;
    return (
      <div key={i} style={{position: 'relative', height: 104, opacity: clamp(k * 2), transform: `translateX(${(r.side === 'mine' ? -1 : 1) * 260 * (1 - clamp(k))}px)`, display: 'flex', alignItems: 'center', gap: 22, padding: '0 22px', borderRadius: 26,
        background: r.you ? 'rgba(255,197,61,0.18)' : 'transparent', boxShadow: r.you ? 'inset 0 0 0 4px rgba(255,197,61,0.65)' : 'none'}}>
        <div style={{position: 'relative', width: 78, height: 78, flex: '0 0 auto'}}>
          <Img src={staticFile(r.face)} style={{width: 78, height: 78, borderRadius: 20, boxShadow: `0 0 0 5px ${r.you ? APP.gold : '#050a1f'}`}} />
          {r.star && <div style={{position: 'absolute', right: -12, top: -14, fontSize: 40, lineHeight: 1, color: APP.gold, WebkitTextStroke: `5px ${INK}`, paintOrder: 'stroke fill'}}>★</div>}
        </div>
        <div style={{flex: '1 1 auto', minWidth: 0}}>
          <div style={{fontFamily: BODY, fontSize: 40, lineHeight: 1, color: r.you ? APP.gold : '#fff'}}>{r.name}</div>
          <div style={{marginTop: 12, height: 13, borderRadius: 7, background: 'rgba(0,0,0,0.4)', overflow: 'hidden'}}>
            <div style={{width: `${(r.dmg / topD) * 100 * outCubic(u)}%`, height: '100%', borderRadius: 7, background: r.side === 'mine' ? 'linear-gradient(90deg,#1aa6ff,#5fe0ff)' : 'linear-gradient(90deg,#c9203a,#ff6a7c)'}} />
          </div>
        </div>
        <div style={{width: 130, textAlign: 'center', fontFamily: HEAD, fontSize: best ? 60 : 50, color: '#fff'}}><span style={{color: best ? GOLD : '#fff'}}>{Math.round(num(0, r.k, u))}</span><span style={{color: APP.muted, fontSize: 40}}>/{Math.round(num(0, r.d, u))}</span></div>
        <div style={{width: 138, textAlign: 'right', fontFamily: BODY, fontSize: bestD ? 48 : 42, color: bestD ? GOLD : '#fff'}}>{short(num(0, r.dmg, u))}</div>
      </div>
    );
  };
  const mine = s.rows.filter((r: any) => r.side === 'mine'), theirs = s.rows.filter((r: any) => r.side === 'theirs');
  const bans = (list: string[], left: boolean) => (
    <div style={{display: 'flex', gap: 10}}>
      {list.map((f, i) => (
        <div key={i} style={{position: 'relative', width: 56, height: 56, transform: `scale(${sp(frame - rows - 6 * step - i * 2 - (left ? 0 : 4), 11)})`}}>
          <Img src={staticFile(f)} style={{width: 56, height: 56, borderRadius: 14, opacity: 0.55}} />
          <div style={{position: 'absolute', left: 4, top: 26, width: 48, height: 6, borderRadius: 3, background: APP.loss, transform: 'rotate(-45deg)'}} />
        </div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill>
      <Set color={s.win ? '#22C96E' : '#FF3D5C'} t={t} cy={1000} />
      <div style={{position: 'absolute', left: CX - 490, top: 560, width: 980, transform: `perspective(2400px) rotateX(${3}deg) rotateY(${3 * Math.sin(t * 0.8)}deg) scale(${0.94 + 0.0007 * frame})`}}>
        <div style={{height: 168, borderRadius: 38, overflow: 'hidden', position: 'relative', background: s.win ? 'linear-gradient(120deg,#2fbf74 0%,#17734a 60%,#0e3f2c 100%)' : 'linear-gradient(120deg,#ff5c72,#a3243c 60%,#4a0f1c)', boxShadow: `0 0 0 5px ${INK}, 0 0 0 8px rgba(255,255,255,0.2)`, transform: `scale(${0.5 + 0.5 * kb})`, opacity: clamp(kb * 2)}}>
          <div style={{position: 'absolute', left: 44, top: 30, fontFamily: HEAD, fontSize: 84, lineHeight: 1, color: '#fff', textShadow: '0 5px 0 rgba(0,0,0,0.35)'}}>{s.win ? 'VICTORY' : 'DEFEAT'}</div>
          <div style={{position: 'absolute', left: 46, top: 116, display: 'flex', alignItems: 'center', gap: 10, fontFamily: BODY, fontSize: 32, lineHeight: 1, color: 'rgba(255,255,255,0.9)'}}>{s.modeIcon && <Img src={staticFile(s.modeIcon)} style={{height: 34}} />}{s.map}</div>
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0) 42%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 58%)', transform: `translateX(${-130 + 260 * clamp((frame - banner - 4) / 20)}%)`}} />
        </div>
        <div style={{marginTop: 22, borderRadius: 38, padding: '18px 16px 22px', background: 'linear-gradient(180deg,#22337a,#16235a)', boxShadow: `0 0 0 5px ${INK}, 0 0 0 8px rgba(255,255,255,0.14), 0 50px 90px rgba(0,0,0,0.6)`, opacity: clamp(sp(frame - rows + 6, 12) * 2)}}>
          <div style={{display: 'flex', alignItems: 'center', padding: '0 24px 8px', fontFamily: BODY, fontSize: 28, color: APP.muted}}><span style={{flex: '1 1 auto'}}>SCOREBOARD</span><span style={{width: 130, textAlign: 'center'}}>K/D</span><span style={{width: 138, textAlign: 'right'}}>DAMAGE</span></div>
          {mine.map((r: any, i: number) => row(r, i))}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px'}}>{bans(s.bans.mine, true)}<span style={{fontFamily: HEAD, fontSize: 34, color: APP.muted}}>VS</span>{bans(s.bans.theirs, false)}</div>
          {theirs.map((r: any, i: number) => row(r, i + 3))}
        </div>
      </div>
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

/** The season card, turning in the light, its K/D off the glass. */
const Season: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = hit(seg, 0, spb), b = hit(seg, 1, spb), c = hit(seg, 2, spb);
  const k = sp(frame - a, 26, 0.6);
  const f = plan.film;
  const stat = (label: string, value: string, x: number, y: number, at: number, col: string) => {
    const kk = sp(frame - at, 14);
    if (kk <= 0) return null;
    return (
      <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${0.3 + 0.7 * kk}) rotate(${x < CX ? -5 : 5}deg)`, padding: '18px 34px 22px', borderRadius: 34, background: 'rgba(10,16,44,0.94)', textAlign: 'center',
        boxShadow: `0 0 0 5px ${col}, 0 0 0 10px ${INK}, 0 30px 60px rgba(0,0,0,0.6)`}}>
        <div style={{fontFamily: HEAD, fontSize: 104, lineHeight: 1, color: col}}>{value}</div>
        <div style={{fontFamily: BODY, fontSize: 36, color: '#fff'}}>{label}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Set color="#FFB43D" t={t} cy={1040} />
      <Phone w={590} h={1060} y={1120} x={CX + 600 * (1 - clamp(k))} ry={-58 * (1 - k) + 7 * Math.sin(t * 0.9)} rx={4} rz={-2 + 2 * Math.sin(t * 0.6)} light={1}>
        <Img src={staticFile(f.card)} style={{width: 590, position: 'absolute', left: 0, top: 0}} />
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.38) 50%, rgba(255,255,255,0) 60%)', transform: `translateX(${-140 + 280 * clamp((frame - a - 10) / 28)}%)`}} />
      </Phone>
      {stat('K/D', f.season.kd, 176, 1462, b, APP.win)}
      {stat('won', f.season.won, W - 160, 890, c, GOLD)}
      <Sparks x={176} y={1462} f={frame - b} color={APP.win} r={260} />
      <Sparks x={W - 160} y={890} f={frame - c} color={GOLD} r={260} />
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

/** The Bubble Pass: a ring a beat, the legendary one last. */
const Pass: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const order = ['gold', 'ember', 'frost', 'toxic', 'galaxy'];
  const hs = order.map((_, i) => hit(seg, i, spb));
  let i = 0;
  hs.forEach((x, j) => { if (frame >= x) i = j; });
  const k = sp(frame - hs[i], 12);
  const last = i === order.length - 1;
  const tier = [0, 2, 4, 6, 8, 10][Math.min(5, i + (last ? 1 : 1))];
  const u = clamp((frame - hs[0]) / Math.max(1, hs[4] - hs[0]));
  return (
    <AbsoluteFill>
      <Set color={last ? '#8B5CFF' : '#5B4BFF'} t={t} cy={960} />
      {last && [...Array(14).keys()].map((n) => (
        <div key={n} style={{position: 'absolute', left: CX - 12, top: 980 - 900, width: 24, height: 900, transformOrigin: '50% 100%', transform: `rotate(${n * 360 / 14 + t * 24}deg)`, background: 'linear-gradient(0deg, rgba(160,110,255,0.5), rgba(160,110,255,0))', clipPath: 'polygon(48% 100%, 52% 100%, 100% 0, 0 0)'}} />
      ))}
      <Orb src={plan.me.face} x={CX} y={980 + 12 * Math.sin(t * 2)} d={(last ? 500 : 440) * (0.86 + 0.14 * k)} ring={order[i]} t={t * (last ? 2.4 : 1.3)} glow={last ? 0.85 : 0.55} />
      {last && [0, 1, 2].map((n) => <div key={n} style={{position: 'absolute', left: CX + Math.cos(t * 2.2 + n * 2.1) * 352 - 12, top: 980 + Math.sin(t * 2.2 + n * 2.1) * 352 - 12, width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 0 26px 10px rgba(180,130,255,0.9)'}} />)}
      <Shock x={CX} y={980} f={frame - hs[i]} r={last ? 900 : 520} color={RINGS[order[i]][0]} />
      {last && <Sparks x={CX} y={980} f={frame - hs[i]} n={26} color="#c9a8ff" r={640} />}
      <Flash f={last ? frame - hs[4] : -1} a={0.55} color="#d9c8ff" />
      <div style={{position: 'absolute', left: CX - 360, top: 1400, width: 720}}>
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: BODY, fontSize: 42, color: '#fff', marginBottom: 14}}><span>Bubble Pass</span><span style={{color: GOLD}}>Tier {tier}</span></div>
        <div style={{height: 34, borderRadius: 17, background: 'rgba(6,10,28,0.9)', boxShadow: `0 0 0 5px ${INK}, 0 0 0 8px rgba(255,255,255,0.18)`, overflow: 'hidden'}}><div style={{width: `${12 + 88 * outCubic(u)}%`, height: '100%', background: 'linear-gradient(90deg,#8B6BFF,#FF5CE1,#FFC53D)'}} /></div>
      </div>
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

/** The weekly duel. */
const Squad: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = hit(seg, 0, spb), b = hit(seg, 1, spb), c = hit(seg, 2, spb);
  const k = sp(frame - a, 15, 0.7);
  const u = clamp((frame - b) / 20);
  const crown = sp(frame - c, 13);
  const bump = Math.max(0, 1 - Math.abs(frame - a - 7) / 7);
  return (
    <AbsoluteFill>
      <Set color="#E0409A" t={t} cy={1000} />
      <Glow x={290} y={980} r={380} color={GOLD} a={0.5} />
      <Glow x={W - 290} y={980} r={380} color={APP.cyan} a={0.45} />
      <Orb src={plan.me.face} x={290 - 560 * (1 - clamp(k)) - 18 * bump} y={960} d={330} ring="gold" t={t} glow={0.4} />
      <Orb src={plan.film.rival.face} x={W - 290 + 560 * (1 - clamp(k)) + 18 * bump} y={960} d={330} ring="frost" t={-t} glow={0.4} />
      <div style={{position: 'absolute', left: CX, top: 980, transform: `translate(-50%,-50%) scale(${0.2 + 0.8 * sp(frame - a - 5, 12)}) rotate(-6deg)`, fontFamily: HEAD, fontSize: 150, color: '#fff', WebkitTextStroke: `20px ${INK}`, paintOrder: 'stroke fill'}}>VS</div>
      <Shock x={CX} y={980} f={frame - a - 6} color="#fff" r={560} />
      {[['You', 31, 290, GOLD], ['Friend', 28, W - 290, APP.cyan]].map(([name, n, x, col]: any, i) => (
        <div key={i} style={{position: 'absolute', left: x - 200, top: 1200, width: 400, textAlign: 'center'}}>
          <div style={{fontFamily: BODY, fontSize: 46, color: '#fff'}}>{name}</div>
          <div style={{fontFamily: HEAD, fontSize: 150, lineHeight: 1, color: col}}>{Math.round(num(0, n, u))}</div>
          <div style={{fontFamily: BODY, fontSize: 38, color: APP.muted}}>wins this week</div>
        </div>
      ))}
      {crown > 0 && (
        <svg width={190} height={150} viewBox="0 0 190 150" style={{position: 'absolute', left: 290 - 95, top: 700 - 420 * (1 - clamp(crown)), transform: `rotate(${-8 + 3 * Math.sin(t * 3)}deg)`}}>
          <path d="M12 40 L56 84 L95 14 L134 84 L178 40 L160 136 L30 136 Z" fill={GOLD} stroke={INK} strokeWidth={10} strokeLinejoin="round" />
        </svg>
      )}
      <Sparks x={290} y={820} f={frame - c - 6} />
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

/** The home screen: widgets, and the alert. */
const Alerts: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const hs = [0, 1, 2].map((i) => hit(seg, i, spb)), ding = hit(seg, 3, spb);
  const w = 600, h = 1090, f = plan.film;
  const wk = (i: number) => sp(frame - hs[i], 14);
  const box = (k: number): React.CSSProperties => ({position: 'absolute', borderRadius: 40, background: 'rgba(16,26,66,0.95)', boxShadow: '0 0 0 3px rgba(255,255,255,0.12), 0 18px 34px rgba(0,0,0,0.45)', transform: `scale(${0.3 + 0.7 * k})`, opacity: clamp(k * 2), overflow: 'hidden'});
  const n = sp(frame - ding, 16, 0.7);
  const shake = frame > ding && frame < ding + 16 ? Math.sin(frame * 2.2) * 5 * (1 - (frame - ding) / 16) : 0;
  return (
    <AbsoluteFill>
      <Set color="#1AC9B4" t={t} cy={1060} />
      <Phone w={w} h={h} y={1120} ry={-10 + 6 * Math.sin(t * 0.7)} rx={4} rz={shake * 0.25} x={CX + shake} light={0.9}>
        <AbsoluteFill style={{background: 'linear-gradient(165deg, #1b1f55 0%, #5a2a86 46%, #c94f6d 100%)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 66, textAlign: 'center', fontFamily: 'sans-serif', fontWeight: 300, fontSize: 92, color: '#fff'}}>19:42</div>
        <div style={{...box(wk(0)), left: 34, top: 236, width: w - 68, height: 226}}>
          <Img src={staticFile(plan.leagues.masters)} style={{position: 'absolute', left: 22, top: 36, height: 150}} />
          <div style={{position: 'absolute', left: 196, top: 40, fontFamily: BODY, fontSize: 46, color: '#fff'}}>Masters I</div>
          <div style={{position: 'absolute', left: 196, top: 100, width: 280, height: 20, borderRadius: 10, background: '#0A1233'}}><div style={{width: `${44 * outCubic(clamp((frame - hs[0]) / 20))}%`, height: '100%', borderRadius: 10, background: APP.gold}} /></div>
          <div style={{position: 'absolute', left: 196, top: 134, fontFamily: BODY, fontSize: 32, color: APP.muted}}>8,686 elo · today 5–2</div>
        </div>
        <div style={{...box(wk(1)), left: 34, top: 490, width: (w - 92) / 2, height: 250}}>
          <div style={{position: 'absolute', left: 22, top: 18, fontFamily: BODY, fontSize: 32, color: APP.muted}}>Top pick</div>
          <Img src={staticFile(f.top.face)} style={{position: 'absolute', left: 46, top: 66, width: 150, height: 150, borderRadius: 30}} />
        </div>
        <div style={{...box(wk(2)), left: 34 + (w - 92) / 2 + 24, top: 490, width: (w - 92) / 2, height: 250}}>
          <div style={{position: 'absolute', left: 22, top: 18, fontFamily: BODY, fontSize: 32, color: APP.muted}}>Free reward</div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 78, textAlign: 'center', fontFamily: HEAD, fontSize: 44, lineHeight: 1.1, color: GOLD}}>{f.reward.short}</div>
        </div>
        <div style={{...box(wk(2)), left: 34, top: 764, width: w - 68, height: 132}}>
          {[['You', 31, plan.me.face, GOLD], ['Friend', 28, f.rival.face, '#fff']].map(([name, v, face, col]: any, i) => (
            <div key={i} style={{position: 'absolute', left: 22 + i * 256, top: 24, display: 'flex', alignItems: 'center', gap: 16}}>
              <Img src={staticFile(face)} style={{width: 84, height: 84, borderRadius: 24}} />
              <div><div style={{fontFamily: BODY, fontSize: 30, lineHeight: 1.1, color: col}}>{name}</div><div style={{fontFamily: HEAD, fontSize: 42, lineHeight: 1.1, color: col}}>{v}</div></div>
            </div>
          ))}
        </div>
        <div style={{position: 'absolute', left: 34, right: 34, bottom: 28, height: 112, borderRadius: 44, background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'space-evenly'}}>
          {['#35D07F', '#3D7BFF', '#FF7A2E', '#8B6BFF'].map((c, i) => <div key={i} style={{width: 78, height: 78, borderRadius: 24, background: `linear-gradient(160deg, ${mix(c, '#ffffff', 0.25)}, ${c})`}} />)}
        </div>
        <Orb src={plan.me.face} x={w - 52} y={830} d={86} t={t} glow={0.3} />
        <div style={{position: 'absolute', left: 20, top: -190 + 216 * clamp(n, 0, 1.04), width: w - 40, height: 164, borderRadius: 44, background: 'rgba(245,247,255,0.98)', boxShadow: '0 20px 44px rgba(0,0,0,0.45)'}}>
          <Img src={staticFile('app-icon.png')} style={{position: 'absolute', left: 24, top: 32, width: 100, height: 100, borderRadius: 26}} />
          <div style={{position: 'absolute', left: 146, top: 28, fontFamily: BODY, fontSize: 34, color: '#1b2140'}}>New free reward</div>
          <div style={{position: 'absolute', left: 146, top: 76, fontFamily: BODY, fontSize: 32, lineHeight: 1.15, color: '#48507a', width: 350}}>{f.reward.name}. Tap to claim.</div>
        </div>
      </Phone>
      <Shock x={CX} y={690} f={frame - ding} color="#fff" r={520} len={16} />
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

/** The name, and where to get it. */
const Outro: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = hit(seg, 0, spb), b = hit(seg, 1, spb), c = hit(seg, 2, spb);
  const k = sp(frame - a, 18);
  const faces: string[] = plan.film.orbit;
  return (
    <AbsoluteFill>
      <Set color="#FFB43D" t={t} cy={860} />
      <Glow x={CX} y={860} r={720} color={GOLD} a={0.5} />
      {faces.map((src, i) => {
        const ang = (i / faces.length) * Math.PI * 2 + t * 0.55;
        const r = 400 * sp(frame - a - 2, 22, 0.6);
        const depth = (Math.sin(ang) + 1) / 2;
        const size = 96 + 46 * depth;
        return <Img key={i} src={staticFile(src)} style={{position: 'absolute', left: CX + Math.cos(ang) * r - size / 2, top: 860 + Math.sin(ang) * r * 0.42 - size / 2, width: size, height: size, borderRadius: size * 0.26, zIndex: depth > 0.5 ? 6 : 1, opacity: 0.45 + 0.55 * depth, boxShadow: `0 0 0 4px ${INK}`}} />;
      })}
      <Img src={staticFile('app-icon.png')} style={{position: 'absolute', left: CX - 150, top: 710, width: 300, height: 300, borderRadius: 78, zIndex: 4, transform: `scale(${0.2 + 0.8 * k}) rotate(${(1 - clamp(k)) * -40}deg)`, boxShadow: `0 0 0 8px ${INK}, 0 0 0 16px rgba(255,255,255,0.18), 0 50px 90px rgba(0,0,0,0.6)`}} />
      <Shock x={CX} y={860} f={frame - a} color={GOLD} r={820} />
      <Sparks x={CX} y={860} f={frame - a - 2} n={28} r={620} />
      <div style={{position: 'absolute', left: 0, width: W, top: 1150, textAlign: 'center', fontFamily: HEAD, fontSize: 124, lineHeight: 1, color: '#fff', WebkitTextStroke: `16px ${INK}`, paintOrder: 'stroke fill', opacity: clamp(sp(frame - b, 12) * 2), transform: `translateY(${50 * (1 - clamp(sp(frame - b, 14)))}px)`}}>BrawlZone Bubble</div>
      <div style={{position: 'absolute', left: CX, top: 1372, transform: `translate(-50%,-50%) scale(${sp(frame - c, 13) * (1 + 0.025 * Math.sin(t * 6))})`, display: 'flex', alignItems: 'center', gap: 22, padding: '24px 50px 28px', borderRadius: 999, background: '#fff', boxShadow: `0 0 0 7px ${INK}, 0 22px 50px rgba(0,0,0,0.5)`}}>
        <svg width={64} height={70} viewBox="0 0 64 70"><path d="M4 4 L36 35 L4 66 Z" fill="#00c3ff" /><path d="M4 4 L47 26 L36 35 Z" fill="#00e676" /><path d="M4 66 L47 44 L36 35 Z" fill="#ff3d4f" /><path d="M36 35 L47 26 L62 35 L47 44 Z" fill="#ffc400" /></svg>
        <span style={{fontFamily: BODY, fontSize: 62, color: '#12162e', whiteSpace: 'nowrap'}}>Free on Google Play</span>
      </div>
      <div style={{position: 'absolute', left: 0, width: W, top: 1486, textAlign: 'center', fontFamily: BODY, fontSize: 42, color: '#e6ebff', opacity: clamp((frame - c - 8) / 8)}}>21 languages</div>
      <Flash f={frame - a} a={0.7} />
      <Say seg={seg} frame={frame} fps={plan.fps} />
    </AbsoluteFill>
  );
};

const SCENES: Record<string, React.FC<P>> = {
  af_hook: Hook, af_tap: TapIn, af_bans: Bans, af_odds: Odds, af_counter: Counter, af_score: Score, af_season: Season, af_pass: Pass, af_squad: Squad, af_alerts: Alerts, af_outro: Outro,
};

/** The cut: a blade of light across the frame, the next scene behind it. */
const CUT = 9;
const Shot: React.FC<{seg: Segment; plan: any; spb: number; index: number; dur: number; Scene: React.FC<P>}> = ({seg, plan, spb, index, dur, Scene}) => {
  const frame = useCurrentFrame();
  const p = index === 0 ? 1 : outCubic(clamp(frame / CUT));
  const right = index % 2 === 1;
  const x = right ? 132 - 164 * p : -32 + 164 * p;
  const clip = index === 0 || p >= 1 ? undefined
    : right ? `polygon(${x}% 0, 100% 0, 100% 100%, ${x - 32}% 100%)` : `polygon(0 0, ${x}% 0, ${x - 32}% 100%, 0 100%)`;
  const out = clamp((frame - dur) / CUT);
  const push = index === 0 ? 1 : 1.07 - 0.07 * outCubic(clamp(frame / 16));
  const t = (seg.start * spb + frame) / plan.fps;
  return (
    <AbsoluteFill style={{clipPath: clip}}>
      <AbsoluteFill style={{transform: `scale(${push + 0.04 * out})`}}>
        <Scene seg={seg} plan={plan} frame={frame} dur={dur} t={t} spb={spb} />
      </AbsoluteFill>
      {p < 1 && <div style={{position: 'absolute', left: `${x - 16}%`, top: -100, width: 34, height: H + 200, transform: `translateX(-50%) skewX(${-18.3}deg)`, background: 'linear-gradient(90deg, rgba(255,255,255,0), #fff 45%, #ffd45e 60%, rgba(255,212,94,0))'}} />}
    </AbsoluteFill>
  );
};

export const AppFilm: React.FC<{plan: Plan}> = ({plan}) => {
  const spb = plan.step * plan.fps;
  const n = plan.segments.length;
  return (
    <AbsoluteFill style={{background: '#04050d'}}>
      {plan.segments.map((seg, i) => {
        const from = Math.round(seg.start * spb);
        const dur = Math.round((seg.start + seg.len) * spb) - from;
        const Scene = SCENES[seg.kind];
        if (!Scene) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={dur + (i < n - 1 ? CUT : 0)}>
            <Shot seg={seg} plan={plan} spb={spb} index={i} dur={dur} Scene={Scene} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
