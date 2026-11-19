// The weekly Ranked meta video (Mondays, ~3.5 min, YouTube) in the Remotion
// look (2026-11-18). Same sections as weekly.py's Pillow scenes: the top 10,
// the three best picks on every live map, climbers and fallers, what each
// rank picks, and the links. Content from weekly.py --plan.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Art, Backdrop, Banner, BrandBug, Burst, Chip, Confetti, Flare, FollowButton, Halo, InlineTitle, Label, SearchBar, Star, Title} from './fx';
import {Face, pop} from './Formats';
import {SceneProps, Stage} from './Stage';
import {TierBadge, TierChange} from './Tier';
import {DEEP, INK, TIER, W, clamp, mix, outBack, outCubic, shade, Plan} from './theme';

const ORANGE = '#ffaa28', VIOLET = '#965aff', UP = '#3cdc78', DOWN = '#ff465a';
const MEDAL = ['#ffd23f', '#d6dcf0', '#ff9a4a'];

const Intro: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const faces: string[] = seg.faces || [];
  return (
    <AbsoluteFill>
      <Backdrop color={ORANGE} t={t} rays={0.6} cy={1400} />
      {faces.map((f, j) => {
        const k = outBack((frame - j * 2 + 2) / 10, 1.8);
        if (k <= 0) return null;
        const ang = (j - (faces.length - 1) / 2) * 0.2;
        return (
          <div key={j} style={{position: 'absolute', left: W / 2 + Math.sin(ang) * 520, top: 1720 - Math.cos(ang) * 340 + 10 * Math.sin(t * 3 + j),
            transform: `translate(-50%,-50%) rotate(${ang * 40}deg) scale(${k})`}}>
            <Face src={f} size={150} color={ORANGE} />
          </div>
        );
      })}
      <Title text="RANKED META" size={150} frame={frame} y={470} glow="#a03000" />
      <Title text="THIS WEEK" size={210} gold frame={frame} at={spb} y={680} glow="#a03000" />
      {frame > spb * 2 && <Chip text={plan.season ? `SEASON ${plan.season} · ${plan.week}` : plan.week} color="#16182a" textColor="#ffe45a" size={56} x={W / 2} y={900} scale={pop(frame, spb * 2)} />}
      {frame > spb * 3.2 && <div style={{position: 'absolute', left: W / 2, top: 1060, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 3.2)})`}}>
        <Label text="TOP 10 · EVERY MAP · CLIMBERS · BY RANK" size={50} /></div>}
    </AbsoluteFill>
  );
};

const Head: React.FC<SceneProps> = ({seg, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={seg.col} t={t} rays={1} cy={900} />
    <Title text={seg.title} size={seg.title.length <= 8 ? 250 : 190} gold frame={frame} y={830} glow={shade(seg.col, 0.45)} />
    <Burst f={frame} x={W / 2} y={830} />
    {frame > spb * 0.7 && <div style={{position: 'absolute', left: W / 2, top: 1050, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 0.7)})`}}>
      <Label text={seg.sub} size={seg.sub.length < 28 ? 64 : 54} /></div>}
  </AbsoluteFill>
);

const Top: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const b = seg.b;
  const col = TIER[b.tier] || ORANGE;
  const u = frame / 12;
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={0.9} cy={1000} />
      <BrandBug y={190} />
      <Halo x={W / 2} y={1000} r={560} color={mix(col, '#ffffff', 0.3)} a={0.85} />
      <div style={{position: 'absolute', left: W / 2, top: 1000, transform: `translate(-50%,-50%) scale(${1 + 0.4 * (1 - outBack(u, 1.6))})`}}>
        <Art src={b.art} size={900} style={{filter: 'drop-shadow(0 24px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <Burst f={frame} x={W / 2} y={1000} />
      <div style={{position: 'absolute', left: 230 - 460 * (1 - outBack(u, 1.2)), top: 400, transform: 'translate(-50%,-50%) rotate(-6deg)'}}>
        <Title text={`#${seg.rank}`} size={seg.rank === 1 ? 250 : 220} gold frame={999} x={0} y={0} />
      </div>
      <div style={{position: 'absolute', left: W - 220 + 480 * (1 - outBack((frame - 3) / 12, 1.2)), top: 400, transform: 'translate(-50%,-50%) rotate(5deg)'}}>
        <TierBadge tier={b.tier} size={190} />
      </div>
      <Banner text={b.name} color={col} size={b.name.length <= 8 ? 150 : 116} y={1560} frame={frame} at={3} />
      {seg.rank === 1 && frame > spb * 2 && <Confetti t={(frame - spb * 2) / 30} />}
      <Flare f={frame} y={1000} color={col} />
    </AbsoluteFill>
  );
};

