// "What your MAIN says about you" (2026-11-17): the Roast My Account launch
// Short. Five brawlers, one of the site's own roast lines each, typed into a
// card under the brawler, then a stamp; the ending sends people to /roast.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Arrow, Art, Backdrop, Banner, BrandBug, Burst, Chip, Confetti, Flare, FollowButton, Halo, Label, SearchBar, Star, Title} from './fx';
import {SceneProps, Stage} from './Stage';
import {BODY, DEEP, INK, W, clamp, outBack, outCubic, Plan} from './theme';

const FIRE = ['#ff5a28', '#ff3c64', '#ff8a1e', '#e8366e', '#ff6a3c'];
const STAMPS = ['OUCH', 'BURNED', 'DESTROYED', 'CALLED OUT', 'NO MERCY'];
const pop = (frame: number, at: number, len = 9, s = 2) => outBack((frame - at) / len, s);

/** A small flame, drawn: the headless browser has no emoji font. */
const Flame: React.FC<{size: number; style?: React.CSSProperties}> = ({size, style}) => (
  <svg width={size} height={size * 1.25} viewBox="0 0 80 100" style={style}>
    <path d="M40 4C46 26 70 36 70 64a30 30 0 0 1-60 0c0-14 8-22 14-28 2 10 6 16 12 18C34 38 30 20 40 4z" fill="#ff7a1a" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
    <path d="M40 46c4 10 16 16 16 30a16 16 0 0 1-32 0c0-8 5-12 8-16 1 5 3 8 6 9-1-8 0-15 2-23z" fill="#ffe45a" />
  </svg>
);

const Intro: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const faces: any[] = seg.faces || [];
  return (
    <AbsoluteFill>
      <Backdrop color="#ff5a28" t={t} rays={0.9} cy={1200} />
      <Title text="WHAT YOUR" size={150} frame={frame} y={380} glow="#7a0016" />
      <div style={{position: 'absolute', left: W / 2, top: 610, transform: `translate(-50%,-50%) scale(${1 + 0.8 * (1 - outBack((frame - spb * 0.6) / 12, 1.4)) + 0.03 * Math.sin(t * 8)})`,
        opacity: frame >= spb * 0.6 ? 1 : 0}}>
        <Title text="MAIN" size={330} gold frame={999} x={0} y={0} glow="#7a0016" />
      </div>
      <Burst f={frame - spb * 0.6} x={W / 2} y={610} />
      <Title text="SAYS ABOUT YOU" size={124} frame={frame} at={spb * 1.2} y={850} glow="#7a0016" />
      {faces.map((b, i) => {
        const k = pop(frame, spb * 2 + i * 3, 9, 2.2);
        if (k <= 0) return null;
        const x = W / 2 + (i - 2) * 196;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: 1180 + (i % 2 ? 26 : -26), transform: `translate(-50%,-50%) scale(${k}) rotate(${(i - 2) * 5}deg)`}}>
            <div style={{width: 170, height: 170, borderRadius: 34, overflow: 'hidden', boxShadow: `0 0 0 6px ${INK}, 0 10px 0 6px ${DEEP}`, background: 'linear-gradient(180deg,#ffb27a,#c8321e)'}}>
              {b.face && <Img src={staticFile(b.face)} style={{width: 170, height: 170}} />}
            </div>
            <Flame size={60} style={{position: 'absolute', left: 120, top: -40, transform: `rotate(${8 * Math.sin(t * 9 + i)}deg)`}} />
          </div>
        );
      })}
      {frame > spb * 3 && <Chip text="WE ROASTED THE MOST PICKED" color="#283069" size={56} x={W / 2} y={1460} rot={-3} scale={pop(frame, spb * 3, 9, 2)} />}
    </AbsoluteFill>
  );
};

