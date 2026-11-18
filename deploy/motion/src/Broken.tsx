// "Who got BROKEN this week?" in the Remotion look (2026-11-18): the three
// biggest Ranked win-rate climbers (#3 to #1), then the two that fell off,
// each with last week's tier and this week's. Content from make.py --plan.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Arrow, Art, Backdrop, Banner, BrandBug, Burst, Chip, Confetti, Flare, Halo, Label, SpeedLines, Title} from './fx';
import {Ending, Stamp, pop} from './Formats';
import {SceneProps, Stage} from './Stage';
import {TierChange} from './Tier';
import {INK, TIER, W, clamp, mix, outBack, outCubic, Plan} from './theme';

const UP = '#3cdc78', DOWN = '#ff465a', SLATE = '#4a4e78';
const signed = (d: number) => `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(1)}%`;

/** The win-rate change counting up from zero, with its arrow. */
const Delta: React.FC<{d: number; f: number; y: number; t: number}> = ({d, f, y, t}) => {
  if (f < 0) return null;
  const up = d >= 0;
  const v = d * outCubic(f / 30);
  const col = up ? UP : DOWN;
  return (
    <>
      <div style={{position: 'absolute', left: W / 2 - 70, top: y, transform: `translate(-50%,-50%) scale(${pop(f, 0, 9, 2)})`}}>
        <Label text={signed(v)} size={170} color={col} />
      </div>
      <div style={{position: 'absolute', left: 0, top: 0, transform: `rotate(${up ? 180 : 0}deg)`, transformOrigin: `${W / 2 + 340}px ${y}px`}}>
        <Arrow x={W / 2 + 340} y={y + (up ? 1 : -1) * 18 * Math.abs(Math.sin(t * 5))} color={col} size={130} />
      </div>
      <div style={{position: 'absolute', left: W / 2, top: y + 112, transform: 'translate(-50%,-50%)', opacity: clamp((f - 6) / 8)}}>
        <Label text="RANKED WIN RATE" size={48} color="#d6dcff" />
      </div>
    </>
  );
};

/** A line chart drawing itself up and to the right behind the intro (down for the fallers). */
const Climb: React.FC<{frame: number; color: string; down?: boolean}> = ({frame, color, down}) => {
  const up = [[60, 1700], [230, 1620], [360, 1660], [520, 1480], [650, 1520], [800, 1300], [1020, 1120]];
  const pts = down ? up.map(([x, y]) => [x, 2900 - y]) : up;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const len = 1500;
  const k = clamp(frame / 40);
  return (
    <svg width={W} height={1920} style={{position: 'absolute', left: 0, top: 0}}>
      <path d={d} fill="none" stroke={INK} strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - k)} />
      <path d={d} fill="none" stroke={color} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - k)} />
    </svg>
  );
};

const Intro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const jit = frame > spb ? Math.sin(t * 60) * 9 * Math.max(0, 1 - (frame - spb) / (spb * 2)) : 0;
  return (
    <AbsoluteFill>
      <Backdrop color={DOWN} t={t} rays={0.8} cy={1300} />
      <Climb frame={frame} color={UP} />
      <Title text="WHO GOT" size={190} frame={frame} y={480} glow="#7a0016" />
      {frame >= spb && <div style={{position: 'absolute', left: W / 2 + jit, top: 720, transform: `translate(-50%,-50%) rotate(-4deg) scale(${1 + 1.4 * (1 - outBack((frame - spb) / 10, 1.2))})`}}>
        <Title text="BROKEN" size={290} frame={999} x={0} y={0} color="#ff8a96" glow="#7a0016" />
      </div>}
      <Burst f={frame - spb} x={W / 2} y={720} />
      <Title text="THIS WEEK?" size={170} gold frame={frame} at={spb * 2} y={960} glow="#7a0016" />
      {frame > spb * 3 && <Chip text={plan.battles ? `${Math.round(plan.battles / 1000)}K RANKED BATTLES` : 'REAL RANKED DATA'} color="#283069" size={56} x={W / 2} y={1170} rot={-2} scale={pop(frame, spb * 3)} />}
    </AbsoluteFill>
  );
};

