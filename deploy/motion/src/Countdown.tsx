// The countdowns (everyrank, classrank, seasonclimb) in the Remotion look
// (2026-11-13): tier slams, pages of cards dealt in, the top 20 in rows, then
// the top ten one at a time on a sports-graphics stage, and #1 with a crown.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Arrow, Art, Backdrop, Banner, BrandBug, Burst, Chip, Confetti, Crown, FollowButton, Label, SearchBar, Star, Title} from './fx';
import {SceneProps, Stage} from './Stage';
import {DEEP, HEAD, INK, TIER, W, mix, outBack, outCubic, pct, shade, Plan} from './theme';

const ORANGE = '#ff9a28';

const Intro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const climb = plan.kind === 'seasonclimb';
  const word = plan.word || 'BRAWLER';
  const wall = plan.wall || [];
  const cols = 8, size = 180;
  const rows = Math.ceil(Math.max(wall.length, 40) / cols) + 2;
  return (
    <AbsoluteFill>
      <Backdrop color={ORANGE} t={t} rays={0.5} />
      <div style={{position: 'absolute', left: -380, top: -300 - ((t * 60) % size), width: cols * size + 600, transform: 'rotate(-14deg)', opacity: 0.32,
        display: 'flex', flexWrap: 'wrap'}}>
        {Array.from({length: cols * rows}, (_, i) => (
          <Img key={i} src={staticFile(wall[i % Math.max(1, wall.length)])} style={{width: size - 14, height: size - 14, margin: 7, borderRadius: 28}} />
        ))}
      </div>
      <AbsoluteFill style={{background: 'radial-gradient(70% 45% at 50% 40%, rgba(0,0,0,0.35), transparent 70%)'}} />
      <Title text={climb ? 'NEW' : 'EVERY'} size={190} frame={frame} y={360} />
      <Title text={climb ? 'SEASON' : word} size={word.length > 8 ? 150 : 190} frame={frame} at={spb} y={560} />
      <Title text={climb ? 'TOP 10' : 'RANKED'} size={250} frame={frame} at={spb * 2} gold y={800} />
      {frame > spb * 3 && (climb
        ? <Chip text="BEST TO CLIMB" color="#3cd26e" size={80} x={W / 2} y={1050} scale={outBack((frame - spb * 3) / 9, 2)} />
        : <>
            <Chip text="WORST" color="#ff3c5a" size={78} x={W / 2 - 250 - 260 * (1 - outBack((frame - spb * 3) / 10))} y={1050} />
            <Arrow x={W / 2} y={1050} size={120} color="#fff" />
            <Chip text="BEST" color="#3cd26e" size={78} x={W / 2 + 260 + 260 * (1 - outBack((frame - spb * 3) / 10))} y={1050} />
          </>)}
      {frame > spb * 4 && <Title text={climb ? "FROM THIS WEEK'S RANKED GAMES" : `THIS WEEK IN RANKED · SEASON ${plan.season}`} size={52} gold frame={frame} at={spb * 4} stagger={0.4} y={1220} />}
      {frame > spb * 4.5 && <div style={{position: 'absolute', left: W / 2, top: 1390, transform: `translate(-50%,-50%) scale(${1 + 0.06 * Math.sin(t * 10)})`}}>
        <Label text="wait for #1..." size={90} /></div>}
    </AbsoluteFill>
  );
};

const Slam: React.FC<SceneProps> = ({seg, frame, t}) => {
  const col = TIER[seg.tier] || ORANGE;
  const big = seg.label ? seg.label.split(' ').pop() : seg.tier;
  const k = outBack(frame / 10, 1.2);
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={1} cy={860} />
      <BrandBug />
      <div style={{position: 'absolute', left: W / 2, top: 860, transform: `translate(-50%,-50%) scale(${1 + 2.4 * (1 - k)}) rotate(${(1 - k) * -12}deg)`}}>
        <Title text={big} size={seg.label ? 420 : 560} frame={999} color={col} x={0} y={0} />
      </div>
      <Burst f={frame - 4} x={W / 2} y={860} color={mix(col, '#fff', 0.5)} />
      <Title text={seg.label || `${seg.tier} TIER`} size={110} frame={frame} at={4} y={1240} />
    </AbsoluteFill>
  );
};

const Card: React.FC<{b: any; w?: number}> = ({b, w = 290}) => {
  const col = TIER[b.tier] || '#9669ff';
  const h = w * 1.22;
  return (
    <div style={{position: 'relative', width: w, height: h, borderRadius: 38, padding: 12,
      background: `linear-gradient(180deg, ${mix(col, '#fff', 0.45)} 0%, ${col} 45%, ${shade(col, 0.55)} 100%)`,
      boxShadow: `0 0 0 7px ${INK}, 0 14px 0 7px ${DEEP}, inset 0 5px 0 rgba(255,255,255,0.4)`}}>
      <div style={{width: w - 24, height: w - 24, borderRadius: 28, overflow: 'hidden', boxShadow: `0 0 0 5px ${INK}`, background: '#1a1f48'}}>
        {b.face && <Img src={staticFile(b.face)} style={{width: '100%', height: '100%'}} />}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 16, textAlign: 'center'}}>
        <Label text={b.name.length > 10 ? b.name.slice(0, 10) : b.name} size={b.name.length > 8 ? 34 : 42} />
      </div>
      <div style={{position: 'absolute', left: -14, top: -16, padding: '6px 14px 8px', borderRadius: 16, background: INK, boxShadow: `0 0 0 4px #ffb21e`}}>
        <Label text={`#${b.rank}`} size={40} color="#ffe45a" stroke={0} />
      </div>
    </div>
  );
};

