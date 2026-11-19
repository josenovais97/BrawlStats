// BrawlZone Bubble's features since launch (2026-11-19, owner: "the bubble app
// has a lot of new features that we never covered... do everything from
// footage to editing"). The panel shots are the real panel (the site's page,
// captured as the Play app opens it); the native parts are drawn from the
// app's layouts, colours (res/values/colors.xml) and strings.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Backdrop, Burst, Chip, Confetti, Flare, FollowButton, Halo, InlineTitle, Label, SearchBar, Star, Title} from './fx';
import {pop} from './Formats';
import {SceneProps, Stage} from './Stage';
import {BODY, DEEP, INK, TIER, W, clamp, outBack, outCubic, Plan} from './theme';

// The app's palette.
const APP = {bg: '#0A1233', surface: '#1A2759', surface2: '#22316C', border: '#33468F', fg: '#EEF1FA', muted: '#A9B6E0',
  brand: '#FFC53D', victory: '#35D07F', accent: '#8B6BFF', defeat: '#FF4F64'};
const VIOLET = '#7a4cff', BLUE = '#2f7bff', PINK = '#ff3c8a', GREEN = '#2fbf5c', ORANGE = '#ff9a28';

// Landscape phone: the screen, and where it sits in the frame.
const LW = 1000, LH = 462, PY = 1010;
const SX = W / 2 - LW / 2, SY = PY - LH / 2;
// The panel: 460dp of a 915dp-wide landscape screen, on the right.
const PNW = 503, PNX = LW - PNW;
// The bubble, on the left edge as most people park it.
const BX = 64, BY = 118, BS = 74;

const ease = (a: number, b: number, u: number) => a + (b - a) * outCubic(u);
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s.-])(\w)/g, (_m, p, c) => p + c.toUpperCase());

/** A camera over the frame: (fx, fy) in frame pixels lands on (W/2, cy), scaled s. */
const Cam: React.FC<{s: number; fx: number; fy: number; cy?: number; children: React.ReactNode}> = ({s, fx, fy, cy = PY, children}) => (
  <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${W / 2 - fx * s}px, ${cy - fy * s}px) scale(${s})`}}>{children}</AbsoluteFill>
);

/** A phone with a screen of w x h at (cx, cy), turned by rot degrees. */
const Phone: React.FC<{w: number; h: number; cx?: number; cy?: number; rot?: number; scale?: number; children: React.ReactNode}> = ({
  w, h, cx = W / 2, cy = PY, rot = 0, scale = 1, children,
}) => {
  const bz = 20;
  return (
    <div style={{position: 'absolute', left: cx - w / 2 - bz, top: cy - h / 2 - bz, width: w + bz * 2, height: h + bz * 2, borderRadius: 64,
      background: 'linear-gradient(145deg,#3a3f55,#14161f 45%,#2a2d3b)', boxShadow: `0 0 0 6px ${INK}, 0 30px 60px rgba(0,0,0,0.45), inset 0 0 0 3px #555b72`,
      transform: `rotate(${rot}deg) scale(${scale})`}}>
      <div style={{position: 'absolute', left: bz, top: bz, width: w, height: h, borderRadius: 46, overflow: 'hidden', background: '#000'}}>{children}</div>
    </div>
  );
};

