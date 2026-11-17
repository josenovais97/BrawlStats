// "Season Wrapped" (2026-11-17): a one-off before the Ranked reset. The
// season's picks from the week's Ranked data, then the site's real Season
// Wrapped card in a phone (name and tag painted out by make.py, taped over
// here), then how to get yours.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Arrow, Art, Backdrop, Banner, BrandBug, Burst, Chip, Confetti, Flare, FollowButton, Halo, Label, SearchBar, Star, Title} from './fx';
import {SceneProps, Stage} from './Stage';
import {DEEP, INK, W, clamp, outBack, outCubic, Plan} from './theme';

const PURPLE = '#9a5aff';
const GOLD = '#ffd23f';
const pop = (frame: number, at: number, len = 9, s = 2) => outBack((frame - at) / len, s);

const Note: React.FC<{text: string}> = ({text}) => (
  <div style={{position: 'absolute', left: W / 2, top: 285, transform: 'translate(-50%,-50%)'}}><Label text={text} size={36} color="#efeaff" stroke={5} /></div>
);

const Intro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const leagues: string[] = plan.leagues || [];
  return (
    <AbsoluteFill>
      <Backdrop color={PURPLE} t={t} rays={0.9} cy={1330} />
      <Confetti t={frame / 30} />
      <Title text="SEASON" size={170} frame={frame} y={360} glow="#ff3c8a" />
      <div style={{position: 'absolute', left: W / 2, top: 640, transform: `translate(-50%,-50%) scale(${1 + 0.8 * (1 - outBack((frame - 3) / 12, 1.4)) + 0.03 * Math.sin(t * 8)})`,
        opacity: frame >= 3 ? 1 : 0}}>
        <Title text={String(plan.season || '')} size={420} gold frame={999} x={0} y={0} glow="#ff3c8a" />
      </div>
      <Burst f={frame - 3} x={W / 2} y={640} />
      <Title text="WRAPPED" size={200} frame={frame} at={spb} y={910} glow="#ff3c8a" />
      {leagues.map((src, j) => {
        const k = pop(frame, spb * 1.6 + j * 2.5, 9, 1.8);
        if (k <= 0) return null;
        const ang = (j - (leagues.length - 1) / 2) * 0.36;
        return <Img key={j} src={staticFile(src)} style={{position: 'absolute', left: W / 2 + Math.sin(ang) * 450 - 82, top: 1430 - Math.cos(ang) * 270 - 82,
          width: 165, height: 165, objectFit: 'contain', transform: `scale(${k}) translateY(${8 * Math.sin(t * 4 + j)}px)`}} />;
      })}
      {frame > spb * 2.6 && <Chip text={`ENDS ${plan.ends}`} color="#ff3c64" size={76} x={W / 2} y={1650} rot={-3} scale={pop(frame, spb * 2.6, 9, 2)} />}
    </AbsoluteFill>
  );
};