const Page: React.FC<SceneProps> = ({seg, frame, t}) => {
  const col = TIER[seg.tier] || ORANGE;
  const items = seg.items;
  const rows = Math.ceil(items.length / 3);
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={0.35} />
      <BrandBug />
      <Title text={`${seg.tier} TIER`} size={96} color={col} frame={frame} y={340} />
      {items.map((b: any, j: number) => {
        const r = Math.floor(j / 3), c = j % 3, inRow = Math.min(3, items.length - r * 3);
        const x = W / 2 + (c - (inRow - 1) / 2) * 320;
        const y = 1000 - (rows - 1) * 205 + r * 410;
        const u = (frame - j * 2.2) / 10;
        if (u <= 0) return null;
        return (
          <div key={j} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) perspective(1200px) translateY(${(1 - outCubic(u)) * 500}px) rotateZ(${(1 - outCubic(u)) * (c - 1) * 30}deg) rotateX(${(1 - outCubic(u)) * 50}deg) scale(${outBack(u, 2)})`}}>
            <Card b={b} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Rows: React.FC<SceneProps> = ({seg, frame, t}) => (
  <AbsoluteFill>
    <Backdrop color={TIER[seg.items[0]?.tier] || ORANGE} t={t} rays={0.35} />
    <BrandBug />
    <Title text={seg.label} size={96} gold frame={frame} y={340} />
    {seg.items.map((b: any, j: number) => {
      const u = (frame - j * 3) / 11;
      if (u <= 0) return null;
      const col = TIER[b.tier] || '#9669ff';
      return (
        <div key={j} style={{position: 'absolute', left: W / 2 + 1000 * (1 - outBack(u, 1.3)), top: 560 + j * 240, transform: 'translate(-50%,-50%) skewX(-6deg)',
          width: 940, height: 200, borderRadius: 34, display: 'flex', alignItems: 'center',
          background: `linear-gradient(100deg, ${mix(col, '#fff', 0.35)} 0%, ${col} 40%, ${shade(col, 0.5)} 100%)`,
          boxShadow: `0 0 0 7px ${INK}, 0 14px 0 7px ${DEEP}, inset 0 6px 0 rgba(255,255,255,0.35)`}}>
          <div style={{marginLeft: 18, width: 168, height: 168, borderRadius: 30, overflow: 'hidden', boxShadow: `0 0 0 5px ${INK}`, transform: 'skewX(6deg)'}}>
            {b.face && <Img src={staticFile(b.face)} style={{width: 168, height: 168}} />}
          </div>
          <div style={{marginLeft: 28, display: 'flex', flexDirection: 'column', transform: 'skewX(6deg)'}}>
            <Label text={`#${b.rank}`} size={54} color="#ffe45a" />
            <div style={{marginTop: 8}}><Label text={b.name} size={b.name.length > 10 ? 62 : 80} /></div>
          </div>
          <div style={{position: 'absolute', right: 26, top: 22, width: 156, height: 156, borderRadius: '50%', background: INK, display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: `0 0 0 6px ${mix(col, '#fff', 0.5)}`, transform: 'skewX(6deg)'}}>
            <span style={{fontFamily: HEAD, fontSize: 110, color: col, lineHeight: 1, paddingTop: 8}}>{b.tier}</span>
          </div>
        </div>
      );
    })}
  </AbsoluteFill>
);