/** The match under the bubble: the Brawl Ball map tilted like the game's camera, six brawlers, the controls. */
const Game: React.FC<{plan: Plan; t: number; dim?: number}> = ({plan, t, dim = 0}) => {
  const team = (list: any[], side: number) => list.map((b, i) => {
    const x = LW / 2 + side * (150 + i * 95) + 30 * Math.sin(t * 1.3 + i * 2 + side);
    const y = 150 + i * 105 + 18 * Math.cos(t * 1.1 + i);
    return (
      <div key={`${side}${i}`} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%,-100%)'}}>
        <div style={{position: 'absolute', left: '50%', bottom: -8, width: 74, height: 26, transform: 'translateX(-50%)', borderRadius: '50%',
          border: `5px solid ${side < 0 ? '#3c8cff' : '#ff4a4a'}`, background: 'rgba(0,0,0,0.25)'}} />
        <Img src={staticFile(b.art)} style={{height: 96, transform: side > 0 ? 'scaleX(-1)' : 'none', filter: 'drop-shadow(0 6px 0 rgba(0,0,0,0.3))'}} />
      </div>
    );
  });
  return (
    <AbsoluteFill style={{background: '#2f7a3a', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: LW / 2, top: LH / 2 + 40, width: 1250, height: 821, transform: 'translate(-50%,-50%) perspective(900px) rotateX(32deg)'}}>
        {/* the map turned so the goals are left and right, as the landscape camera sees it */}
        <Img src={staticFile(plan.map)} style={{position: 'absolute', left: '50%', top: '50%', width: 821, height: 1250, transform: 'translate(-50%,-50%) rotate(90deg)'}} />
      </div>
      {team(plan.blue || [], -1)}
      {team(plan.red || [], 1)}
      {/* the controls: movement left, attack and super right, the score up top */}
      <div style={{position: 'absolute', left: 70, bottom: 40, width: 130, height: 130, borderRadius: '50%', border: '6px solid rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.12)'}} />
      <div style={{position: 'absolute', right: 70, bottom: 40, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,#ff8a4a,#d8401e)', boxShadow: '0 0 0 6px rgba(255,255,255,0.4)'}} />
      <div style={{position: 'absolute', right: 210, bottom: 60, width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle,#ffe45a,#ffaa00)', boxShadow: '0 0 0 5px rgba(255,255,255,0.4)'}} />
      <div style={{position: 'absolute', left: LW / 2, top: 14, transform: 'translateX(-50%)', padding: '6px 22px', borderRadius: 14, background: 'rgba(5,10,31,0.7)',
        fontFamily: BODY, fontSize: 30, color: '#fff', display: 'flex', gap: 18}}>
        <span style={{color: '#5aa8ff'}}>1</span><span>1:4{Math.max(0, 9 - Math.floor(t % 10))}</span><span style={{color: '#ff6a6a'}}>0</span>
      </div>
      {dim > 0 && <AbsoluteFill style={{background: `rgba(5,8,25,${0.55 * dim})`}} />}
    </AbsoluteFill>
  );
};

/** The bubble as the app draws it: the player's icon in a gold ring; a ✓/✗ badge after a game; the session pill. */
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

/** A finger's tap: a soft dot and rings; f in frames since the touch, held for `hold` frames. */
const Tap: React.FC<{x: number; y: number; f: number; hold?: number}> = ({x, y, f, hold = 6}) => {
  if (f < -6 || f > hold + 16) return null;
  const on = f >= 0 && f <= hold;
  const r = (f - hold) / 16;
  return (
    <>
      <div style={{position: 'absolute', left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: '50%', background: `rgba(255,255,255,${on ? 0.55 : Math.max(0, 0.55 * (1 - r))})`,
        boxShadow: '0 0 0 4px rgba(255,255,255,0.35)', transform: `scale(${f < 0 ? 1.4 - 0.4 * (f + 6) / 6 : 1})`, opacity: f < 0 ? (f + 6) / 6 : 1}} />
      {f > hold && <div style={{position: 'absolute', left: x - 34 - r * 50, top: y - 34 - r * 50, width: 68 + r * 100, height: 68 + r * 100, borderRadius: '50%',
        border: `5px solid rgba(255,255,255,${1 - r})`}} />}
    </>
  );
};

/** A panel capture, sliding in from the right and scrolled `scroll` screen pixels down. */
const PanelShot: React.FC<{src: string; k: number; scroll?: number; children?: React.ReactNode}> = ({src, k, scroll = 0, children}) => (
  <div style={{position: 'absolute', left: PNX + (1 - clamp(k)) * (PNW + 30), top: 0, width: PNW, height: LH, background: APP.bg, overflow: 'hidden',
    boxShadow: '-14px 0 30px rgba(0,0,0,0.45)', borderLeft: `3px solid ${APP.border}`}}>
    {src && <Img src={staticFile(src)} style={{position: 'absolute', left: 0, top: -scroll, width: PNW}} />}
    {children}
  </div>
);

const Caption: React.FC<{l1: string; l2?: string; frame: number; spb: number; glow?: string; gold2?: boolean}> = ({l1, l2, frame, spb, glow = '#3a0f9a', gold2 = true}) => (
  <>
    <Title text={l1} size={l2 ? 110 : 120} frame={frame} y={l2 ? 300 : 360} glow={glow} />
    {l2 && <Title text={l2} size={150} gold={gold2} frame={frame} at={spb * 0.5} y={460} glow={glow} />}
  </>
);

const Foot: React.FC<{text: string; frame: number; at: number; color?: string; y?: number}> = ({text, frame, at, color = '#283069', y = 1580}) =>
  frame > at ? <Chip text={text} color={color} size={58} x={W / 2} y={y} rot={-2} scale={pop(frame, at)} /> : null;

// ================================================================ scenes
const Hook: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const bubbleAt = spb * 1.2;
  const k = pop(frame, bubbleAt, 12, 2.2);
  return (
    <AbsoluteFill>
      <Backdrop color={VIOLET} t={t} rays={0.8} cy={PY} />
      <Title text="YOUR BRAWL STARS" size={104} frame={frame} y={300} glow="#3a0f9a" />
      <Title text="COACH" size={250} gold frame={frame} at={spb * 0.5} y={470} glow="#3a0f9a" />
      <Phone w={LW} h={LH} scale={ease(0.86, 1, (frame + 4) / 16)}>
        <Game plan={plan} t={t} />
        {k > 0 && <Bubble src={plan.me.face} s={k} pulse={frame > bubbleAt + 8 ? ((frame - bubbleAt - 8) % 24) / 24 : 0} />}
      </Phone>
      <Burst f={frame - bubbleAt} x={SX + BX} y={SY + BY} />
      {frame > spb * 2.2 && <Title text="INSIDE THE GAME" size={96} frame={frame} at={spb * 2.2} stagger={0.6} y={1400} />}
      <Foot text="BRAWLZONE BUBBLE · FREE" frame={frame} at={spb * 3} color={GREEN} />
    </AbsoluteFill>
  );
};

/** The panel scenes: tap the bubble, the panel slides in, the camera moves onto it, it scrolls. */
const PanelScene: React.FC<SceneProps & {shot: string; l1: string; l2?: string; foot: string; scrollTo: number; tapX?: number; tapY?: number}> = ({
  plan, frame, t, spb, shot, l1, l2, foot, scrollTo, tapX, tapY,
}) => {
  const first = shot === 'draft';
  const open = first ? (frame - 10) / 12 : 1;
  const zoomU = first ? (frame - spb * 1.2) / (spb * 0.8) : frame / 12;
  const s = ease(1, 1.72, zoomU);
  const fx = ease(W / 2, SX + PNX + PNW / 2, zoomU), fy = PY;
  const scroll = scrollTo * outCubic((frame - spb * 2) / (spb * 1.6));
  return (
    <AbsoluteFill>
      <Backdrop color={BLUE} t={t} rays={0.6} cy={PY} />
      <Cam s={s} fx={fx} fy={fy}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} dim={clamp(open)} />
          <Bubble src={plan.me.face} press={first && frame >= 2 && frame <= 8 ? 1 : 0} />
          <PanelShot src={plan.panels?.[shot]} k={open} scroll={scroll} />
          {first && <Tap x={BX} y={BY} f={frame - 2} />}
          {tapX != null && tapY != null && <Tap x={tapX} y={tapY} f={frame - spb * 1.2} />}
        </Phone>
      </Cam>
      <Caption l1={l1} l2={l2} frame={frame} spb={spb} glow="#0a2a7a" />
      <Foot text={foot} frame={frame} at={spb * 2} color="#283069" />
    </AbsoluteFill>
  );
};

const Draft: React.FC<SceneProps> = (p) => (
  <PanelScene {...p} shot="draft" l1="TAP IT IN THE DRAFT" foot="BEST PICKS FOR YOUR MAP" scrollTo={160} />
);
const Counters: React.FC<SceneProps> = (p) => (
  <PanelScene {...p} shot="counters" l1="WHO BEATS" l2="THEIR PICK?" foot="REAL RANKED GAMES, YOUR RANK" scrollTo={0} tapX={PNX + 175} tapY={420} />
);

/** The post-game review, as the panel draws it (panel-review.tsx and its English strings). */
const Review: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const pulse = frame < spb * 1.2 ? (frame % 20) / 20 : 0;
  const open = (frame - spb * 1.1) / 12;
  const zoomU = (frame - spb * 1.6) / (spb * 0.8);
  const s = ease(1, 1.72, zoomU);
  const fx = ease(W / 2, SX + PNX + PNW / 2, zoomU);
  const row = (i: number, label: string, face: string, main: string, sub: string, col: string) => {
    const k = pop(frame, spb * 2 + i * 7, 9, 1.8);
    return (
      <div key={i} style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, padding: '9px 12px', borderRadius: 14, background: APP.surface,
        border: `2px solid ${APP.border}`, transform: `scale(${k})`, transformOrigin: 'left center', opacity: clamp(k * 2)}}>
        <Img src={staticFile(face)} style={{width: 54, height: 54, borderRadius: 12}} />
        <div style={{display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0}}>
          <span style={{fontFamily: BODY, fontSize: 15, color: col, letterSpacing: 0.5}}>{label}</span>
          <span style={{fontFamily: BODY, fontSize: 22, color: APP.fg}}>{main}</span>
          <span style={{fontFamily: BODY, fontSize: 15, color: APP.muted}}>{sub}</span>
        </div>
      </div>
    );
  };
  const me = titleCase(plan.me.name), ctr = titleCase(plan.counter.name), btr = titleCase(plan.better.name);
  return (
    <AbsoluteFill>
      <Backdrop color={GREEN} t={t} rays={0.7} cy={PY} />
      <Cam s={s} fx={fx} fy={PY}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} dim={clamp(open)} />
          <Bubble src={plan.me.face} badge="win" pulse={pulse} />
          <PanelShot src="" k={open}>
            <div style={{position: 'absolute', inset: 0, padding: '16px 18px', background: `linear-gradient(180deg, #22337A, ${APP.bg} 40%)`}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <span style={{fontFamily: BODY, fontSize: 34, color: APP.victory}}>Victory</span>
                <span style={{fontFamily: BODY, fontSize: 22, padding: '4px 12px', borderRadius: 999, background: 'rgba(53,208,127,0.18)', color: APP.victory}}>+11 elo</span>
              </div>
              <div style={{fontFamily: BODY, fontSize: 15, color: APP.muted, marginTop: 2}}>Out in the Open · Knockout</div>
              <div style={{display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginTop: 10, boxShadow: `0 0 0 2px ${INK}`}}>
                <div style={{width: `${58 * clamp((frame - spb * 1.6) / 14)}%`, background: APP.victory}} />
                <div style={{flex: 1, background: '#5b6aa8'}} />
              </div>
              <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: BODY, fontSize: 15, color: APP.fg, marginTop: 4}}>
                <span>Your draft 58%</span><span style={{color: APP.muted}}>Theirs 42%</span>
              </div>
              <div style={{fontFamily: BODY, fontSize: 15, color: APP.fg, marginTop: 6}}>Your draft was stronger, and you closed it out.</div>
              {row(0, 'STAR PLAYER', plan.me.face, `YOU · ${me}`, 'Most damage on your team', APP.brand)}
              {row(1, 'COUNTERED BY', plan.counter.face, ctr, `${ctr} beats ${me} here`, APP.defeat)}
              {row(2, 'BETTER PICK', plan.better.face, `${btr} instead of ${me}`, '+6 points for your draft', APP.victory)}
            </div>
          </PanelShot>
        </Phone>
      </Cam>
      <Caption l1="A REVIEW AFTER" l2="EVERY GAME" frame={frame} spb={spb} glow="#0a4a2a" />
      <Foot text="WHAT WON IT · WHAT LOST IT" frame={frame} at={spb * 3.6} color="#1d6a3a" />
    </AbsoluteFill>
  );
};

