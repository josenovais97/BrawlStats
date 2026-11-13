// The quiz formats (quiz, shadowquiz, zoomquiz, skinquiz, iconquiz) in the
// Remotion look (2026-11-13). Content comes from make.py --plan: five rounds,
// each 6 beats (4 to guess, 2 for the reveal), an intro and an ending.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Art, Backdrop, BrandBug, Burst, Banner, Chip, Confetti, Flare, FollowButton, Halo, HoloCard, Label, Ring, SearchBar, SpeedLines, Star, Title} from './fx';
import {SceneProps, Stage} from './Stage';
import {DEEP, INK, LEVEL, TIER, W, clamp, mix, outBack, outCubic, Plan} from './theme';

const VIOLET = '#6a3cff';
const INTRO: Record<string, [string, string]> = {
  shadow: ['GUESS THE', 'SHADOW'], zoom: ['ZOOMED IN', 'WHO IS IT?'], skin: ['WHOSE SKIN', 'IS THIS?'],
  icon: ['WHOSE GADGET', 'IS THIS?'], none: ['GUESS THE', 'BRAWLER'],
};

const Intro: React.FC<SceneProps> = ({seg, frame, beat, t, spb}) => {
  const [l1, l2] = INTRO[seg.style || 'none'] || INTRO.none;
  // The card is there from the first frame: the opening second is what stops a scroll.
  const cardIn = outBack((frame + 3) / 12, 1.6);
  const spin = (1 - outCubic((frame + 3) / 18)) * 120;
  return (
    <AbsoluteFill>
      <Backdrop color={VIOLET} t={t} rays={0.7} cy={1120} />
      {/* the five decoys marching along the bottom as shadows */}
      {seg.faces.map((f: string, j: number) => (
        <Img key={j} src={staticFile(f)} style={{position: 'absolute', height: 230, top: 1640 + 18 * Math.sin(t * 4 + j),
          left: ((j * 240 + t * 150) % (W + 480)) - 240, opacity: 0.9}} />
      ))}
      <Title text={l1} size={150} frame={frame} y={380} glow="#ff3c8a" />
      <Title text={l2} size={190} frame={frame} at={spb} gold y={590} glow="#ff3c8a" />
      <Halo x={W / 2} y={1130} r={560 * (1 + 0.08 * Math.max(0, 1 - (beat % 1) / 0.3))} color="#c08bff" a={0.9 * Math.max(0, Math.min(1, cardIn))} />
      {cardIn > 0 && (
        <div style={{position: 'absolute', left: W / 2, top: 1130, transform: `translate(-50%, -50%) perspective(1600px) rotateY(${spin + 8 * Math.sin(t * 2)}deg) scale(${cardIn})`}}>
          <HoloCard size={560} rim="#b77bff" t={t} beat={beat}>
            <div style={{transform: `translateY(${-14 * Math.abs(Math.sin(t * 3))}px) rotate(${6 * Math.sin(t * 2.2)}deg)`}}>
              <Title text="?" size={420} frame={999} gold x={0} y={0} />
            </div>
          </HoloCard>
        </div>
      )}
      <Chip text={`#${seg.n}`} color="#ff3c64" size={80} x={820} y={860} rot={-8} scale={outBack((frame - spb * 2) / 9, 2.2)} />
      {frame > spb * 3 && <Title text="ONLY REAL FANS GET 5/5" size={62} frame={frame} at={spb * 3} stagger={0.6} y={1475} />}
    </AbsoluteFill>
  );
};

const PX = W / 2, PY = 1010, CARD = 820, INNER = CARD - 28;

const ClueView: React.FC<{seg: any; beat: number}> = ({seg, beat}) => {
  if (seg.zoom) {
    const z = seg.zoom;
    const zoom = z.from - z.pull * Math.min(beat, 3.6);
    const sc = INNER / (z.s0 / zoom);
    return (
      <div style={{position: 'absolute', inset: 0, background: '#1e2350'}}>
        <Img src={staticFile(z.img)} style={{position: 'absolute', width: z.w * sc, height: z.h * sc, left: INNER / 2 - z.cx * sc, top: INNER / 2 - z.cy * sc}} />
      </div>
    );
  }
  const imgs: string[] = seg.img || [];
  const src = imgs[Math.min(imgs.length - 1, Math.floor(beat))];
  const pixel = seg.clue === 'pixel' || imgs.length > 1;
  return <Img src={staticFile(src)} style={{maxWidth: INNER - 40, maxHeight: INNER - 40, imageRendering: pixel ? 'pixelated' : 'auto',
    filter: seg.clue === 'shadow' ? 'none' : 'drop-shadow(0 14px 0 rgba(0,0,0,0.28))'}} />;
};