const Stat: React.FC<SceneProps> = ({plan, seg, frame, t, spb, beat}) => {
  const b = seg.b;
  const c = seg.color;
  const u = (frame - 3) / 12;
  const num = (seg.num || 0) * outCubic((beat - 0.8) / 0.7);
  return (
    <AbsoluteFill>
      <Backdrop color={c} t={t} rays={0.85} cy={1000} />
      <BrandBug />
      <Note text={`SEASON ${plan.season} · FINAL WEEK OF RANKED`} />
      <Title text={seg.head} size={seg.head2 ? 118 : 130} frame={frame} y={410} glow={DEEP} />
      {seg.head2 && <Title text={seg.head2} size={118} gold frame={frame} at={4} y={540} glow={DEEP} />}
      <Halo x={W / 2} y={1010} r={540} color={c} a={0.8} />
      {u > 0 && <div style={{position: 'absolute', left: W / 2, top: 1010, transform: `translate(-50%,-50%) translateY(${(1 - outBack(u, 1.4)) * 280}px) scale(${0.6 + 0.4 * outBack(u, 1.6)})`}}>
        <Art src={b.art} size={760} style={{filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
      </div>}
      <Burst f={frame - 3} x={W / 2} y={1010} />
      <Banner text={b.name} color={c} size={b.name.length <= 8 ? 140 : 112} y={1440} frame={frame} at={5} />
      {beat >= 0.8 && (
        <div style={{position: 'absolute', left: W / 2, top: 1610, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 0.8)})`, display: 'flex', alignItems: 'center', gap: 18,
          padding: '14px 34px 16px', borderRadius: 999, background: 'rgba(10,12,30,0.82)', boxShadow: `0 0 0 5px ${INK}, 0 10px 0 5px ${DEEP}`}}>
          <Label text={seg.label} size={44} color="#cfd6ff" stroke={0} />
          <Label text={`${num.toFixed(1)}%`} size={64} color={seg.tint || '#fff'} />
        </div>
      )}
      {seg.stamp && frame >= spb * 1.8 && (
        <div style={{position: 'absolute', left: W / 2 + 60, top: 1150, transform: `translate(-50%,-50%) rotate(-12deg) scale(${1 + 1.6 * (1 - outBack((frame - spb * 1.8) / 8, 1))})`,
          opacity: clamp((frame - spb * 1.8) / 3), padding: '18px 40px 22px', borderRadius: 30, border: `14px solid ${seg.tint}`, background: 'rgba(10,12,30,0.55)', boxShadow: `0 0 0 6px ${INK}`}}>
          <Label text={seg.stamp} size={110} color={seg.tint} />
        </div>
      )}
      <Flare f={frame - spb * 1.8} y={1150} color={c} />
    </AbsoluteFill>
  );
};

// The card is 1080 x 1700 (make.py crops the story's empty foot); these are
// its boxes in card pixels, from the season-story route's layout.
const CARD_W = 1080, CARD_H = 1700, K = 0.56;
const BOXES: [number, number, number, number, string][] = [
  [84, 503, 912, 193, 'YOUR RANK'],
  [84, 720, 912, 328, 'YOUR STATS'],
  [84, 1085, 912, 330, 'YOUR MAINS'],
];

const Card: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const u = (frame - 4) / 14;
  // the phone sits left so the labels fit beside it on the right
  const left = 76, top = 650;
  const tape = frame - spb * 0.9;
  return (
    <AbsoluteFill>
      <Backdrop color={PURPLE} t={t} rays={0.7} cy={1150} />
      <BrandBug />
      <Title text="YOUR SEASON" size={120} frame={frame} y={340} glow="#ff3c8a" />
      <Title text="WRAPPED" size={170} gold frame={frame} at={spb * 0.4} y={500} glow="#ff3c8a" />
      <Halo x={W / 2} y={1150} r={620} color="#ffffff" a={0.35} />
      {u > 0 && (
        <div style={{position: 'absolute', left: left - 16, top: top - 16, transform: `translateY(${(1 - outBack(u, 1.2)) * 1300}px) rotate(${(1 - outCubic(u)) * 8}deg)`,
          padding: 16, borderRadius: 56, background: 'linear-gradient(180deg,#2a2f4a,#11142a)', boxShadow: `0 0 0 8px ${INK}, 0 22px 0 8px ${DEEP}`}}>
          <div style={{position: 'relative', width: CARD_W * K, height: CARD_H * K, borderRadius: 40, overflow: 'hidden'}}>
            <div style={{position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H, transform: `scale(${K})`, transformOrigin: '0 0'}}>
              <Img src={staticFile(plan.card)} style={{width: CARD_W, height: CARD_H}} />
              {BOXES.map(([x, y, w, h], i) => {
                const f = frame - spb * (1.7 + i * 0.8);
                if (f < 0) return null;
                const on = f < spb * 0.8;
                return <div key={i} style={{position: 'absolute', left: x - 10, top: y - 10, width: w + 20, height: h + 20, borderRadius: 36,
                  boxShadow: on ? `0 0 0 ${10 + 4 * Math.sin(f / 2)}px ${GOLD}, 0 0 0 26px rgba(255,210,63,0.3)` : `0 0 0 6px rgba(255,210,63,0.5)`}} />;
              })}
              {tape >= 0 && (
                <div style={{position: 'absolute', left: 230, top: 96, width: 800, height: 140, transform: `rotate(-3deg) scale(${1 + 0.8 * (1 - outBack(tape / 8, 1.2))})`,
                  borderRadius: 10, background: `repeating-linear-gradient(135deg, ${GOLD} 0 46px, #ffbf1f 46px 92px)`, boxShadow: `0 0 0 6px ${INK}, 0 10px 0 6px rgba(0,0,0,0.35)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <Label text="YOUR NAME HERE" size={84} color={INK} stroke={0} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {BOXES.map(([, y, , h, label], i) => {
        const at = spb * (1.7 + i * 0.8);
        if (frame < at) return null;
        return <Chip key={i} text={label} color="#ff3c64" size={40} x={885} y={top + (y + h / 2) * K} rot={i % 2 ? -5 : 5} scale={pop(frame, at, 8, 2.2)} />;
      })}
      {[0, 1, 2].map((i) => <Star key={i} size={70} color="#fff6b0" style={{position: 'absolute', left: [900, 960, 880][i], top: [680, 1250, 1600][i] + 26 * Math.sin(t * 3 + i),
        transform: `rotate(${t * 80}deg)`}} />)}
    </AbsoluteFill>
  );
};

const How: React.FC<SceneProps> = ({frame, t, spb}) => {
  const steps = ['GO TO', 'TYPE YOUR', 'OPEN RANKED, TAP'];
  return (
    <AbsoluteFill>
      <Backdrop color={PURPLE} t={t} rays={0.4} />
      <BrandBug />
      <Title text="HOW TO GET IT" size={136} gold frame={frame} y={390} glow="#ff3c8a" />
      {steps.map((a, i) => {
        const at = spb * 0.6 + i * spb * 1.5;
        if (frame < at) return null;
        const y = 720 + i * 360;
        const press = frame - at - spb * 0.9;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: 150, top: y, transform: `translate(-50%,-50%) scale(${pop(frame, at, 9, 2.2)})`, width: 180, height: 180, borderRadius: '50%',
              background: 'linear-gradient(180deg,#ff7a9a,#ff2f5c)', boxShadow: `0 0 0 8px ${INK}, 0 14px 0 8px ${DEEP}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Label text={String(i + 1)} size={120} /></div>
            <div style={{position: 'absolute', left: 620, top: y - 70, transform: `translate(-50%,-50%) scale(${pop(frame, at + 3)})`}}><Label text={a} size={60} color="#e2d8ff" /></div>
            {i === 0 && <SearchBar frame={frame} at={at + 4} x={640} y={y + 30} width={760} height={100} />}
            {i === 1 && <div style={{position: 'absolute', left: 620, top: y + 30, transform: `translate(-50%,-50%) scale(${pop(frame, at + 5)})`}}><Label text="PLAYER TAG" size={104} /></div>}
            {i === 2 && <div style={{position: 'absolute', left: 620, top: y + 40, transform: `translate(-50%,-50%) scale(${pop(frame, at + 5) * (press >= 0 && press < 5 ? 0.92 : 1)})`,
              padding: '20px 44px 24px', borderRadius: 999, background: 'linear-gradient(180deg,#fff2a0,#ffd23f 50%,#f0a81a)',
              boxShadow: `0 0 0 6px ${INK}, 0 ${press >= 0 && press < 5 ? 4 : 12}px 0 6px ${DEEP}, inset 0 4px 0 rgba(255,255,255,0.5)`}}>
              <Label text="SHARE MY SEASON" size={66} color={INK} stroke={0} /></div>}
            {i === 2 && press >= 0 && press < 22 && <div style={{position: 'absolute', left: 620 - 30 - press * 6, top: y + 10 - press * 6, width: 60 + press * 12, height: 60 + press * 12,
              borderRadius: '50%', border: `8px solid rgba(255,255,255,${1 - press / 22})`}} />}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const bounce = Math.abs(Math.sin((frame / spb) * Math.PI)) * 24;
  const before = plan.days === 1 ? 'BEFORE TOMORROW' : `BEFORE ${plan.ends}`;
  return (
    <AbsoluteFill>
      <Backdrop color={PURPLE} t={t} rays={0.7} cy={1100} />
      <Confetti t={frame / 30} />
      <Title text="GET YOURS" size={210} gold frame={frame} y={420 - bounce} glow="#ff3c8a" />
      <Title text={before} size={104} frame={frame} at={spb * 0.5} stagger={0.6} y={610} />
      <SearchBar frame={frame} at={spb * 0.9} y={800} height={130} />
      {frame > spb * 1.4 && <Arrow x={W / 2} y={990 + Math.abs(Math.sin(t * 6)) * 30} size={130} />}
      <FollowButton frame={frame} at={spb * 2.2} y={1290} />
      {frame > spb * 2.6 && <div style={{position: 'absolute', left: W / 2, top: 1440, transform: 'translate(-50%,-50%)'}}><Label text="FREE · ANY PLAYER TAG · NO LOGIN" size={50} color="#ffe45a" /></div>}
      {[0, 1].map((i) => <Star key={i} size={80} color="#fff6b0" style={{position: 'absolute', left: i ? 900 : 90, top: 680 + 30 * Math.sin(t * 3 + i), transform: `rotate(${t * 70}deg)`}} />)}
    </AbsoluteFill>
  );
};

export const Wrapped: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{w_intro: Intro, w_stat: Stat, w_card: Card, w_how: How, w_outro: Outro}} swipeInto={['w_stat', 'w_card', 'w_how', 'w_outro']} />
);