const Riser: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const r = seg.r;
  const col = TIER[r.tier] || UP;
  const u = (frame - 3) / 12;
  const top = seg.rank === 1;
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={0.9} cy={760} />
      {top && <SpeedLines t={t} a={0.25} cy={760} />}
      <BrandBug />
      <div style={{position: 'absolute', left: 150, top: 380, transform: `translate(-50%,-50%) rotate(-8deg) scale(${pop(frame, 0, 9, 2.2)})`}}>
        <Title text={`#${seg.rank}`} size={top ? 190 : 160} gold frame={999} x={0} y={0} />
      </div>
      <Halo x={W / 2} y={760} r={480} color={mix(col, '#ffffff', 0.3)} a={0.85} />
      {u > 0 && <div style={{position: 'absolute', left: W / 2, top: 770, transform: `translate(-50%,-50%) translateY(${(1 - outBack(u, 1.4)) * 260}px) scale(${0.6 + 0.4 * outBack(u, 1.6)})`}}>
        <Art src={r.art} size={680} style={{filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
      </div>}
      <Burst f={frame - 3} x={W / 2} y={770} />
      <Banner text={r.name} color={col} size={r.name.length <= 7 ? 130 : 104} y={1150} frame={frame} at={6} />
      <Delta d={r.d} f={frame - spb * 1.5} y={1330} t={t} />
      <TierChange was={r.was} now={r.tier} f={frame - spb * 3} y={1640} />
      {top && <Stamp text={r.tier === 'S' ? 'BROKEN!' : 'RISING!'} color={r.tier === 'S' ? '#ffd23f' : UP} frame={frame} at={spb * 4} y={560} />}
      {top && frame > spb * 4 && <Confetti t={(frame - spb * 4) / 30} />}
      <Flare f={frame - 3} y={770} color={col} />
    </AbsoluteFill>
  );
};

const Turn: React.FC<SceneProps> = ({frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={SLATE} t={t} rays={0.4} cy={1300} dark />
    <Climb frame={frame} color={DOWN} down />
    <Title text="AND WHO" size={170} frame={frame} y={700} glow="#1a1c3a" />
    <Title text="FELL OFF?" size={220} frame={frame} at={spb} y={930} color="#ff8a96" glow="#5a0012" />
    {frame > spb && <Arrow x={W / 2} y={1180 + 50 * outCubic((frame - spb) / 20) + 16 * Math.abs(Math.sin(t * 5))} color={DOWN} size={180} />}
  </AbsoluteFill>
);

const Faller: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const r = seg.r;
  const u = (frame - 3) / 12;
  const drop = 70 * outCubic(frame / (spb * 4));
  return (
    <AbsoluteFill>
      <Backdrop color={SLATE} t={t} rays={0.3} cy={760} dark />
      <BrandBug />
      <Halo x={W / 2} y={760} r={440} color="#8a90c0" a={0.5} />
      {u > 0 && <div style={{position: 'absolute', left: W / 2, top: 750 + drop, transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * outBack(u, 1.4)}) rotate(${4 * outCubic(frame / (spb * 4))}deg)`}}>
        <Img src={staticFile(r.grey || r.art)} style={{maxWidth: 680, maxHeight: 680, objectFit: 'contain'}} />
      </div>}
      <Banner text={r.name} color="#7d87aa" size={r.name.length <= 7 ? 130 : 104} y={1150} frame={frame} at={6} />
      <Delta d={r.d} f={frame - spb * 1.5} y={1330} t={t} />
      <TierChange was={r.was} now={r.tier} f={frame - spb * 3} y={1640} />
      <Stamp text="FELL OFF" color={DOWN} frame={frame} at={spb * 3.6} y={540} />
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({frame, t, spb}) => (
  <Ending frame={frame} t={t} spb={spb} big="AGREE?" line1="WHO'S BROKEN NEXT?" line2="TELL US IN THE COMMENTS" lead="LIVE RANKED TIER LIST ON" />
);

export const Broken: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{b_intro: Intro, b_up: Riser, b_turn: Turn, b_down: Faller, b_outro: Outro}} swipeInto={['b_up', 'b_turn', 'b_outro']} />
);
