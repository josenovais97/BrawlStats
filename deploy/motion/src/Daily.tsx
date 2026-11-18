// The daily challenge teaser (18:10) in the Remotion look (2026-11-18). Same
// content as make.py's Pillow scenes: today's Zoom puzzle from the site, four
// of its six steps with the hearts running out, the shadow, and the answer
// left on the site.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Backdrop, BrandBug, Burst, Chip, Confetti, Flare, FollowButton, Halo, HoloCard, Label, Ring, SearchBar, SpeedLines, Star, Title} from './fx';
import {pop} from './Formats';
import {SceneProps, Stage} from './Stage';
import {INK, W, clamp, outBack, outCubic, Plan} from './theme';

const BLUE = '#3caaff', PINK = '#ff3c64', VIOLET = '#965aff', CORAL = '#ff5a78';
const STEP_COL = ['#3caaff', '#4f86ff', '#7a5cff', '#b84cff'];
const CARD = 760;

const Heart: React.FC<{full: boolean; size: number}> = ({full, size}) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 100 90" style={{overflow: 'visible'}}>
    <path d="M50 86 L10 46 C-4 32 4 6 27 6 C38 6 46 13 50 20 C54 13 62 6 73 6 C96 6 104 32 90 46 Z"
      fill={full ? PINK : '#3a3e64'} stroke={INK} strokeWidth="8" strokeLinejoin="round" />
    {full && <path d="M20 30 C20 20 26 16 33 16" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="8" strokeLinecap="round" />}
  </svg>
);

/** One of the site's zoom pictures in a holo card. */
const ZoomCard: React.FC<{src: string; t: number; beat: number; rim: string; size?: number; over?: string; overA?: number}> = ({src, t, beat, rim, size = CARD, over, overA = 0}) => (
  <HoloCard size={size} rim={rim} t={t} beat={beat} inner="#1e2350">
    <Img src={staticFile(src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
    {over && <Img src={staticFile(over)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: overA}} />}
  </HoloCard>
);

const Intro: React.FC<SceneProps> = ({plan, seg, frame, beat, t, spb}) => {
  const k = outBack((frame + 3) / 12, 1.6);
  return (
    <AbsoluteFill>
      <Backdrop color={BLUE} t={t} rays={0.7} cy={1300} />
      <Halo x={W / 2} y={1300} r={520} color="#9fd8ff" a={0.8 * clamp(k)} />
      {/* the puzzle is on screen from the first frame: that second stops the scroll */}
      <div style={{position: 'absolute', left: W / 2, top: 1300, transform: `translate(-50%,-50%) perspective(1600px) rotateY(${(1 - outCubic((frame + 3) / 18)) * 90 + 6 * Math.sin(t * 2)}deg) rotate(-5deg) scale(${0.64 * k})`}}>
        <ZoomCard src={plan.zooms[0]} t={t} beat={beat} rim="#ffd23f" />
      </div>
      <Title text="TODAY'S" size={160} frame={frame} y={400} glow="#1a3cff" />
      <Title text="BRAWLER" size={230} gold frame={frame} at={spb} y={610} glow="#1a3cff" />
      <Chip text={`DAILY #${seg.n}`} color={PINK} size={74} x={W / 2} y={820} rot={-5} scale={pop(frame, spb * 2, 9, 2.2)} />
      {frame > spb * 3 && <Title text="CAN YOU GUESS IT?" size={84} frame={frame} at={spb * 3} stagger={0.7} y={1720} />}
    </AbsoluteFill>
  );
};

const PY = 980;

const Zoom: React.FC<SceneProps> = ({plan, seg, frame, beat, t, spb}) => {
  const i: number = seg.i;
  const col = STEP_COL[i] || BLUE;
  const n = String(3 - Math.min(2, Math.floor(beat)));
  const tickU = (beat % 1) / 0.3;
  const punch = 1 + 0.35 * (1 - outBack(frame / 10, 1.4));
  const lost = i - 1; // the heart this wrong guess cost
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={0.5} cy={PY} />
      <SpeedLines t={t} a={n === '1' ? 0.3 + 0.25 * Math.max(0, 1 - tickU) : 0} cy={PY} />
      <Halo x={W / 2} y={PY} r={CARD * (0.95 + 0.07 * Math.max(0, 1 - tickU))} color={col} a={0.75} />
      <BrandBug y={190} />
      {[0, 1, 2, 3, 4, 5].map((j) => {
        const full = j >= i;
        const hit = j === lost ? Math.max(0, 1 - frame / 12) : 0;
        return (
          <div key={j} style={{position: 'absolute', left: W / 2 + (j - 2.5) * 112, top: 318, transform: `translate(-50%,-50%) translateX(${Math.sin(frame * 2.2) * 10 * hit}px) scale(${1 + 0.45 * hit})`}}>
            <Heart full={full} size={92} />
          </div>
        );
      })}
      <Label text={`ZOOM ${i + 1}/6`} size={56} style={{position: 'absolute', left: 70, top: 410}} />
      <Chip text={`DAILY #${plan.number}`} color={PINK} size={44} x={W - 190} y={438} />
      <div style={{position: 'absolute', left: W / 2, top: PY, transform: `translate(-50%,-50%) perspective(1800px) rotateX(${4 * Math.sin(t * 1.7)}deg) rotateY(${5 * Math.sin(t * 1.3)}deg) scale(${punch * (1 + 0.03 * Math.max(0, 1 - tickU))})`}}>
        <ZoomCard src={plan.zooms[i]} t={t} beat={beat} rim={n === '1' ? PINK : '#ffd23f'} />
      </div>
      <div style={{position: 'absolute', left: W / 2, top: PY - CARD / 2 - 24, transform: 'translate(-50%,-50%)'}}>
        <Ring n={n} frac={1 - beat / 3} color={n === '1' ? PINK : '#ffd23f'} pulse={1 + 0.25 * Math.max(0, 1 - tickU)} />
      </div>
      <Title text="WHO IS THIS?" size={112} frame={i === 0 ? frame : 999} at={2} stagger={0.7} y={PY + CARD / 2 + 130} glow={col} />
      {n === '1' && <AbsoluteFill style={{boxShadow: `inset 0 0 ${160 + 80 * Math.max(0, 1 - tickU)}px rgba(255,40,80,0.7)`}} />}
    </AbsoluteFill>
  );
};