const Round: React.FC<SceneProps> = ({seg, frame, beat, t, spb}) => {
  const b = seg.b;
  const lvl = LEVEL[seg.lvl] || '#ffb428';
  const reveal = beat >= 4;
  const rf = frame - 4 * spb; // frames since the reveal
  const tier = TIER[b.tier] || '#9669ff';
  const color = reveal ? tier : VIOLET;
  const enter = outBack(frame / 12, 1.5);
  const flip = reveal ? clamp(rf / 9) * 180 : 0;
  const tick = 1 + 0.035 * Math.max(0, 1 - (beat % 1) / 0.25);
  const n = beat >= 1 && beat < 4 ? String(4 - Math.floor(beat)) : '?';
  return (
    <AbsoluteFill>
      <Backdrop color={color} t={t} rays={reveal ? 1 : 0.45} cy={PY} />
      {!reveal && <SpeedLines t={t} a={n === '1' ? 0.35 + 0.25 * Math.max(0, 1 - (beat % 1) / 0.3) : 0} cy={PY} />}
      <Halo x={PX} y={PY} r={CARD * (0.95 + 0.07 * Math.max(0, 1 - (beat % 1) / 0.3))} color={reveal ? tier : lvl} a={reveal ? 0.95 : 0.7} />
      <BrandBug />
      {/* progress: one bar per round */}
      {[0, 1, 2, 3, 4].map((j) => {
        const done = j < seg.i || (j === seg.i && reveal);
        const now = j === seg.i && !reveal;
        return <div key={j} style={{position: 'absolute', top: 300, left: W / 2 - 2.5 * 170 + j * 170 + 10, width: 150, height: 26, borderRadius: 13,
          background: done ? 'linear-gradient(180deg,#fff1a0,#ffb21e)' : now ? lvl : 'rgba(10,12,30,0.65)',
          boxShadow: `0 0 0 5px ${INK}${now ? `, 0 0 0 ${9 + 4 * Math.abs(Math.sin(t * 6))}px rgba(255,255,255,0.35)` : ''}`}} />;
      })}
      <Label text={`ROUND ${seg.i + 1}/5`} size={58} style={{position: 'absolute', left: 70, top: 380}} />
      <Chip text={seg.lvl} color={lvl} size={50} x={W - 190} y={412} />
      {/* the card, flipping over at the reveal */}
      <div style={{position: 'absolute', left: PX, top: PY, transform: `translate(-50%, -50%) perspective(1800px) rotateX(${4 * Math.sin(t * 1.7)}deg) rotateY(${(reveal ? (flip > 90 ? flip - 180 : flip) : (1 - enter) * -70) + 5 * Math.sin(t * 1.3)}deg) scale(${(reveal ? 1 : enter) * (reveal ? 1 : tick)})`}}>
        {!reveal || flip <= 90 ? (
          <HoloCard size={CARD} rim={lvl} t={t} beat={beat} inner="#5f87ff">
            <ClueView seg={seg} beat={beat} />
          </HoloCard>
        ) : (
          <HoloCard size={CARD} rim={tier} t={t} beat={beat} inner={tier} lit>
            <div style={{width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle, rgba(255,255,255,0.6), transparent 65%)`}} />
          </HoloCard>
        )}
      </div>
      {seg.tab && !reveal && <Chip text={seg.tab.label} color={seg.tab.color} size={54} x={PX} y={PY + CARD / 2 + 4} scale={outBack(frame / 9, 2)} />}
      {!reveal && (
        <>
          <div style={{position: 'absolute', left: PX, top: PY - CARD / 2 - 20, transform: 'translate(-50%, -50%)'}}>
            <Ring n={n} frac={beat < 1 ? 1 : 1 - (beat - 1) / 3} color={n === '1' ? '#ff3c64' : '#ffd23f'}
              pulse={1 + 0.25 * Math.max(0, 1 - (beat % 1) / 0.3) * (beat >= 1 ? 1 : 0)} />
          </div>
          <Title text={seg.label} size={92} frame={frame} at={3} stagger={0.7} y={PY + CARD / 2 + (seg.tab ? 150 : 120)} glow={lvl} />
        </>
      )}
      {reveal && rf >= 7 && (
        <>
          <div style={{position: 'absolute', left: PX, top: PY - 30, transform: `translate(-50%, -50%) scale(${0.35 + 0.65 * outBack((rf - 7) / 10, 1.8)})`}}>
            <Art src={b.art} size={1000} style={{filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
          </div>
          <Burst f={rf - 7} x={PX} y={PY} />
          {b.tier && <Chip text={`${b.tier} TIER`} color={tier} size={46} x={880} y={PY - CARD / 2 + 40} rot={8} scale={outBack((rf - 14) / 8, 2.2)} />}
          <Banner text={b.name} color={tier} size={128} y={PY + CARD / 2 + 70} frame={rf} at={9} />
          {(b.skin || b.ability?.name) && (
            <div style={{position: 'absolute', left: W / 2, top: PY + CARD / 2 + 215, transform: `translate(-50%, -50%) scale(${outBack((rf - 14) / 9, 1.8)})`}}>
              <Label text={b.skin ? `${b.skin} SKIN` : `${b.ability.label}: ${b.ability.name}`} size={58} color="#ffe45a" />
            </div>
          )}
        </>
      )}
      {reveal && <Flare f={rf - 7} y={PY} color={tier} />}
      {reveal && rf >= 7 && rf < 13 && <AbsoluteFill style={{background: '#fff', opacity: 0.85 * (1 - (rf - 7) / 6)}} />}
      {!reveal && n === '1' && <AbsoluteFill style={{boxShadow: `inset 0 0 ${160 + 80 * Math.max(0, 1 - (beat % 1) / 0.3)}px rgba(255,40,80,0.75)`}} />}
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({seg, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={VIOLET} t={t} rays={0.6} cy={800} />
    <Confetti t={frame / 30} />
    <Title text="HOW MANY" size={150} frame={frame} y={360} glow="#ff3c8a" />
    <Title text="DID YOU GET?" size={128} frame={frame} at={spb * 0.6} gold y={540} glow="#ff3c8a" />
    {seg.picks.map((b: any, j: number) => {
      const u = (frame - spb * 1.2 - j * 3) / 10;
      if (u <= 0) return null;
      const x = W / 2 + (j - 2) * 196;
      return (
        <div key={j} style={{position: 'absolute', left: x, top: 790, transform: `translate(-50%, -50%) perspective(900px) rotateY(${(1 - outCubic(u)) * 180}deg) scale(${outBack(u)})`,
          display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{width: 170, height: 170, borderRadius: 34, overflow: 'hidden', boxShadow: `0 0 0 7px ${INK}, 0 12px 0 7px ${DEEP}`,
            background: 'linear-gradient(180deg,#8fb0ff,#3c56c8)'}}>
            {b.face && <Img src={staticFile(b.face)} style={{width: 170, height: 170}} />}
          </div>
          <div style={{marginTop: 18}}><Label text={b.name.slice(0, 9)} size={34} /></div>
        </div>
      );
    })}
    <Title text="COMMENT YOUR SCORE" size={86} frame={frame} at={spb * 2.2} stagger={0.6} y={1010} />
    <FollowButton frame={frame} at={spb * 3.2} y={1200} />
    {frame > spb * 3.6 && <div style={{position: 'absolute', left: W / 2, top: 1340, transform: 'translate(-50%, -50%)'}}>
      <Label text="PLAY TODAY'S PUZZLE ON" size={50} /></div>}
    <SearchBar frame={frame} at={spb * 3.8} y={1470} />
    {[0, 1, 2].map((i) => <Star key={i} size={70} color="#ffe45a" style={{position: 'absolute', left: 140 + i * 360, top: 1640 + 20 * Math.sin(t * 3 + i),
      transform: `rotate(${t * 60 + i * 40}deg)`, opacity: clamp((frame - spb * 4) / 10)}} />)}
  </AbsoluteFill>
);

export const Quiz: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{q_intro: Intro, q: Round, q_outro: Outro}} swipeInto={['q', 'q_outro']} />
);