const SESSION = [[0, 0, 0], [1, 0, 9], [2, 0, 19], [2, 1, 11], [3, 1, 21], [3, 2, 13], [4, 2, 25], [5, 2, 38]];

const Session: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const i = Math.min(SESSION.length - 1, Math.max(0, Math.floor((frame - 6) / (spb * 0.42))));
  const [w, l, e] = SESSION[i];
  const changed = i > 0 && (frame - 6) % (spb * 0.42) < 8;
  const won = i > 0 && SESSION[i][0] > SESSION[i - 1][0];
  return (
    <AbsoluteFill>
      <Backdrop color={ORANGE} t={t} rays={0.6} cy={PY} />
      <Cam s={ease(1, 2.6, frame / 14)} fx={ease(W / 2, SX + BX + 60, frame / 14)} fy={ease(PY, SY + BY + 40, frame / 14)} cy={1030}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} />
          <Bubble src={plan.me.face} pill={i ? `${w}–${l} +${e}` : '0–0'} badge={i ? (won ? 'win' : 'loss') : null} pulse={changed ? ((frame - 6) % (spb * 0.42)) / 8 : 0} />
        </Phone>
      </Cam>
      <Caption l1="YOUR SESSION" l2="ON THE BUBBLE" frame={frame} spb={spb} glow="#a03000" />
      <Foot text="WINS · LOSSES · ELO, LIVE" frame={frame} at={spb * 2} color="#a0421a" />
    </AbsoluteFill>
  );
};