const Stuck: React.FC<SceneProps> = ({plan, frame, beat, t, spb}) => {
  const blur = clamp(frame / (spb * 1.6));
  const q = pop(frame, spb * 0.5, 10, 2);
  return (
    <AbsoluteFill>
      <Backdrop color={CORAL} t={t} rays={0.6} cy={1010} />
      <Title text="STILL NO" size={170} frame={frame} y={330} glow="#a0003a" />
      <Title text="IDEA?" size={240} gold frame={frame} at={spb} y={530} glow="#a0003a" />
      <div style={{position: 'absolute', left: W / 2, top: 1040, transform: `translate(-50%,-50%) rotate(${-3 + 2 * Math.sin(t * 2)}deg) scale(0.82)`}}>
        <ZoomCard src={plan.zooms[plan.zooms.length - 1]} over={plan.blur} overA={blur} t={t} beat={beat} rim="#ffffff" />
      </div>
      {q > 0 && <div style={{position: 'absolute', left: W / 2, top: 1040, transform: `translate(-50%,-50%) rotate(8deg) scale(${q})`}}>
        <Title text="?" size={520} gold frame={999} x={0} y={0} glow="#a0003a" />
      </div>}
      <Burst f={frame - spb * 0.5} x={W / 2} y={1040} />
      {frame > spb * 2 && <Chip text="2 MORE CLUES ON THE SITE" color="#283069" size={60} x={W / 2} y={1560} rot={-2} scale={pop(frame, spb * 2)} />}
    </AbsoluteFill>
  );
};

