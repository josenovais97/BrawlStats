// BrawlZone Bubble promo, v2 (2026-11-19, owner: "make it real pro... lets
// make this go VIRAL"). A narrated story, problem first: losing in Ranked,
// picking blind, then the bubble and what it does. make.py voices each line
// (Piper, on the box) and sets the scene lengths from the voice; `seg.hits`
// (beats into a scene) time the animation here and the sound effects there.
// The panel shots are the real panel captured as the Play app opens it; the
// native parts are drawn from the app's own colours and strings.
import React from 'react';
import {AbsoluteFill, Img, random, staticFile} from 'remotion';
import {Backdrop, Banner, Burst, Chip, Confetti, Flare, FollowButton, Halo, HoloCard, Label, SearchBar, SpeedLines, Star, Title} from './fx';
import {pop} from './Formats';
import {SceneProps, Stage} from './Stage';
import {BODY, DEEP, HEAD, INK, TIER, W, clamp, outBack, outCubic, Plan} from './theme';

// The app's palette (android res/values/colors.xml).
const APP = {bg: '#0A1233', surface: '#1A2759', surface2: '#22316C', border: '#33468F', fg: '#EEF1FA', muted: '#A9B6E0',
  brand: '#FFC53D', victory: '#35D07F', accent: '#8B6BFF', defeat: '#FF4F64'};
const VIOLET = '#7a4cff', BLUE = '#2f7bff', GREEN = '#2fbf5c', ORANGE = '#ff9a28', RED = '#e8283c', MARK = '#ffe45a';

// Landscape phone: the screen and where it sits in the frame.
const LW = 1000, LH = 462, PY = 1040;
const SX = W / 2 - LW / 2, SY = PY - LH / 2;
// The panel: 460dp of a 915dp landscape screen, on the right; 1 CSS px of the capture = PX screen px.
const PNW = 503, PNX = LW - PNW, PX = PNW / 460;
// The bubble, on the left edge where most people park it.
const BX = 64, BY = 118, BS = 74;

const ease = (a: number, b: number, u: number) => a + (b - a) * outCubic(u);
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s.-])(\w)/g, (_m, p, c) => p + c.toUpperCase());
const at = (seg: any, i: number, spb: number) => (seg.hits?.[i] ?? 0) * spb;

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
        {/* glass: a soft diagonal sheen */}
        <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 28%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.05) 100%)', pointerEvents: 'none'}} />
      </div>
    </div>
  );
};

/** The voice's words on screen: the current chunk, keywords in gold, popped in. */
const CaptionTrack: React.FC<{seg: any; frame: number; fps: number}> = ({seg, frame, fps}) => {
  const chunks: any[] = seg.vo?.chunks || [];
  let i = -1;
  for (let j = 0; j < chunks.length; j++) if (frame >= chunks[j].t0 * fps - 1) i = j;
  if (i < 0) return null;
  const c = chunks[i];
  const f = frame - c.t0 * fps;
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

/** A hand-drawn ring around something, then its label; f in frames since it starts. */
const Mark: React.FC<{cx: number; cy: number; rx: number; ry: number; f: number; label?: string; side?: 'left' | 'right' | 'below' | 'above'}> = ({cx, cy, rx, ry, f, label, side = 'below'}) => {
  if (f < 0) return null;
  const pts: string[] = [];
  for (let k = 0; k <= 96; k++) {
    const a = -Math.PI * 0.6 + (k / 96) * Math.PI * 2.2;
    const j = 1 + 0.025 * Math.sin(a * 2.3) + 0.04 * (k / 96);  // a little wider on the second pass, like a pen
    pts.push(`${k ? 'L' : 'M'}${(cx + Math.cos(a) * rx * j).toFixed(1)} ${(cy + Math.sin(a) * ry * j).toFixed(1)}`);
  }
  const len = Math.PI * (rx + ry) * 2.4;
  const u = clamp(f / 10);
  const lk = pop(f, 8, 8, 2.2);
  const lx = side === 'left' ? cx - rx - 14 : side === 'right' ? cx + rx + 14 : cx;
  const ly = side === 'below' ? cy + ry + 30 : side === 'above' ? cy - ry - 30 : cy;
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        <path d={pts.join(' ')} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - u)} />
        <path d={pts.join(' ')} fill="none" stroke={MARK} strokeWidth={7} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - u)} />
      </svg>
      {label && lk > 0 && (
        <div style={{position: 'absolute', left: lx, top: ly, transform: `translate(${side === 'left' ? '-100%' : side === 'right' ? '0' : '-50%'},-50%) scale(${lk}) rotate(-3deg)`,
          padding: '6px 16px 8px', borderRadius: 999, background: MARK, boxShadow: `0 0 0 4px ${INK}, 0 6px 0 4px ${DEEP}`, whiteSpace: 'nowrap'}}>
          <span style={{fontFamily: HEAD, fontSize: 30, color: INK}}>{label}</span>
        </div>
      )}
    </>
  );
};