const MENU: [string, string][] = [['Draft', '#ffc53d'], ['Counters', '#ff4f64'], ['Meta', '#8b6bff'], ['Trophies', '#ffb21e'], ['My season', '#35d07f'], ['Match history', '#3cc8ff']];

const Menu: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const hold = clamp((frame - 6) / 14);
  return (
    <AbsoluteFill>
      <Backdrop color={PINK} t={t} rays={0.6} cy={PY} />
      <Cam s={1.5} fx={SX + 260} fy={SY + 230}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} dim={hold * 0.6} />
          <Bubble src={plan.me.face} press={hold > 0 && hold < 1 ? 1 : 0} />
          {frame >= 6 && frame < 26 && (
            <svg width={BS + 40} height={BS + 40} style={{position: 'absolute', left: BX - BS / 2 - 20, top: BY - BS / 2 - 20}}>
              <circle cx={(BS + 40) / 2} cy={(BS + 40) / 2} r={BS / 2 + 12} fill="none" stroke="#fff" strokeWidth={7} strokeDasharray={2 * Math.PI * (BS / 2 + 12)}
                strokeDashoffset={2 * Math.PI * (BS / 2 + 12) * (1 - hold)} transform={`rotate(-90 ${(BS + 40) / 2} ${(BS + 40) / 2})`} />
            </svg>
          )}
          <Tap x={BX} y={BY} f={frame - 6} hold={14} />
          <div style={{position: 'absolute', left: BX + BS / 2 + 22, top: 20, display: 'flex', flexDirection: 'column', gap: 9}}>
            {MENU.map(([label, col], j) => {
              const k = pop(frame, 20 + j * 3, 8, 2);
              return k > 0 ? (
                <div key={label} style={{display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px 10px 12px', borderRadius: 16, background: 'rgba(16,23,51,0.95)',
                  boxShadow: `0 0 0 2px #050A1F, 0 6px 12px rgba(0,0,0,0.4)`, transform: `scale(${k})`, transformOrigin: 'left center'}}>
                  <div style={{width: 18, height: 18, borderRadius: '50%', background: col, boxShadow: `0 0 10px ${col}`}} />
                  <span style={{fontFamily: BODY, fontSize: 26, color: APP.fg}}>{label}</span>
                </div>
              ) : null;
            })}
          </div>
        </Phone>
      </Cam>
      <Caption l1="HOLD IT FOR" l2="THE QUICK MENU" frame={frame} spb={spb} glow="#7a0040" />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- portrait