const Shadow: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const k = pop(frame, spb, 12, 1.6);
  return (
    <AbsoluteFill>
      <Backdrop color={VIOLET} t={t} rays={0.9} cy={1060} />
      <Title text="+ A SHADOW" size={160} frame={frame} y={370} glow="#3a0f9a" />
      <Title text="TO GUESS" size={150} gold frame={frame} at={spb * 0.7} y={550} glow="#3a0f9a" />
      <Halo x={W / 2} y={1060} r={500} color="#c9a8ff" a={0.9 * clamp(k)} />
      {k > 0 && <div style={{position: 'absolute', left: W / 2, top: 1060, transform: `translate(-50%,-50%) translateY(${-14 * Math.abs(Math.sin(t * 3))}px) rotate(${3 * Math.sin(t * 2)}deg) scale(${0.86 * k})`}}>
        <HoloCard size={CARD} rim="#e0d0ff" t={t} beat={frame / spb} inner="#cdb8ff">
          <Img src={staticFile(plan.shadow)} style={{maxWidth: CARD - 60, maxHeight: CARD - 60}} />
        </HoloCard>
      </div>}
      <Burst f={frame - spb} x={W / 2} y={1060} color="#e0d0ff" />
      {frame > spb * 2.2 && <Title text="+ THE CLASSIC PUZZLE" size={78} frame={frame} at={spb * 2.2} stagger={0.6} y={1560} />}
      {[0, 1, 2].map((j) => <Star key={j} size={64} color="#fff6b0" style={{position: 'absolute', left: 130 + j * 380, top: 1700 + 18 * Math.sin(t * 3 + j),
        transform: `rotate(${t * 60 + j * 40}deg)`, opacity: clamp((frame - spb * 2.6) / 8)}} />)}
      <Flare f={frame - spb} y={1060} color={VIOLET} />
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({frame, t, spb}) => {
  const bounce = Math.abs(Math.sin((frame / spb) * Math.PI)) * 22;
  return (
    <AbsoluteFill>
      <Backdrop color={BLUE} t={t} rays={0.6} cy={800} />
      <Confetti t={frame / 30} />
      <Title text="ANSWER ON" size={150} frame={frame} y={390 - bounce} glow="#1a3cff" />
      <SearchBar frame={frame} at={spb * 0.6} y={590} />
      <Chip text="DAILY CHALLENGE" color={PINK} size={72} x={W / 2} y={780} rot={-4} scale={pop(frame, spb * 1.2, 9, 2.2)} />
      {frame > spb * 2 && <Title text="COMMENT YOUR GUESS" size={92} frame={frame} at={spb * 2} stagger={0.6} y={990} />}
      <FollowButton frame={frame} at={spb * 3.2} y={1270} />
      {frame > spb * 3.6 && <div style={{position: 'absolute', left: W / 2, top: 1440, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 3.6)})`}}>
        <Label text="NEW PUZZLE EVERY DAY" size={62} color="#fff6b0" /></div>}
      {[0, 1, 2, 3, 4, 5].map((j) => {
        const k = pop(frame, spb * 4 + j * 2, 8, 2.4);
        return k > 0 ? <div key={j} style={{position: 'absolute', left: W / 2 + (j - 2.5) * 120, top: 1610 + 14 * Math.sin(t * 4 + j), transform: `translate(-50%,-50%) scale(${k})`}}>
          <Heart full size={96} /></div> : null;
      })}
      {[0, 1].map((j) => <Star key={j} size={80} color="#fff6b0" style={{position: 'absolute', left: j ? 900 : 90, top: 1130 + 24 * Math.sin(t * 3 + j), transform: `rotate(${t * 70}deg)`}} />)}
    </AbsoluteFill>
  );
};

export const Daily: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{d_intro: Intro, d_zoom: Zoom, d_stuck: Stuck, d_shadow: Shadow, d_outro: Outro}} swipeInto={['d_stuck', 'd_shadow', 'd_outro']} />
);