/** A finger's tap: a soft dot and rings; f in frames since the touch. */
const Tap: React.FC<{x: number; y: number; f: number; hold?: number}> = ({x, y, f, hold = 6}) => {
  if (f < -6 || f > hold + 16) return null;
  const on = f >= 0 && f <= hold;
  const r = (f - hold) / 16;
  return (
    <>
      <div style={{position: 'absolute', left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: '50%', background: `rgba(255,255,255,${on ? 0.6 : Math.max(0, 0.6 * (1 - r))})`,
        boxShadow: '0 0 0 4px rgba(255,255,255,0.35)', transform: `scale(${f < 0 ? 1.4 - 0.4 * (f + 6) / 6 : 1})`, opacity: f < 0 ? (f + 6) / 6 : 1}} />
      {f > hold && <div style={{position: 'absolute', left: x - 34 - r * 50, top: y - 34 - r * 50, width: 68 + r * 100, height: 68 + r * 100, borderRadius: '50%',
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

/** The match under the bubble: the Brawl Ball map tilted like the game camera, six brawlers, health, shots, the controls. */
const Game: React.FC<{plan: Plan; t: number; dim?: number; hp?: number}> = ({plan, t, dim = 0, hp = 1}) => {
  const all = [...(plan.blue || []), ...(plan.red || [])];
  const shots = [0, 1, 2, 3].map((n) => {
    const from = (n * 2 + Math.floor(t * 0.8 + n * 0.37)) % 6;
    const to = (from + 3) % 6;
    const ph = (t * 0.8 + n * 0.37) % 1;
    return {from, to, ph};
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
        const life = clamp((i === 0 ? hp : 0.55 + 0.4 * Math.abs(Math.sin(t * 0.7 + i))));
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
const Bubble: React.FC<{src: string; x?: number; y?: number; s?: number; badge?: 'win' | 'loss' | null; pill?: string | null; pulse?: number; press?: number}> = ({
  src, x = BX, y = BY, s = 1, badge = null, pill = null, pulse = 0, press = 0,
}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${s * (1 - 0.1 * press)})`}}>
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

/** A panel capture, sliding in from the right, scrolled `scroll` screen pixels down. */
const PanelShot: React.FC<{src?: string; k: number; scroll?: number; children?: React.ReactNode}> = ({src, k, scroll = 0, children}) => (
  <div style={{position: 'absolute', left: PNX + (1 - clamp(k)) * (PNW + 30), top: 0, width: PNW, height: LH, background: APP.bg, overflow: 'hidden',
    boxShadow: '-14px 0 30px rgba(0,0,0,0.45)', borderLeft: `3px solid ${APP.border}`}}>
    {src && <Img src={staticFile(src)} style={{position: 'absolute', left: 0, top: -scroll, width: PNW}} />}
    <div style={{position: 'absolute', left: 0, top: -scroll, width: PNW}}>{children}</div>
  </div>
);

// ================================================================ scenes
/** POV: three Ranked games in a row lost. */
const Hook: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const n = [0, 1, 2].filter((i) => frame >= at(seg, i, spb)).length;
  const f = frame - at(seg, Math.max(0, n - 1), spb);
  const k = outBack(f / 7, 1.4);
  const shake = Math.max(0, 1 - f / 10) * 16;
  return (
    <AbsoluteFill style={{transform: `translate(${(random(`hx${frame}`) - 0.5) * shake}px, ${(random(`hy${frame}`) - 0.5) * shake}px)`}}>
      <Backdrop color="#c8283c" t={t} rays={0.5} cy={PY} />
      <Phone w={LW} h={LH}>
        <Game plan={plan} t={t} dim={0.5} hp={0.1} />
        <AbsoluteFill style={{boxShadow: `inset 0 0 ${120 + 60 * Math.max(0, 1 - f / 12)}px rgba(255,30,60,0.8)`}} />
        <div style={{position: 'absolute', left: LW / 2, top: LH / 2 - 10, transform: `translate(-50%,-50%) scale(${1 + 1.6 * (1 - k)}) rotate(${-4 + n}deg)`}}>
          <div style={{padding: '10px 60px 16px', borderRadius: 24, background: `linear-gradient(180deg, #ff6a7a, ${RED} 50%, #8a0f1e)`,
            boxShadow: `0 0 0 8px ${INK}, 0 14px 0 8px ${DEEP}`}}>
            <span style={{fontFamily: HEAD, fontSize: 120, color: '#fff', WebkitTextStroke: `14px ${INK}`, paintOrder: 'stroke fill', lineHeight: 1}}>DEFEAT</span>
          </div>
        </div>
        <div style={{position: 'absolute', left: LW / 2, top: LH / 2 + 100, transform: `translate(-50%,-50%) scale(${pop(f, 4, 6, 2)})`, fontFamily: HEAD, fontSize: 44,
          color: '#ffb0b8', WebkitTextStroke: `7px ${INK}`, paintOrder: 'stroke fill'}}>{`-${12 * n} ELO`}</div>
      </Phone>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{position: 'absolute', left: W / 2 + (i - 1) * 130, top: PY + LH / 2 + 110, width: 96, height: 96, borderRadius: 24,
          background: i < n ? RED : 'rgba(10,12,30,0.5)', boxShadow: `0 0 0 6px ${INK}`, transform: `translate(-50%,-50%) scale(${i < n ? pop(frame, at(seg, i, spb), 6, 2.4) || 1 : 1})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <span style={{fontFamily: HEAD, fontSize: 64, color: '#fff', WebkitTextStroke: `8px ${INK}`, paintOrder: 'stroke fill'}}>{i < n ? '✗' : ''}</span>
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** "You're picking blind": three picks, each a guess, each crossed out. */
const Blind: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const picks = [plan.red?.[1], plan.blue?.[2], plan.red?.[2]];
  return (
    <AbsoluteFill>
      <Backdrop color="#2c2c5a" t={t} rays={0.4} dark cy={PY} />
      <SpeedLines t={t} a={0.2} cy={PY} />
      {picks.map((b: any, i: number) => {
        const h = at(seg, i, spb);
        const flip = clamp((frame - h) / 8);
        const x = W / 2 + (i - 1) * 320, y = PY - 20 + (i === 1 ? -40 : 0);
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) perspective(1200px) rotateY(${flip * 180 + 6 * Math.sin(t * 2 + i)}deg) rotate(${(i - 1) * 6}deg)`}}>
            {flip < 0.5 ? (
              <HoloCard size={280} rim="#8b6bff" t={t} beat={frame / spb} inner="#3a3a7a">
                <Title text="?" size={220} gold frame={999} x={0} y={0} />
              </HoloCard>
            ) : (
              <div style={{transform: 'rotateY(180deg)'}}>
                <HoloCard size={280} rim="#ff4f64" t={t} beat={frame / spb} inner="#5a2a3a">
                  {b?.art && <Img src={staticFile(b.art)} style={{maxWidth: 230, maxHeight: 230, opacity: 0.85}} />}
                </HoloCard>
              </div>
            )}
            {frame > h + 9 && <div style={{position: 'absolute', left: 140, top: 140, transform: `translate(-50%,-50%) scale(${1 + 1.4 * (1 - outBack((frame - h - 9) / 6, 1))}) rotate(-12deg)`}}>
              <span style={{fontFamily: HEAD, fontSize: 240, color: RED, WebkitTextStroke: `16px ${INK}`, paintOrder: 'stroke fill', lineHeight: 1}}>✗</span>
            </div>}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** The reveal: the bubble lands on the game. */
const Reveal: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const h = at(seg, 0, spb);
  const u = clamp((frame - h) / 10);
  const k = outBack(u, 1.3);
  const bx = ease(LW / 2, BX, u), by = ease(LH / 2, BY, u), bs = frame < h ? 0 : 3.4 - 2.4 * k;
  return (
    <AbsoluteFill>
      <Backdrop color={VIOLET} t={t} rays={0.9} cy={PY} />
      <Halo x={W / 2} y={PY} r={700} color="#c9a8ff" a={0.6} />
      <Phone w={LW} h={LH} scale={ease(0.9, 1, frame / 14)}>
        <Game plan={plan} t={t} />
        {frame >= h && <Bubble src={plan.me.face} x={bx} y={by} s={bs} pulse={frame > h + 12 ? ((frame - h - 12) % 22) / 22 : 0} />}
      </Phone>
      <Burst f={frame - h - 8} x={SX + BX} y={SY + BY} />
      <Banner text="BRAWLZONE BUBBLE" color={APP.brand} size={92} y={PY + LH / 2 + 130} frame={frame} at={h + 10} />
      {frame > h + 16 && <Chip text="FREE" color={GREEN} size={64} x={W / 2 + 330} y={PY + LH / 2 + 60} rot={12} scale={pop(frame, h + 16, 8, 2.6)} />}
      <Flash f={frame - h - 8} />
    </AbsoluteFill>
  );
};

/** The panel scenes: the panel open, the camera on it, a ring on what matters. */
const PanelScene: React.FC<SceneProps & {shot: string; scrollTo: number; ring: [number, number, number, number]; label: string; side?: 'below' | 'above'; first?: boolean}> = ({
  plan, seg, frame, t, spb, shot, scrollTo, ring, label, side = 'below', first,
}) => {
  const tapF = first ? at(seg, 0, spb) : -999;
  const openF = first ? at(seg, 1, spb) : -12;
  const ringF = at(seg, 2, spb);
  const open = (frame - openF) / 12;
  const zoomU = (frame - openF - 8) / 16;
  const s = ease(1, 1.75, zoomU);
  const scroll = scrollTo * outCubic((frame - openF - 14) / 22);
  const [rx, ry, rw, rh] = ring; // CSS px of the capture: centre and radii
  return (
    <AbsoluteFill>
      <Backdrop color={BLUE} t={t} rays={0.6} cy={PY} />
      <Cam s={s} fx={ease(W / 2, SX + PNX + PNW / 2, zoomU)} fy={PY}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} dim={clamp(open)} />
          <Bubble src={plan.me.face} press={frame >= tapF && frame <= tapF + 6 ? 1 : 0} />
          <PanelShot src={plan.panels?.[shot]} k={open} scroll={scroll}>
            <Mark cx={rx * PX} cy={ry * PX} rx={rw * PX} ry={rh * PX} f={frame - ringF} label={label} side={side} />
          </PanelShot>
          {first && <Tap x={BX} y={BY} f={frame - tapF} />}
        </Phone>
      </Cam>
    </AbsoluteFill>
  );
};

const Draft: React.FC<SceneProps> = (p) => (
  <PanelScene {...p} first shot="draft" scrollTo={150} ring={[230, 338, 228, 28]} label="#1 PICK FOR THIS MAP" side="above" />
);
const Counters: React.FC<SceneProps> = (p) => (
  <PanelScene {...p} shot="counters" scrollTo={0} ring={[230, 206, 224, 27]} label="BEATS MR. P HERE" />
);

/** The post-game review, as the panel draws it (panel-review.tsx and its English strings). */
const Review: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const badgeF = at(seg, 0, spb), openF = at(seg, 1, spb), ringF = at(seg, 5, spb);
  const open = (frame - openF) / 12;
  const zoomU = (frame - openF - 6) / 16;
  const s = ease(1, 1.75, zoomU);
  const me = titleCase(plan.me.name), ctr = titleCase(plan.counter.name), btr = titleCase(plan.better.name);
  const row = (i: number, label: string, face: string, main: string, sub: string, col: string, ring?: boolean) => {
    const k = pop(frame, at(seg, 2 + i, spb), 9, 1.8);
    return (
      <div key={i} style={{position: 'relative', display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: '9px 12px', borderRadius: 14, background: APP.surface,
        border: `2px solid ${APP.border}`, transform: `scale(${k})`, transformOrigin: 'left center', opacity: clamp(k * 2)}}>
        <Img src={staticFile(face)} style={{width: 54, height: 54, borderRadius: 12}} />
        <div style={{display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0}}>
          <span style={{fontFamily: BODY, fontSize: 15, color: col, letterSpacing: 0.5}}>{label}</span>
          <span style={{fontFamily: BODY, fontSize: 22, color: APP.fg}}>{main}</span>
          <span style={{fontFamily: BODY, fontSize: 15, color: APP.muted}}>{sub}</span>
        </div>
        {ring && <Mark cx={232} cy={40} rx={238} ry={46} f={frame - ringF} />}
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Backdrop color={GREEN} t={t} rays={0.7} cy={PY} />
      <Cam s={s} fx={ease(W / 2, SX + PNX + PNW / 2, zoomU)} fy={PY}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} dim={clamp(open)} />
          <Bubble src={plan.me.face} badge={frame >= badgeF ? 'win' : null} pulse={frame >= badgeF && frame < openF ? ((frame - badgeF) % 18) / 18 : 0} />
          <PanelShot k={open}>
            <div style={{padding: '16px 18px', height: LH, boxSizing: 'border-box', background: `linear-gradient(180deg, #22337A, ${APP.bg} 40%)`}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <span style={{fontFamily: BODY, fontSize: 34, color: APP.victory}}>Victory</span>
                <span style={{fontFamily: BODY, fontSize: 22, padding: '4px 12px', borderRadius: 999, background: 'rgba(53,208,127,0.18)', color: APP.victory}}>+11 elo</span>
              </div>
              <div style={{fontFamily: BODY, fontSize: 15, color: APP.muted, marginTop: 2}}>Out in the Open · Knockout</div>
              <div style={{display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 10, boxShadow: `0 0 0 2px ${INK}`}}>
                <div style={{width: `${58 * clamp((frame - openF - 8) / 14)}%`, background: APP.victory}} />
                <div style={{flex: 1, background: '#5b6aa8'}} />
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: BODY, fontSize: 15, color: APP.fg, marginTop: 4}}>
                <span>Your draft 58%</span><span style={{color: APP.muted}}>Theirs 42%</span>
              </div>
              {row(0, 'STAR PLAYER', plan.me.face, `YOU · ${me}`, 'Most damage on your team', APP.brand)}
              {row(1, 'COUNTERED BY', plan.counter.face, ctr, `${ctr} beats ${me} here`, APP.defeat)}
              {row(2, 'BETTER PICK', plan.better.face, `${btr} instead of ${me}`, '+6 points for your draft', APP.victory, true)}
            </div>
          </PanelShot>
        </Phone>
      </Cam>
    </AbsoluteFill>
  );
};

const SESSION = [[0, 0, 0], [1, 0, 9], [2, 0, 19], [2, 1, 11], [3, 1, 21], [3, 2, 13], [4, 2, 25], [5, 2, 38]];

const Session: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const i = [0, 1, 2, 3, 4, 5, 6].filter((j) => frame >= at(seg, j, spb)).length;
  const [w, l, e] = SESSION[i];
  const f = i ? frame - at(seg, i - 1, spb) : 99;
  const won = i > 0 && SESSION[i][0] > SESSION[i - 1][0];
  return (
    <AbsoluteFill>
      <Backdrop color={ORANGE} t={t} rays={0.6} cy={PY} />
      <Cam s={ease(1, 2.7, frame / 14)} fx={ease(W / 2, SX + BX + 60, frame / 14)} fy={ease(PY, SY + BY + 40, frame / 14)} cy={1060}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} />
          <Bubble src={plan.me.face} pill={i ? `${w}–${l} +${e}` : '0–0'} badge={i ? (won ? 'win' : 'loss') : null} pulse={f < 10 ? f / 10 : 0} s={1 + 0.12 * Math.max(0, 1 - f / 6)} />
        </Phone>
      </Cam>
      {i === 7 && <Confetti t={(frame - at(seg, 6, spb)) / 30} />}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- portrait
const PW = 470, PH = 1000, PCY = 1100;

const Widget: React.FC<{k: number; w: number; h: number; x: number; y: number; children: React.ReactNode}> = ({k, w, h, x, y, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 26, padding: 16, background: APP.surface, border: `2px solid ${APP.border}`,
    boxShadow: '0 10px 20px rgba(0,0,0,0.35)', transform: `scale(${k})`, opacity: clamp(k * 2), boxSizing: 'border-box', overflow: 'hidden'}}>{children}</div>
);

const Wallpaper: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill style={{background: `radial-gradient(120% 70% at ${50 + 10 * Math.sin(t * 0.4)}% 0%, #4a3aa8, #182060 55%, #0a0f2e)`}} />
);

