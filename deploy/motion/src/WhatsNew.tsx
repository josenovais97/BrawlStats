// "NEW brawlers & Buffies: are they good?" in the Remotion look (2026-11-18):
// the five newest brawlers with their tier and a verdict, then the newest
// Buffies (gadget, star power, hypercharge). Content from make.py --plan.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Art, Backdrop, Banner, BrandBug, Burst, Chip, Confetti, Flare, FollowButton, Halo, Label, SearchBar, SpeedLines, Star, Title} from './fx';
import {Face, Stamp, pop} from './Formats';
import {SceneProps, Stage} from './Stage';
import {TierBadge} from './Tier';
import {TIER, W, clamp, hookOf, mix, outBack, Plan} from './theme';

const PINK = '#ff3c64', BUFFIE = '#8b6bff', ORANGE = '#ff9a28';

const Intro: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const col = Math.floor(t * 3) % 2 === 0 ? PINK : BUFFIE;
  const sils: string[] = seg.sils || [];
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={0.8} cy={1200} />
      <SpeedLines t={t} a={0.2} cy={1200} />
      {sils.map((s, j) => {
        const k = outBack((frame - j * 4 + 3) / 12, 1.6);
        if (k <= 0) return null;
        return (
          <div key={j} style={{position: 'absolute', left: W / 2 + (j - (sils.length - 1) / 2) * 330, top: 1210 + (j % 2) * 50,
            transform: `translate(-50%,-50%) scale(${k * (0.92 + 0.04 * Math.sin(t * 6 + j))})`}}>
            <Img src={staticFile(s)} style={{maxWidth: 420, maxHeight: 520}} />
          </div>
        );
      })}
      {sils.length > 0 && frame > spb * 1.5 && [0, 1, 2].slice(0, sils.length).map((j) => (
        <div key={j} style={{position: 'absolute', left: W / 2 + (j - (sils.length - 1) / 2) * 330, top: 1210 + (j % 2) * 50, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 1.5 + j * 4)})`}}>
          <Title text="?" size={200} gold frame={999} x={0} y={0} />
        </div>
      ))}
      <Title text="NEW" size={240} gold frame={frame} y={330} glow="#5a0030" />
      <Title text="BRAWLERS" size={170} frame={frame} at={spb} y={530} glow="#5a0030" />
      <Title text="+ BUFFIES" size={150} frame={frame} at={spb * 2} y={700} color="#c9b4ff" glow="#2a0f7a" />
      {frame > spb * 3.2 && <Title text="ARE THEY GOOD?" size={112} frame={frame} at={spb * 3.2} stagger={0.8} y={1660} />}
    </AbsoluteFill>
  );
};

const Part: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const [a, ...rest] = String(seg.label).split(' ');
  return (
    <AbsoluteFill>
      <Backdrop color={seg.col} t={t} rays={1} cy={960} />
      <SpeedLines t={t} a={0.35} cy={960} />
      <Title text={a} size={220} gold frame={frame} y={840} glow={mix(seg.col, '#000000', 0.5)} />
      <Title text={rest.join(' ')} size={190} frame={frame} at={spb * 0.5} y={1060} glow={mix(seg.col, '#000000', 0.5)} />
      <Burst f={frame} x={W / 2} y={950} />
    </AbsoluteFill>
  );
};

const NewOne: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const b = seg.b;
  const col = TIER[b.tier] || PINK;
  const tf = frame - spb * 1.3;
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={1} cy={840} />
      <BrandBug y={180} />
      <Halo x={W / 2} y={840} r={540} color={mix(col, '#ffffff', 0.35)} a={0.9} />
      <div style={{position: 'absolute', left: W / 2, top: 830, transform: `translate(-50%,-50%) scale(${1 + 0.35 * (1 - outBack(frame / 13, 1.6))})`}}>
        <Art src={b.art} size={860} style={{filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <Burst f={frame} x={W / 2} y={830} />
      <Banner text={b.name} color={col} size={b.name.length <= 8 ? 140 : b.name.length <= 12 ? 110 : 88} y={1330} frame={frame} at={spb * 0.3} />
      {tf >= 0 && <div style={{position: 'absolute', left: W / 2, top: 1530, transform: `translate(-50%,-50%) scale(${1 + 0.9 * (1 - outBack(tf / 12, 1.2))})`}}>
        {b.tier ? <TierBadge tier={b.tier} size={170} /> : <Chip text="JUST RELEASED" color={PINK} size={70} x={0} y={0} />}
      </div>}
      {frame > spb * 2.2 && <div style={{position: 'absolute', left: W / 2, top: 1690, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 2.2)})`}}>
        <Label text={seg.line} size={62} /></div>}
      <Stamp text={seg.verdict} color={seg.vcol} frame={frame} at={spb * 2.9} y={360} />
      {seg.party && frame > spb * 2.9 && <Confetti t={(frame - spb * 2.9) / 30} />}
      <Flare f={frame} y={830} color={col} />
    </AbsoluteFill>
  );
};

