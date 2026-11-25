// The giveaway draw, replayed (2026-11-25, owner: "on the giveaway shouldnt
// you record the drafting?"). The draw itself is a script that answers in a
// second (scripts/giveaway-draw.ts), recorded in a private log; this shows
// what it did: every ticket on one line, in the order the draw used, running
// past until the one the random number pointed at. It says it is a replay.
// make.py gwdraw decides where the line stands on every frame (plan.pos).
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Arrow, Backdrop, BrandBug, Burst, Chip, Confetti, Crown, Flare, FollowButton, Halo, Label, SearchBar, SpeedLines, Title} from './fx';
import {SceneProps, Stage} from './Stage';
import {DEEP, INK, W, alpha, clamp, mix, outBack, outCubic, shade, Plan} from './theme';

const PURPLE = '#9a5aff';
const GOLD = '#ffb21e';
const pop = (frame: number, at: number, len = 9, s = 2) => outBack((frame - at) / len, s);
// Names as the player wrote them: Lilita keeps upper and lower case, the rest
// are the render image's fonts for what it lacks.
const NAMES = "'Lilita', 'Noto Color Emoji', 'WenQuanYi Zen Hei', 'IPAGothic', 'FreeSans', 'Unifont', sans-serif";
const COLORS = ['#ff3c64', '#ff8c28', '#e0a800', '#3cc878', '#1fb5c9', '#3c7bff', '#8a5aff', '#e04fb8'];

// Wide letters (Asian scripts, emoji) count double when fitting a name.
const units = (s: string) => [...s].reduce((n, ch) => n + (ch.codePointAt(0)! > 0x1100 ? 1.75 : 1), 0);
const fitName = (s: string, max: number, width: number) => Math.min(max, width / (Math.max(1, units(s)) * 0.56));

const CARD = 178, STEP = 204, CY = 960, CW = 880;

const Note: React.FC<{plan: Plan}> = ({plan}) => (
  <div style={{position: 'absolute', left: W / 2, top: 292, transform: 'translate(-50%,-50%)'}}>
    <Label text={plan.sample ? 'TEST: THESE NAMES ARE MADE UP' : 'REPLAY OF THE DRAW'} size={38} color="#efeaff" stroke={6} />
  </div>
);