const Main: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const b = seg.b;
  const c = FIRE[seg.i % FIRE.length];
  const u = (frame - 3) / 12;
  const line: string = seg.line || '';
  const size = line.length <= 70 ? 66 : line.length <= 110 ? 56 : 48;
  const typeAt = spb * 1.1;
  const n = clamp((frame - typeAt) / (line.length / 2.2), 0, 1) * line.length;
  const card = pop(frame, spb * 0.9, 10, 1.6);
  const stampAt = spb * 6.2;
  return (
    <AbsoluteFill>
      <Backdrop color={c} t={t} rays={0.8} cy={780} />
      <BrandBug />
      <Chip text={`${seg.i + 1}/5`} color="#283069" size={50} x={150} y={330} scale={pop(frame, 0)} />
      <Halo x={W / 2} y={760} r={480} color={c} a={0.8} />
      {u > 0 && <div style={{position: 'absolute', left: W / 2, top: 760, transform: `translate(-50%,-50%) translateY(${(1 - outBack(u, 1.4)) * 260}px) scale(${0.6 + 0.4 * outBack(u, 1.6)})`}}>
        <Art src={b.art} size={640} style={{filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
      </div>}
      <Burst f={frame - 3} x={W / 2} y={760} />
      <Banner text={`${b.name} MAINS`} color={c} size={b.name.length <= 7 ? 110 : 88} y={1090} frame={frame} at={5} />
      {card > 0 && (
        <div style={{position: 'absolute', left: W / 2, top: 1420, transform: `translate(-50%,-50%) scale(${card}) rotate(-1.5deg)`, width: 960, padding: '54px 50px 46px',
          borderRadius: 40, background: 'linear-gradient(180deg,#ffffff,#ffeede)', boxShadow: `0 0 0 8px ${INK}, 0 18px 0 8px ${DEEP}`}}>
          <div style={{position: 'absolute', left: 40, top: -38, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 26px 12px 16px', borderRadius: 999,
            background: 'linear-gradient(180deg,#ff9a50,#ff4a1e)', boxShadow: `0 0 0 6px ${INK}`}}>
            <Flame size={40} />
            <Label text="ROAST" size={48} />
          </div>
          <div style={{fontFamily: BODY, fontSize: size, lineHeight: 1.18, color: INK, textAlign: 'center'}}>
            <span>{line.slice(0, Math.floor(n))}</span><span style={{color: 'transparent'}}>{line.slice(Math.floor(n))}</span>
          </div>
        </div>
      )}
      {frame >= stampAt && (
        <div style={{position: 'absolute', left: W / 2 + 120, top: 560, transform: `translate(-50%,-50%) rotate(12deg) scale(${1 + 1.6 * (1 - outBack((frame - stampAt) / 8, 1))})`,
          opacity: clamp((frame - stampAt) / 3), padding: '16px 36px 20px', borderRadius: 28, border: `12px solid #ffe45a`, background: 'rgba(10,12,30,0.55)', boxShadow: `0 0 0 6px ${INK}`}}>
          <Label text={STAMPS[seg.i % STAMPS.length]} size={96} color="#ffe45a" />
        </div>
      )}
      <Flare f={frame - stampAt} y={560} color={c} />
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({frame, t, spb}) => {
  const bounce = Math.abs(Math.sin((frame / spb) * Math.PI)) * 24;
  return (
    <AbsoluteFill>
      <Backdrop color="#ff5a28" t={t} rays={0.7} cy={1100} />
      <Confetti t={frame / 30} />
      <Title text="GET YOUR" size={150} frame={frame} y={360 - bounce} glow="#7a0016" />
      <Title text="OWN ROAST" size={190} gold frame={frame} at={spb * 0.4} y={560 - bounce} glow="#7a0016" />
      <SearchBar frame={frame} at={spb * 0.9} y={790} text="brawlzone.net/roast" height={124} />
      {frame > spb * 1.4 && <Arrow x={W / 2} y={970 + Math.abs(Math.sin(t * 6)) * 30} size={120} />}
      {frame > spb * 1.8 && <div style={{position: 'absolute', left: W / 2, top: 1130, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 1.8)})`}}>
        <Label text="YOUR REAL STATS · A SCORE OUT OF 10" size={50} color="#fff6b0" /></div>}
      <FollowButton frame={frame} at={spb * 2.4} y={1330} />
      {frame > spb * 2.8 && <div style={{position: 'absolute', left: W / 2, top: 1490, transform: 'translate(-50%,-50%)'}}><Label text="COMMENT YOUR MAIN" size={60} color="#ffe45a" /></div>}
      {[0, 1].map((i) => <Flame key={i} size={90} style={{position: 'absolute', left: i ? 860 : 130, top: 930 + 24 * Math.sin(t * 3 + i), transform: `rotate(${10 * Math.sin(t * 6 + i)}deg)`}} />)}
      {[0, 1].map((i) => <Star key={i} size={70} color="#fff6b0" style={{position: 'absolute', left: i ? 880 : 110, top: 1650 + 20 * Math.sin(t * 3 + i), transform: `rotate(${t * 70}deg)`}} />)}
    </AbsoluteFill>
  );
};

export const RoastMains: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{rm_intro: Intro, rm_main: Main, rm_outro: Outro}} swipeInto={['rm_main', 'rm_outro']} />
);