const Widgets: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const turn = clamp(frame / 14);
  const k = (i: number) => pop(frame, at(seg, i, spb), 10, 1.8);
  const lg = plan.leagues || {};
  const z = (frame - 14) / 14;
  return (
    <AbsoluteFill>
      <Backdrop color={VIOLET} t={t} rays={0.6} cy={PCY} />
      <Cam s={ease(1, 1.42, z)} fx={W / 2} fy={ease(PCY, PCY - PH / 2 + 420, z)} cy={ease(PCY, 1190, z)}>
        <Phone w={PW} h={PH} cy={PCY} rot={90 * (1 - outCubic(turn))} scale={ease(0.8, 1, turn)}>
          <Wallpaper t={t} />
          <div style={{position: 'absolute', left: 0, right: 0, top: 26, textAlign: 'center', fontFamily: BODY, fontSize: 66, color: '#fff'}}>20:41</div>
          <Widget k={k(0)} w={430} h={170} x={20} y={130}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
              {lg.diamond && <Img src={staticFile(lg.diamond)} style={{width: 92, height: 92, objectFit: 'contain'}} />}
              <div style={{display: 'flex', flexDirection: 'column', gap: 4, flex: 1}}>
                <span style={{fontFamily: BODY, fontSize: 15, color: APP.muted}}>MY RANK</span>
                <span style={{fontFamily: BODY, fontSize: 32, color: APP.fg}}>Diamond II</span>
                <span style={{fontFamily: BODY, fontSize: 17, color: APP.brand}}>≈6 wins to Mythic I</span>
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
            {[['Pinhole Punt', 'Brawl Ball · 23h left', plan.push?.[0]], ['Hot Potato', 'Heist · 9h left', plan.push?.[1]]].map(([m, sub, b]: any, j) => (
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
            <span style={{fontFamily: BODY, fontSize: 15, color: APP.brand, letterSpacing: 1}}>NEXT GOAL</span>
            {lg.mythic && <Img src={staticFile(lg.mythic)} style={{display: 'block', width: 60, height: 60, objectFit: 'contain', marginTop: 8}} />}
            <div style={{fontFamily: BODY, fontSize: 21, color: APP.fg, marginTop: 6}}>6 wins to Mythic I</div>
            <div style={{fontFamily: BODY, fontSize: 15, color: APP.victory, marginTop: 4}}>Today 2/3 wins</div>
          </Widget>
          <Widget k={k(3)} w={205} h={186} x={245} y={532}>
            <span style={{fontFamily: BODY, fontSize: 15, color: APP.brand, letterSpacing: 1}}>META NOW</span>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10}}>
              {(plan.top5 || []).map((b: any, j: number) => (
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
        </Phone>
      </Cam>
    </AbsoluteFill>
  );
};

const Alerts: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const push = plan.push?.[0];
  const items: [string, string][] = [
    ['Balance changes to your brawlers', 'Shade nerfed · Gus nerfed'],
    ['Leo reached Mythic I', 'Your move!'],
    ['New free reward!', 'Free Starr Drop. Tap to claim it before it expires.'],
    [`${push ? titleCase(push.name) : 'Bibi'} is close to prestige`, "38 trophies to go. Push on today's trophy maps."],
  ];
  return (
    <AbsoluteFill>
      <Backdrop color={BLUE} t={t} rays={0.6} cy={PCY} />
      <Cam s={ease(1.15, 1.5, frame / 20)} fx={W / 2} fy={PCY - PH / 2 + 470} cy={1230}>
        <Phone w={PW} h={PH} cy={PCY}>
          <Wallpaper t={t + 3} />
          <AbsoluteFill style={{background: 'rgba(0,0,0,0.25)'}} />
          <div style={{position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', fontFamily: BODY, fontSize: 120, color: '#fff', lineHeight: 1}}>20:41</div>
          <div style={{position: 'absolute', left: 0, right: 0, top: 200, textAlign: 'center', fontFamily: BODY, fontSize: 26, color: '#dfe4ff'}}>Thursday, 19 November</div>
          {items.map(([title, text], j) => {
            const u = (frame - at(seg, j, spb)) / 10;
            if (u <= 0) return null;
            return (
              <div key={j} style={{position: 'absolute', left: 16, right: 16, top: 270 + j * 150, transform: `translateY(${(1 - outBack(u, 1.4)) * -80}px)`, opacity: clamp(u * 2),
                padding: '14px 16px', borderRadius: 24, background: 'rgba(30,34,52,0.92)', boxShadow: '0 8px 18px rgba(0,0,0,0.4)', display: 'flex', gap: 14}}>
                <Img src={staticFile('app-icon.png')} style={{width: 46, height: 46, borderRadius: 12}} />
                <div style={{display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0}}>
                  <span style={{fontFamily: BODY, fontSize: 15, color: APP.muted}}>BrawlZone Bubble · now</span>
                  <span style={{fontFamily: BODY, fontSize: 22, color: '#fff'}}>{title}</span>
                  <span style={{fontFamily: BODY, fontSize: 17, color: '#c9cfe8'}}>{text}</span>
                </div>
                {j === 0 && <Mark cx={210} cy={50} rx={226} ry={56} f={frame - at(seg, 0, spb) - 10} />}
              </div>
            );
          })}
        </Phone>
      </Cam>
    </AbsoluteFill>
  );
};

/** The break card (BubbleService.showTiltCard): a cup, "3 losses in a row", Take 5?, Keep playing. */
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
                <span style={{fontFamily: BODY, fontSize: 18, color: '#B8C2E0', maxWidth: 300}}>Take 5? A short break helps more than one more game.</span>
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
/** Every scene: a small zoom punch on each caption, the caption itself on top. */
const withVoice = (Scene: React.FC<SceneProps>): React.FC<SceneProps> => (props) => {
  const fps = props.plan.fps;
  const chunks: any[] = props.seg.vo?.chunks || [];
  let since = 99;
  for (const c of chunks) if (props.frame >= c.t0 * fps) since = props.frame - c.t0 * fps;
  const punch = 1 + 0.035 * Math.max(0, 1 - since / 7);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{transform: `scale(${punch})`}}><Scene {...props} /></AbsoluteFill>
      <CaptionTrack seg={props.seg} frame={props.frame} fps={fps} />
    </AbsoluteFill>
  );
};

const SCENES: Record<string, React.FC<SceneProps>> = {bp_hook: Hook, bp_blind: Blind, bp_reveal: Reveal, bp_draft: Draft, bp_counters: Counters, bp_review: Review,
  bp_session: Session, bp_widgets: Widgets, bp_alerts: Alerts, bp_take5: Take5, bp_outro: Outro};
const VOICED = Object.fromEntries(Object.entries(SCENES).map(([k, v]) => [k, withVoice(v)]));

export const BubblePromo: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={VOICED} swipeInto={['bp_reveal', 'bp_review', 'bp_widgets', 'bp_take5', 'bp_outro']} />
);