/** One pick on a map: the art over a medal-coloured plinth with its rank and name. */
const Pick: React.FC<{b: any; rank: number; f: number; x: number; y: number; big?: boolean}> = ({b, rank, f, x, y, big}) => {
  const k = outBack(f / 11, 1.9);
  if (k <= 0) return null;
  const w = big ? 330 : 290;
  const m = MEDAL[rank - 1];
  return (
    <div style={{position: 'absolute', left: x, top: y + 200 * (1 - outCubic(f / 11)), transform: `translate(-50%,-50%) scale(${k})`, width: w, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{height: big ? 380 : 330, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'}}>
        <Img src={staticFile(b.art)} style={{maxWidth: w + 30, maxHeight: big ? 380 : 330, objectFit: 'contain', filter: 'drop-shadow(0 14px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <div style={{position: 'relative', marginTop: -10, width: w, padding: '18px 0 20px', borderRadius: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        background: `linear-gradient(180deg, ${mix(m, '#fff', 0.35)}, ${m} 50%, ${shade(m, 0.7)})`, boxShadow: `0 0 0 7px ${INK}, 0 12px 0 7px ${DEEP}, inset 0 5px 0 rgba(255,255,255,0.4)`}}>
        <InlineTitle text={`#${rank}`} size={big ? 74 : 62} />
        <Label text={b.name.length > 10 ? b.name.slice(0, 10) : b.name} size={b.name.length > 8 ? 38 : 46} />
      </div>
    </div>
  );
};

const MapScene: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const name: string = seg.map;
  return (
    <AbsoluteFill>
      <Backdrop color={seg.col} t={t} rays={0.6} cy={1000} />
      <BrandBug y={190} />
      {seg.icon && <Img src={staticFile(seg.icon)} style={{position: 'absolute', left: W / 2 - 360, top: 640, width: 720, height: 720, objectFit: 'contain', opacity: 0.13,
        transform: `rotate(${-8 + 4 * Math.sin(t)}deg)`}} />}
      <div style={{position: 'absolute', left: W / 2, top: 340, transform: `translate(-50%,-50%) scale(${pop(frame, 0, 9, 2)})`, display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 32px 12px 12px', borderRadius: 999, background: `linear-gradient(180deg, ${mix(seg.col, '#fff', 0.3)}, ${seg.col} 55%, ${shade(seg.col, 0.7)})`,
        boxShadow: `0 0 0 6px ${INK}, 0 10px 0 6px ${DEEP}`}}>
        {seg.icon && <Img src={staticFile(seg.icon)} style={{width: 84, height: 84, objectFit: 'contain'}} />}
        <Label text={seg.mode} size={54} />
      </div>
      <Title text={name} size={name.length <= 12 ? 130 : name.length <= 17 ? 100 : 80} frame={frame} at={3} stagger={0.8} y={510} glow={shade(seg.col, 0.45)} />
      <Halo x={W / 2} y={1000} r={520} color={mix(seg.col, '#ffffff', 0.35)} a={0.7} />
      <Pick b={seg.picks[1]} rank={2} f={frame - spb * 1.1} x={W / 2 - 340} y={1040} />
      <Pick b={seg.picks[2]} rank={3} f={frame - spb * 1.5} x={W / 2 + 340} y={1040} />
      <Pick b={seg.picks[0]} rank={1} f={frame - spb * 1.9} x={W / 2} y={980} big />
      <Burst f={frame - spb * 1.9} x={W / 2} y={900} />
      {frame > spb * 3 && <div style={{position: 'absolute', left: W / 2, top: 1420, transform: 'translate(-50%,-50%)', opacity: clamp((frame - spb * 3) / 8)}}>
        <Label text={`FROM ${Number(seg.n).toLocaleString('en-US')} RANKED BATTLES`} size={48} /></div>}
    </AbsoluteFill>
  );
};

const Move: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const r = seg.r;
  const good = seg.dir === 'up';
  const col = good ? UP : DOWN;
  const u = frame / 12;
  const v = r.d * outCubic((frame - spb) / 20);
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={0.8} cy={1000} />
      <BrandBug y={190} />
      <Title text={good ? 'CLIMBING' : 'FALLING'} size={140} frame={frame} y={380} color={mix(col, '#ffffff', 0.4)} glow={shade(col, 0.4)} />
      <Halo x={W / 2} y={1000} r={520} color={mix(col, '#ffffff', 0.3)} a={0.8} />
      <div style={{position: 'absolute', left: W / 2, top: 1000 + (good ? 0 : 40 * outCubic(frame / (spb * 5))), transform: `translate(-50%,-50%) scale(${1 + 0.4 * (1 - outBack(u, 1.6))})`}}>
        <Art src={r.art} size={820} style={{filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <Burst f={frame} x={W / 2} y={1000} />
      <Banner text={r.name} color={good ? '#2aa85a' : '#c8283c'} size={r.name.length <= 8 ? 140 : 110} y={1500} frame={frame} at={3} />
      {frame > spb && <div style={{position: 'absolute', left: W / 2, top: 1680, transform: `translate(-50%,-50%) scale(${pop(frame, spb)})`}}>
        <Label text={`${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}% WIN RATE`} size={86} color={good ? '#b6ffcc' : '#ffc0c8'} /></div>}
      {r.was !== r.tier && <TierChange was={r.was} now={r.tier} f={frame - spb * 1.8} y={600} size={130} />}
    </AbsoluteFill>
  );
};

const Rank: React.FC<SceneProps> = ({seg, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={VIOLET} t={t} rays={0.6} cy={1100} />
    <BrandBug y={190} />
    <Title text={seg.label} size={124} gold frame={frame} y={380} glow="#3a0f9a" />
    {frame > spb * 0.6 && <div style={{position: 'absolute', left: W / 2, top: 530, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 0.6)})`}}>
      <Label text="MOST PICKED RIGHT NOW" size={60} /></div>}
    {seg.top.map((b: any, j: number) => {
      const u = (frame - spb - j * spb * 0.3) / 11;
      if (u <= 0) return null;
      return (
        <div key={j} style={{position: 'absolute', left: W / 2 + 900 * (1 - outBack(u, 1.3)), top: 760 + j * 210, transform: 'translate(-50%,-50%)', width: 900, height: 180,
          borderRadius: 40, display: 'flex', alignItems: 'center', gap: 30, padding: '0 22px', background: j === 0 ? 'linear-gradient(180deg,#7a5cff,#3c2a9a)' : 'linear-gradient(180deg,#4a3aa8,#2b2166)',
          boxShadow: `0 0 0 7px ${INK}, 0 12px 0 7px ${DEEP}, inset 0 5px 0 rgba(255,255,255,0.25)`}}>
          <Face src={b.face} size={140} color={TIER[b.tier] || VIOLET} />
          <Label text={`#${j + 1}`} size={78} color={MEDAL[j] || '#ffffff'} />
          <Label text={b.name} size={b.name.length > 10 ? 62 : 76} />
          {b.tier && <div style={{marginLeft: 'auto'}}><TierBadge tier={b.tier} size={110} /></div>}
        </div>
      );
    })}
  </AbsoluteFill>
);

const LINKS = ['FULL TIER LIST FOR YOUR RANK', 'DRAFT HELPER & COUNTERS', 'FREE REWARDS', 'GIVEAWAY: WIN THE BRAWL PASS'];

const Outro: React.FC<SceneProps> = ({frame, t, spb}) => {
  const bounce = Math.abs(Math.sin((frame / (spb * 2)) * Math.PI)) * 22;
  return (
    <AbsoluteFill>
      <Backdrop color={ORANGE} t={t} rays={0.6} cy={700} />
      <Confetti t={frame / 30} />
      <Title text="LINKS IN THE" size={130} frame={frame} y={360 - bounce} glow="#a03000" />
      <Title text="DESCRIPTION" size={170} gold frame={frame} at={spb * 0.5} y={530 - bounce} glow="#a03000" />
      {LINKS.map((l, j) => (
        <Chip key={j} text={l} color="#16182a" textColor="#ffe45a" size={52} x={W / 2} y={740 + j * 135} rot={j % 2 ? 1.5 : -1.5} scale={pop(frame, spb * (1.2 + j * 0.4))} />
      ))}
      <FollowButton frame={frame} at={spb * 3.4} y={1360} />
      {frame > spb * 3.8 && <div style={{position: 'absolute', left: W / 2, top: 1510, transform: 'translate(-50%,-50%)'}}><Label text="NEW META VIDEO EVERY MONDAY" size={54} color="#fff6b0" /></div>}
      <SearchBar frame={frame} at={spb * 4.2} y={1680} />
      {[0, 1].map((i) => <Star key={i} size={80} color="#fff6b0" style={{position: 'absolute', left: i ? 900 : 90, top: 1240 + 30 * Math.sin(t * 3 + i), transform: `rotate(${t * 70}deg)`}} />)}
    </AbsoluteFill>
  );
};

export const Weekly: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{w_intro: Intro, w_head: Head, w_top: Top, w_map: MapScene, w_move: Move, w_rank: Rank, w_outro: Outro}}
    swipeInto={['w_head', 'w_outro']} />
);