/** One raffle ticket: its number on the stub, whose it is on the rest. */
const Ticket: React.FC<{n: number; who: number; name: string; lit: number}> = ({n, who, name, lit}) => {
  const c = COLORS[who % COLORS.length];
  const size = fitName(name, 84, CW - 330);
  return (
    <div style={{position: 'relative', width: CW, height: CARD, borderRadius: 34, overflow: 'hidden',
      background: `linear-gradient(180deg, ${mix(c, '#ffffff', 0.4)} 0%, ${c} 46%, ${shade(c, 0.72)} 100%)`,
      boxShadow: `0 0 0 8px ${INK}, 0 14px 0 8px ${DEEP}, inset 0 6px 0 rgba(255,255,255,0.35)`}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: 220, height: CARD, background: 'rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4}}>
        <Label text="TICKET" size={30} color="#fff6d8" stroke={5} />
        <Label text={String(n)} size={76} />
      </div>
      <div style={{position: 'absolute', left: 216, top: 10, width: 0, height: CARD - 20, borderLeft: '8px dotted rgba(255,255,255,0.75)'}} />
      {[-26, CARD - 26].map((y) => <div key={y} style={{position: 'absolute', left: 194, top: y, width: 52, height: 52, borderRadius: '50%', background: INK}} />)}
      <div style={{position: 'absolute', left: 250, right: 20, top: 0, height: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Label text={name} size={size} font={NAMES} stroke={Math.max(5, size * 0.13)} />
      </div>
      {lit > 0 && <div style={{position: 'absolute', inset: 0, background: `rgba(255,255,255,${0.45 * lit})`}} />}
    </div>
  );
};

const Intro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={PURPLE} t={t} rays={0.9} cy={1120} />
    <BrandBug />
    {plan.sample && <Note plan={plan} />}
    <Title text="WHO WON THE" size={140} maxWidth={860} frame={frame} y={430} glow="#ff3c8a" />
    <Title text="BRAWL PASS?" size={190} gold frame={frame} at={spb * 0.8} maxWidth={900} y={630} glow="#ff3c8a" />
    <Halo x={W / 2} y={1080} r={500} color="#ffd23f" a={0.75} />
    {plan.prize && frame > spb * 1.4 && <div style={{position: 'absolute', left: W / 2, top: 1080 + 14 * Math.sin(t * 3),
      transform: `translate(-50%,-50%) scale(${pop(frame, spb * 1.4, 12, 1.8)}) rotate(${-4 + 3 * Math.sin(t * 2)}deg)`}}>
      <Img src={staticFile(plan.prize)} style={{width: 620}} /></div>}
    <Burst f={frame - spb * 1.4} x={W / 2} y={1080} />
    {frame > spb * 2.4 && <Chip text={`${plan.entrants} PLAYERS`} color="#ff3c64" size={72} x={W / 2} y={1430} rot={-3} scale={pop(frame, spb * 2.4, 9, 2)} />}
    {frame > spb * 2.9 && <Chip text={`${plan.tickets} TICKETS`} color="#3cc878" size={72} x={W / 2} y={1580} rot={2} scale={pop(frame, spb * 2.9, 9, 2)} />}
  </AbsoluteFill>
);

const Reel: React.FC<SceneProps> = ({plan, frame, t}) => {
  const pos: number[] = plan.pos || [0];
  const landed = frame - plan.land;
  const raw = pos[Math.min(frame, pos.length - 1)];
  // once stopped, the winning ticket slides into the middle of the pointer
  const p = landed >= 0 ? raw + (Math.floor(raw) + 0.5 - raw) * outCubic(landed / 8) : raw;
  const before = pos[Math.max(0, Math.min(frame, pos.length - 1) - 1)];
  const speed = Math.max(0, raw - before); // tickets a frame
  const total: number = plan.tickets;
  const line: number[] = plan.line; // whose ticket each one is
  const names: string[] = plan.names;
  const at = Math.floor(p);
  const near = clamp(1 - speed / 0.5); // 0 running, 1 almost still
  const blur = clamp((speed - 0.6) / 3);
  const tick = p - Math.floor(p); // just crossed into a ticket: the frame kicks
  const kick = speed > 0.002 && speed < 2 ? Math.max(0, 1 - tick * 4) : 0;
  const rows = [];
  for (let k = -4; k <= 4; k++) {
    const i = at + k;
    const d = i + 0.5 - p; // cards from the pointer, 0 = dead centre
    const a = Math.abs(d);
    if (a > 3.6) continue;
    const n = ((i % total) + total) % total;
    const centre = landed >= 0 && k === 0;
    rows.push(
      <div key={i} style={{position: 'absolute', left: W / 2, top: CY + d * STEP, zIndex: 20 - Math.round(a),
        transform: `translate(-50%,-50%) scale(${(1 - 0.07 * a) * (centre ? 1.05 + 0.03 * Math.sin(landed * 0.45) : 1)}, ${(1 - 0.07 * a) * (1 + blur * 0.35)})`,
        opacity: clamp(1.15 - 0.24 * a) * (landed >= 0 && !centre ? 0.45 : 1)}}>
        <Ticket n={n + 1} who={line[n]} name={names[line[n]] || ''} lit={centre ? clamp(1 - landed / 10) : 0} />
      </div>,
    );
  }
  return (
    <AbsoluteFill>
      <Backdrop color={landed >= 0 ? GOLD : mix(PURPLE, '#ff3c64', near)} t={t * (1 + 2 * blur)} rays={0.5 + 0.4 * near} cy={CY} />
      <SpeedLines t={t} a={0.5 * blur + 0.35 * near * (landed >= 0 ? 0 : 1)} cy={CY} />
      {landed >= 0 && <Halo x={W / 2} y={CY} r={760} color="#fff1a8" a={0.8} />}
      {rows}
      {/* the streaks that make a fast line read as moving */}
      {blur > 0 && <AbsoluteFill style={{opacity: 0.4 * blur, backgroundImage: `repeating-linear-gradient(90deg, ${alpha('#ffffff', 0.35)} 0 10px, transparent 10px 74px)`,
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 14%, black 30%, black 70%, transparent 86%)'}} />}
      {/* the pointer */}
      <div style={{position: 'absolute', zIndex: 30, left: W / 2 - CW / 2 - 26, top: CY - CARD / 2 - 26, width: CW + 52, height: CARD + 52, borderRadius: 54,
        border: `${14 + 6 * kick}px solid ${landed >= 0 ? '#ffffff' : '#ffd23f'}`, boxShadow: `0 0 0 6px ${INK}, inset 0 0 0 6px ${INK}`, transform: `scale(${1 + 0.02 * kick})`}} />
      {[-1, 1].map((s) => (
        <svg key={s} width={110} height={120} viewBox="0 0 110 120" style={{position: 'absolute', zIndex: 31, left: s < 0 ? -8 + 10 * kick : W - 102 - 10 * kick, top: CY - 60, transform: s < 0 ? undefined : 'scaleX(-1)'}}>
          <path d="M6 8 L104 60 L6 112 Z" fill="#ffd23f" stroke={INK} strokeWidth="10" strokeLinejoin="round" />
        </svg>
      ))}
      {/* titles on top of the line */}
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 420, zIndex: 40, background: `linear-gradient(180deg, ${alpha(DEEP, 0.85)} 55%, transparent)`}} />
      <div style={{position: 'absolute', left: 0, top: 1500, width: W, height: 420, zIndex: 40, background: `linear-gradient(0deg, ${alpha(DEEP, 0.85)} 55%, transparent)`}} />
      <AbsoluteFill style={{zIndex: 41}}>
        <BrandBug />
        <Note plan={plan} />
        <Title text={landed >= 0 ? 'WE HAVE A WINNER!' : near > 0.6 ? 'ALMOST...' : 'GOOD LUCK!'} size={104} maxWidth={920} gold={landed >= 0} frame={999} y={395} glow="#ff3c8a" />
        <div style={{position: 'absolute', left: W / 2, top: 1610, transform: `translate(-50%,-50%) scale(${1 + 0.06 * kick})`}}>
          <Label text={`TICKET ${(((at % total) + total) % total) + 1} OF ${total}`} size={74} color={landed >= 0 ? '#ffe45a' : '#ffffff'} />
        </div>
      </AbsoluteFill>
      <Flare f={landed} y={CY} color="#ffe45a" />
      {landed >= 0 && landed < 5 && <AbsoluteFill style={{zIndex: 50, background: `rgba(255,255,255,${0.75 * (1 - landed / 5)})`}} />}
    </AbsoluteFill>
  );
};

const BigName: React.FC<{text: string; size: number}> = ({text, size}) => {
  const stroke = Math.max(8, size * 0.15);
  const depth = Math.max(6, Math.round(size * 0.08));
  const shadow = [...Array(depth).keys()].map((k) => `0 ${k + 1}px 0 ${DEEP}`).join(',');
  return (
    <span style={{position: 'relative', display: 'inline-block', fontFamily: NAMES, fontSize: size, lineHeight: 1.15, whiteSpace: 'nowrap'}}>
      <span style={{color: '#ffd23f', WebkitTextStroke: `${stroke}px ${INK}`, paintOrder: 'stroke fill', textShadow: shadow}}>{text}</span>
    </span>
  );
};

const Win: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const w = plan.winner;
  const size = fitName(w.name, 190, 960);
  const drop = outBack(clamp((frame - spb * 1.1) / 12), 1.4);
  return (
    <AbsoluteFill>
      <Backdrop color={PURPLE} t={t} rays={1} cy={860} />
      <Confetti t={frame / 30} />
      <BrandBug />
      {plan.sample && <Note plan={plan} />}
      <Title text="THE WINNER IS" size={132} frame={frame} y={420} glow="#ff3c8a" />
      <Halo x={W / 2} y={820} r={560} color="#ffb21e" a={0.6} />
      {frame >= spb * 1.1 && <div style={{position: 'absolute', left: W / 2, top: 640 - 260 * (1 - drop), transform: `translate(-50%,-50%) rotate(${4 * Math.sin(t * 2.4)}deg)`}}><Crown size={230} /></div>}
      <div style={{position: 'absolute', left: W / 2, top: 840, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 0.7, 12, 2.2) * (1 + 0.015 * Math.sin(t * 6))})`}}>
        <BigName text={w.name} size={size} />
      </div>
      <Burst f={frame - spb * 0.7} x={W / 2} y={840} />
      {w.tag && frame > spb * 1.7 && <Chip text={w.tag} color="#283069" size={58} x={W / 2} y={1010} scale={pop(frame, spb * 1.7)} />}
      {plan.prize && frame > spb * 2.1 && <div style={{position: 'absolute', left: W / 2, top: 1255 + 10 * Math.sin(t * 3), transform: `translate(-50%,-50%) scale(${pop(frame, spb * 2.1, 11, 1.8)}) rotate(${3 * Math.sin(t * 2)}deg)`}}>
        <Img src={staticFile(plan.prize)} style={{width: 430}} /></div>}
      {frame > spb * 2.6 && <Chip text="WINS THE BRAWL PASS!" color="#ff3c64" size={74} x={W / 2} y={1500} rot={-2} scale={pop(frame, spb * 2.6, 9, 2)} />}
      {frame > spb * 3.4 && <div style={{position: 'absolute', left: W / 2, top: 1625, transform: 'translate(-50%,-50%)'}}>
        <Label text={`TICKET ${plan.ticket} OF ${plan.tickets}, PICKED AT RANDOM`} size={42} stroke={7} /></div>}
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const bounce = Math.abs(Math.sin((frame / spb) * Math.PI)) * 22;
  return (
    <AbsoluteFill>
      <Backdrop color={PURPLE} t={t} rays={0.7} cy={900} />
      {plan.sample && <Note plan={plan} />}
      <Title text="NOT YOU?" size={190} maxWidth={880} frame={frame} y={450 - bounce} glow="#ff3c8a" />
      <Title text="FREE REWARDS" size={140} maxWidth={900} gold frame={frame} at={spb * 0.8} stagger={0.8} y={690} glow="#ff3c8a" />
      <Title text="EVERY DAY" size={170} maxWidth={860} gold frame={frame} at={spb * 1.4} stagger={0.8} y={870} glow="#ff3c8a" />
      {frame > spb * 1.8 && <Arrow x={W / 2} y={1060 + Math.abs(Math.sin(t * 6)) * 30} size={130} />}
      <SearchBar frame={frame} at={spb * 1.8} y={1230} text="brawlzone.net/rewards" height={130} />
      <FollowButton frame={frame} at={spb * 2.6} y={1450} />
    </AbsoluteFill>
  );
};

export const Draw: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{gd_intro: Intro, gd_reel: Reel, gd_win: Win, gd_outro: Outro}} swipeInto={['gd_reel', 'gd_outro']} />
);