const KINDS = ['gadget', 'starPower', 'hyperCharge'];

const BuffieOne: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const b = seg.b;
  return (
    <AbsoluteFill>
      <Backdrop color={BUFFIE} t={t} rays={0.9} cy={640} />
      <BrandBug y={180} />
      <Halo x={W / 2} y={640} r={460} color="#d4c4ff" a={0.85} />
      <div style={{position: 'absolute', left: W / 2, top: 650, transform: `translate(-50%,-50%) scale(${1 + 0.3 * (1 - outBack(frame / 13, 1.6))})`}}>
        <Art src={b.art} size={700} style={{filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <Burst f={frame} x={W / 2} y={650} color="#e0d4ff" />
      <Banner text={b.name} color={BUFFIE} size={b.name.length <= 8 ? 130 : b.name.length <= 12 ? 104 : 84} y={1080} frame={frame} at={spb * 0.3} />
      {KINDS.map((kk, j) => {
        const at = spb * 1.0 + j * spb * 0.5;
        const k = pop(frame, at, 9, 1.9);
        if (k <= 0) return null;
        const x = W / 2 + (j - 1) * 330;
        const c = seg.colors?.[kk] || '#ffbe28';
        return (
          <React.Fragment key={kk}>
            <div style={{position: 'absolute', left: x, top: 1350, transform: `translate(-50%,-50%) scale(${k}) rotate(${4 * Math.sin(t * 3 + j)}deg)`}}>
              <div style={{position: 'absolute', left: -20, top: -20, width: 290, height: 290, borderRadius: '50%', background: `radial-gradient(circle, ${c}cc 0%, transparent 68%)`}} />
              <Img src={staticFile(seg.icons[kk])} style={{position: 'relative', width: 250, height: 250}} />
            </div>
            <div style={{position: 'absolute', left: x, top: 1520, transform: 'translate(-50%,-50%)', opacity: clamp((frame - at - 4) / 6)}}>
              <Label text={seg.labels?.[kk] || kk.toUpperCase()} size={46} color={c} />
            </div>
          </React.Fragment>
        );
      })}
      {b.tier && frame > spb * 2.9 && <div style={{position: 'absolute', left: W / 2, top: 1700, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 2.9, 10, 2)})`}}>
        <TierBadge tier={b.tier} size={140} /></div>}
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const faces: string[] = seg.faces || [];
  const hook = hookOf(plan, 'EVERY TIER, FROM REAL BATTLES');
  const bounce = Math.abs(Math.sin((frame / spb) * Math.PI)) * 22;
  return (
    <AbsoluteFill>
      <Backdrop color={ORANGE} t={t} rays={0.6} cy={700} />
      <Confetti t={frame / 30} />
      {faces.map((f, j) => {
        const k = pop(frame, j * 2.5, 9, 1.8);
        if (k <= 0) return null;
        const row = Math.floor(j / 5), inRow = Math.min(5, faces.length - row * 5);
        return (
          <div key={j} style={{position: 'absolute', left: W / 2 + ((j % 5) - (inRow - 1) / 2) * 196, top: 330 + row * 205, transform: `translate(-50%,-50%) scale(${k}) rotate(${(j % 2 ? 4 : -4)}deg)`}}>
            <Face src={f} size={170} color={row ? BUFFIE : PINK} />
          </div>
        );
      })}
      <Title text="WHICH ONE IS" size={120} frame={frame} at={spb * 0.8} y={790 - bounce} glow="#a03000" />
      <Title text="YOUR FAVOURITE?" size={130} gold frame={frame} at={spb * 1.3} y={940 - bounce} glow="#a03000" />
      {frame > spb * 1.9 && <Title text="TELL US IN THE COMMENTS" size={62} frame={frame} at={spb * 1.9} stagger={0.5} y={1075} />}
      <FollowButton frame={frame} at={spb * 2.6} y={1290} />
      {frame > spb * 3 && <div style={{position: 'absolute', left: W / 2, top: 1440, transform: 'translate(-50%,-50%)'}}><Label text={hook.lead} size={50} /></div>}
      <SearchBar frame={frame} at={spb * 3.2} y={1570} text={hook.text} />
      {[0, 1].map((i) => <Star key={i} size={80} color="#fff6b0" style={{position: 'absolute', left: i ? 900 : 90, top: 1180 + 30 * Math.sin(t * 3 + i), transform: `rotate(${t * 70}deg)`}} />)}
    </AbsoluteFill>
  );
};

export const WhatsNew: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{w_intro: Intro, w_part: Part, w_brawler: NewOne, w_buffie: BuffieOne, w_outro: Outro}}
    swipeInto={['w_part', 'w_brawler', 'w_buffie', 'w_outro']} />
);