const PW = 470, PH = 1000, PCY = 1080;

const Widget: React.FC<{k: number; w: number; h: number; x: number; y: number; children: React.ReactNode}> = ({k, w, h, x, y, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 26, padding: 16, background: APP.surface, border: `2px solid ${APP.border}`,
    boxShadow: '0 10px 20px rgba(0,0,0,0.35)', transform: `scale(${k})`, opacity: clamp(k * 2), boxSizing: 'border-box', overflow: 'hidden'}}>{children}</div>
);

const Wallpaper: React.FC<{t: number}> = ({t}) => (
  <AbsoluteFill style={{background: `radial-gradient(120% 70% at ${50 + 10 * Math.sin(t * 0.4)}% 0%, #4a3aa8, #182060 55%, #0a0f2e)`}} />
);

const Widgets: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const turn = clamp(frame / 16);
  const k = (i: number) => pop(frame, 14 + i * spb * 0.55, 10, 1.8);
  const lg = plan.leagues || {};
  return (
    <AbsoluteFill>
      <Backdrop color={VIOLET} t={t} rays={0.6} cy={PCY} />
      <Cam s={ease(1, 1.45, (frame - 18) / 16)} fx={W / 2} fy={ease(PCY, PCY - PH / 2 + 420, (frame - 18) / 16)} cy={ease(PCY, 1160, (frame - 18) / 16)}>
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
            <div style={{width: `${64 * clamp((frame - 20) / 20)}%`, height: '100%', background: `linear-gradient(90deg, ${APP.brand}, #ffab00)`}} />
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
        {/* the app icons row under the widgets */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'space-evenly', opacity: 0.9}}>
          {[0, 1, 2, 3].map((j) => <div key={j} style={{width: 86, height: 86, borderRadius: 24, background: j === 1 ? 'transparent' : 'rgba(255,255,255,0.12)', overflow: 'hidden'}}>
            {j === 1 && <Img src={staticFile('app-icon.png')} style={{width: 86, height: 86}} />}</div>)}
        </div>
      </Phone>
      </Cam>
      <Title text="WIDGETS" size={200} gold frame={frame} y={330} glow="#3a0f9a" />
      <Title text="FOR YOUR HOME SCREEN" size={74} frame={frame} at={spb * 0.5} stagger={0.5} y={480} />
      <Foot text="RANK · TROPHY MAPS · GOALS · META" frame={frame} at={spb * 3} y={1700} />
    </AbsoluteFill>
  );
};