const Big: React.FC<SceneProps> = ({seg, frame, t, plan}) => {
  const b = seg.b;
  const one = seg.kind === 'c_one';
  const col = one ? '#ffb21e' : TIER[b.tier] || ORANGE;
  const u = frame / 12;
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={one || seg.heavy ? 1 : 0.7} cy={1020} />
      {one && <Confetti t={frame / 30} />}
      <BrandBug />
      {/* the rank, huge and hollow behind the brawler */}
      <div style={{position: 'absolute', left: W / 2, top: 1000, transform: `translate(-50%,-50%) scale(${1.3 - 0.3 * outCubic(u)})`, fontFamily: HEAD,
        fontSize: 860, lineHeight: 1, color: 'transparent', WebkitTextStroke: '14px rgba(255,255,255,0.28)', whiteSpace: 'nowrap'}}>#{seg.rank}</div>
      <div style={{position: 'absolute', left: W / 2, top: 1010, transform: `translate(-50%,-50%) translateY(${(1 - outBack(u, 1.4)) * 300}px) scale(${0.6 + 0.4 * outBack(u, 1.6)})`}}>
        <Art src={b.art} size={one ? 1000 : 940} style={{filter: 'drop-shadow(0 24px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <Burst f={frame - 2} x={W / 2} y={1000} color={one ? '#fff6b0' : mix(col, '#fff', 0.5)} />
      {one ? (
        <>
          <div style={{position: 'absolute', left: W / 2, top: 500 + 16 * Math.sin(t * 5), transform: `translate(-50%,-50%) translateY(${(1 - outBack((frame - 4) / 12, 1.5)) * -500}px)`}}>
            <Crown size={260} />
          </div>
          <Title text="#1" size={230} gold frame={frame} y={560} x={210} />
          <Title text={plan.bestLine || 'THE BEST'} size={80} gold frame={frame} at={3} stagger={0.5} y={340} />
        </>
      ) : (
        <>
          <Title text={`#${seg.rank}`} size={210} gold frame={frame} x={220} y={450} />
          <Chip text={`${b.tier} TIER`} color={col} size={60} x={W - 230} y={450} scale={outBack((frame - 3) / 9, 2)} rot={6} />
        </>
      )}
      <Banner text={b.name} color={one ? '#ff3c64' : col} size={b.name.length <= 7 ? 140 : 118} y={1560} frame={frame} at={4} />
      {b.wr != null && (
        <div style={{position: 'absolute', left: W / 2, top: 1715, transform: `translate(-50%,-50%) scale(${outBack((frame - 9) / 9, 1.8)})`,
          display: 'flex', alignItems: 'center', gap: 16, padding: '12px 30px 14px', borderRadius: 999, background: 'rgba(10,12,30,0.78)', boxShadow: `0 0 0 5px ${INK}`}}>
          <Label text="WIN RATE" size={44} color="#cfd6ff" stroke={0} />
          <Label text={pct(b.wr)} size={60} color={b.wr >= 0.5 ? '#7cff8a' : '#ff7a8a'} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const Tease: React.FC<SceneProps> = ({plan, seg, frame, beat, t}) => {
  const pulse = 1 + 0.06 * Math.max(0, 1 - (beat % 1) / 0.35);
  return (
    <AbsoluteFill>
      <Backdrop color="#2c2c7a" t={t} rays={0.6} dark cy={1250} />
      <BrandBug />
      <div style={{position: 'absolute', inset: 0, transform: `scale(${pulse})`}}>
        <Title text="AND THE BEST" size={130} frame={frame} y={430} />
        <Title text={`${plan.word || 'BRAWLER'} IS...`} size={124} gold frame={frame} at={4} y={600} />
        <Img src={staticFile(seg.sil)} style={{position: 'absolute', left: W / 2, top: 1270, transform: 'translate(-50%,-50%)', maxWidth: 900, maxHeight: 900}} />
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = t * 1.6 + (i * Math.PI) / 3;
        return <div key={i} style={{position: 'absolute', left: W / 2 + Math.cos(a) * 470 - 50, top: 1270 + Math.sin(a) * 300 - 60}}>
          <Title text="?" size={120} gold frame={999} x={50} y={60} /></div>;
      })}
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({frame, t, spb}) => {
  const bounce = Math.abs(Math.sin((frame / spb) * Math.PI)) * 26;
  return (
    <AbsoluteFill>
      <Backdrop color={ORANGE} t={t} rays={0.6} cy={700} />
      <Title text="WHERE'S YOUR" size={120} frame={frame} y={440 - bounce * 0.4} />
      <Title text="MAIN?" size={300} gold frame={frame} at={spb * 0.3} y={680 - bounce} />
      <Title text="COMMENT BELOW" size={96} frame={frame} at={spb} stagger={0.6} y={960} />
      {frame > spb * 1.3 && <Arrow x={W / 2} y={1120 + Math.abs(Math.sin(t * 6)) * 30} size={150} />}
      <FollowButton frame={frame} at={spb * 2.2} y={1320} />
      {frame > spb * 2.6 && <div style={{position: 'absolute', left: W / 2, top: 1460, transform: 'translate(-50%,-50%)'}}><Label text="FULL TIER LIST ON" size={52} /></div>}
      <SearchBar frame={frame} at={spb * 2.8} y={1590} />
      {[0, 1].map((i) => <Star key={i} size={80} color="#fff6b0" style={{position: 'absolute', left: i ? 900 : 90, top: 700 + 30 * Math.sin(t * 3 + i), transform: `rotate(${t * 70}deg)`}} />)}
    </AbsoluteFill>
  );
};

export const Countdown: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{c_intro: Intro, c_slam: Slam, c_page: Page, c_rows: Rows, c_big: Big, c_one: Big, c_tease: Tease, c_outro: Outro}}
    swipeInto={['c_slam', 'c_big', 'c_tease', 'c_one', 'c_outro']} />
);