const Alerts: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
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
      <Cam s={ease(1.15, 1.5, frame / 20)} fx={W / 2} fy={PCY - PH / 2 + 470} cy={1210}>
      <Phone w={PW} h={PH} cy={PCY}>
        <Wallpaper t={t + 3} />
        <AbsoluteFill style={{background: 'rgba(0,0,0,0.25)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', fontFamily: BODY, fontSize: 120, color: '#fff', lineHeight: 1}}>20:41</div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 200, textAlign: 'center', fontFamily: BODY, fontSize: 26, color: '#dfe4ff'}}>Thursday, 19 November</div>
        {items.map(([title, text], j) => {
          const at = 8 + j * spb * 0.75;
          const u = (frame - at) / 10;
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
            </div>
          );
        })}
      </Phone>
      </Cam>
      <Caption l1="ALERTS THAT" l2="ACTUALLY MATTER" frame={frame} spb={spb} glow="#0a2a7a" />
      <Foot text="NERFS · FRIENDS · FREE REWARDS" frame={frame} at={spb * 3.4} y={1700} />
    </AbsoluteFill>
  );
};

/** The break card (BubbleService.showTiltCard): a cup, "3 losses in a row", Take 5?, Keep playing. */
const Take5: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const k = pop(frame, 8, 10, 1.8);
  return (
    <AbsoluteFill>
      <Backdrop color="#5a5f8a" t={t} rays={0.4} cy={PY} />
      <Cam s={1.55} fx={SX + 300} fy={SY + 170}>
        <Phone w={LW} h={LH}>
          <Game plan={plan} t={t} />
          <Bubble src={plan.me.face} badge="loss" pill="0–3 −24" />
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
      <Caption l1="IT EVEN TELLS YOU" l2="WHEN TO STOP" frame={frame} spb={spb} glow="#1a1c3a" />
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({frame, t, spb}) => {
  const k = outBack((frame + 2) / 12, 1.8);
  return (
    <AbsoluteFill>
      <Backdrop color={GREEN} t={t} rays={1} cy={560} />
      <Confetti t={frame / 30} />
      <Halo x={W / 2} y={560} r={330} color="#c8ffd8" a={0.9} />
      <div style={{position: 'absolute', left: W / 2, top: 560, transform: `translate(-50%,-50%) scale(${k}) rotate(${(1 - outCubic(frame / 14)) * -20 + 3 * Math.sin(t * 2)}deg)`}}>
        <Img src={staticFile('app-icon.png')} style={{width: 300, height: 300, borderRadius: 72, boxShadow: `0 0 0 10px ${INK}, 0 22px 0 10px ${DEEP}`}} />
      </div>
      <Burst f={frame} x={W / 2} y={560} />
      <Title text="BRAWLZONE" size={150} frame={frame} at={spb * 0.4} y={850} glow="#0a4a2a" />
      <Title text="BUBBLE" size={220} gold frame={frame} at={spb * 0.7} y={1030} glow="#0a4a2a" />
      {frame > spb * 1.3 && <Chip text="FREE ON GOOGLE PLAY" color="#1d6a3a" size={70} x={W / 2} y={1220} rot={-3} scale={pop(frame, spb * 1.3, 9, 2.2)} />}
      <SearchBar frame={frame} at={spb * 1.9} y={1400} text="BrawlZone Bubble" />
      <FollowButton frame={frame} at={spb * 3} y={1610} />
      {[0, 1].map((i) => <Star key={i} size={80} color="#fff6b0" style={{position: 'absolute', left: i ? 900 : 90, top: 700 + 30 * Math.sin(t * 3 + i), transform: `rotate(${t * 70}deg)`}} />)}
      <Flare f={frame} y={560} color={GREEN} />
    </AbsoluteFill>
  );
};

export const BubblePromo: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan}
    scenes={{bp_hook: Hook, bp_draft: Draft, bp_counters: Counters, bp_review: Review, bp_session: Session, bp_menu: Menu, bp_widgets: Widgets, bp_alerts: Alerts, bp_take5: Take5, bp_outro: Outro}}
    swipeInto={['bp_review', 'bp_widgets', 'bp_take5', 'bp_outro']} />
);
