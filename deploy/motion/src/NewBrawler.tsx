// A new brawler's first stats, two days after release, in the Remotion look
// (2026-11-18): the silhouette, the reveal, its tier after N real battles,
// its best maps and the build most players run. Content from make.py --plan.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Backdrop, Banner, BrandBug, Burst, Chip, Confetti, Flare, FollowButton, Halo, Label, SearchBar, SpeedLines, Star, Title} from './fx';
import {Stamp, pop} from './Formats';
import {SceneProps, Stage} from './Stage';
import {TierBadge} from './Tier';
import {DEEP, INK, TIER, W, clamp, mix, outBack, outCubic, shade, Plan} from './theme';

const SKY = '#2896ff', VIOLET = '#965aff', ORANGE = '#ff9a28';
const ABILITY: Record<string, [string, string]> = {gadget: ['GADGET', '#3cc86e'], starPower: ['STAR POWER', '#ffbe28']};

const Intro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const siren = Math.floor(t * 4) % 2 === 0 ? '#ff3246' : '#3c78ff';
  return (
    <AbsoluteFill>
      <Backdrop color={siren} t={t} rays={0.8} cy={1000} />
      <SpeedLines t={t} a={0.3} cy={1000} />
      <Halo x={W / 2} y={1060} r={500} color="#ffffff" a={0.55} />
      <div style={{position: 'absolute', left: W / 2, top: 1060, transform: `translate(-50%,-50%) scale(${(0.78 + 0.04 * Math.sin(t * 8)) * outBack((frame + 4) / 12, 1.5)})`}}>
        <Img src={staticFile(plan.mystery)} style={{maxWidth: 820, maxHeight: 820}} />
      </div>
      <Title text="NEW" size={240} gold frame={frame} y={360} glow="#7a0016" />
      <Title text="BRAWLER" size={200} frame={frame} at={spb} y={570} glow="#7a0016" />
      {frame > spb * 3 && <Title text="IS IT BROKEN?" size={124} frame={frame} at={spb * 3} stagger={0.8} y={1590} />}
      {frame > spb * 3 && <Chip text="REAL BATTLE DATA" color="#283069" size={50} x={W / 2} y={1745} scale={pop(frame, spb * 3.6)} />}
    </AbsoluteFill>
  );
};

const Reveal: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const nb = plan.nb;
  const col = TIER[nb.tier] || '#ff3c64';
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={1} cy={880} />
      <Halo x={W / 2} y={880} r={560} color={mix(col, '#ffffff', 0.35)} a={0.9} />
      <div style={{position: 'absolute', left: W / 2, top: 880, transform: `translate(-50%,-50%) scale(${1 + 0.35 * (1 - outBack(frame / 13, 1.6))})`}}>
        <Img src={staticFile(plan.hero)} style={{maxWidth: 880, maxHeight: 860, filter: 'drop-shadow(0 24px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <Burst f={frame} x={W / 2} y={880} />
      <Banner text={nb.name} color={col} size={nb.name.length <= 7 ? 150 : 118} y={1380} frame={frame} at={spb * 0.3} />
      {nb.tags.map((tag: string, j: number) => (
        <Chip key={j} text={tag} color="#283069" size={52} x={W / 2 + (j - (nb.tags.length - 1) / 2) * 420} y={1570} scale={pop(frame, spb * 1.5 + j * 6)} />
      ))}
      <Flare f={frame} y={880} color={col} />
      {frame < 7 && <AbsoluteFill style={{background: '#fff', opacity: 0.9 * (1 - frame / 7)}} />}
    </AbsoluteFill>
  );
};

const TierScene: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const nb = plan.nb;
  const col = TIER[nb.tier] || '#ff3c64';
  const n = Math.round(nb.battles * outCubic(frame / (spb * 1.2)));
  const tf = frame - spb * 1.5;
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={0.7} cy={980} />
      <BrandBug />
      <div style={{position: 'absolute', left: W / 2, top: 380, transform: 'translate(-50%,-50%)', opacity: clamp(frame / 6)}}><Label text="AFTER" size={90} /></div>
      <div style={{position: 'absolute', left: W / 2, top: 530, transform: `translate(-50%,-50%) scale(${pop(frame, 0, 9, 1.8)})`}}>
        <Title text={n.toLocaleString('en-US')} size={200} gold frame={999} x={0} y={0} />
      </div>
      <div style={{position: 'absolute', left: W / 2, top: 690, transform: 'translate(-50%,-50%)', opacity: clamp(frame / 6)}}><Label text="REAL BATTLES" size={90} /></div>
      <Halo x={W / 2} y={980} r={330} color={mix(col, '#ffffff', 0.4)} a={tf > 0 ? 0.9 : 0} />
      {tf >= 0 && <div style={{position: 'absolute', left: W / 2, top: 980, transform: `translate(-50%,-50%) scale(${1 + 1.2 * (1 - outBack(tf / 12, 1.2))})`}}>
        <TierBadge tier={nb.tier} size={300} />
      </div>}
      <Burst f={tf} x={W / 2} y={980} />
      {frame > spb * 2.6 && <Chip text={`#${nb.rank} OF ${nb.of} BRAWLERS`} color="#283069" size={70} x={W / 2} y={1240} scale={pop(frame, spb * 2.6)} />}
      <Stamp text={nb.verdict} color={nb.vcol} frame={frame} at={spb * 3.8} y={1480} />
      {frame > spb * 3.8 && 'SA'.includes(nb.tier) && <Confetti t={(frame - spb * 3.8) / 30} />}
    </AbsoluteFill>
  );
};

const Maps: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={SKY} t={t} rays={0.5} cy={1100} />
    <BrandBug />
    <Title text="BEST MAPS" size={170} gold frame={frame} y={390} glow="#0a2a7a" />
    <div style={{position: 'absolute', left: W / 2, top: 510, transform: 'translate(-50%,-50%)', opacity: clamp(frame / 10)}}>
      <Label text={`WHERE ${plan.nb.name} WINS MOST`} size={50} color="#d6e6ff" />
    </div>
    {seg.maps.map((m: any, j: number) => {
      const u = (frame - spb * 0.8 - j * spb * 0.7) / 12;
      if (u <= 0) return null;
      const diff = (m.wr - m.base) * 100;
      return (
        <div key={j} style={{position: 'absolute', left: W / 2 + 900 * (1 - outBack(u, 1.3)), top: 1010 - (seg.maps.length - 1) * 145 + j * 290, transform: 'translate(-50%,-50%)',
          width: 960, height: 240, borderRadius: 48, display: 'flex', alignItems: 'center', gap: 26, padding: '0 34px',
          background: `linear-gradient(180deg, #4f8cff, #1f3fa0)`, boxShadow: `0 0 0 8px ${INK}, 0 14px 0 8px ${DEEP}, inset 0 6px 0 rgba(255,255,255,0.3)`}}>
          <Label text={`#${j + 1}`} size={84} color="#ffe45a" />
          {m.icon ? <Img src={staticFile(m.icon)} style={{width: 120, height: 120, objectFit: 'contain'}} /> : null}
          <div style={{display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minWidth: 0, overflow: 'hidden'}}>
            <Label text={m.map} size={m.map.length > 16 ? 46 : m.map.length > 11 ? 54 : 68} />
            <Label text={m.mode} size={42} color="#bcd4ff" />
          </div>
          {diff > 0 && <div style={{padding: '10px 20px 14px', borderRadius: 999, background: '#3cdc78', boxShadow: `0 0 0 5px ${INK}`}}>
            <Label text={`+${diff.toFixed(1)}%`} size={46} /></div>}
        </div>
      );
    })}
  </AbsoluteFill>
);

const Build: React.FC<SceneProps> = ({seg, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={VIOLET} t={t} rays={0.6} cy={1000} />
    <BrandBug />
    <Title text="THE BUILD" size={170} gold frame={frame} y={390} glow="#3a0f9a" />
    <div style={{position: 'absolute', left: W / 2, top: 510, transform: 'translate(-50%,-50%)', opacity: clamp(frame / 10)}}>
      <Label text="WHAT MOST PLAYERS RUN" size={50} color="#e0d4ff" />
    </div>
    {seg.build.map((b: any, j: number) => {
      const at = spb * 0.8 + j * spb * 1.2;
      const u = (frame - at) / 12;
      if (u <= 0) return null;
      const [label, col] = ABILITY[b.kind] || ['ABILITY', '#ffbe28'];
      const y = 820 + j * 440;
      return (
        <React.Fragment key={j}>
          <Halo x={W / 2} y={y - 40} r={190} color={col} a={0.8} />
          <div style={{position: 'absolute', left: W / 2, top: y - 40, transform: `translate(-50%,-50%) scale(${outBack(u, 1.8)}) rotate(${4 * Math.sin(t * 2 + j)}deg)`}}>
            {b.icon ? <Img src={staticFile(b.icon)} style={{width: 230, height: 230, objectFit: 'contain'}} />
              : <div style={{padding: '20px 40px', borderRadius: 999, background: col, boxShadow: `0 0 0 6px ${INK}`}}><Label text={label} size={70} /></div>}
          </div>
          <Burst f={frame - at} x={W / 2} y={y - 40} color={mix(col, '#ffffff', 0.5)} />
          {u > 0.4 && <Title text={b.name} size={b.name.length <= 14 ? 96 : 74} frame={frame} at={at + 5} stagger={0.6} y={y + 135} />}
          {u > 0.8 && <Chip text={`${label} · ${Math.round(b.share * 100)}% PICK IT`} color={shade(col, 0.85)} size={44} x={W / 2} y={y + 245} scale={pop(frame, at + 10)} />}
        </React.Fragment>
      );
    })}
  </AbsoluteFill>
);

const Outro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const nb = plan.nb;
  const bounce = Math.abs(Math.sin((frame / spb) * Math.PI)) * 22;
  return (
    <AbsoluteFill>
      <Backdrop color={ORANGE} t={t} rays={0.6} cy={500} />
      <Confetti t={frame / 30} />
      <div style={{position: 'absolute', left: W / 2, top: 460 - bounce, transform: `translate(-50%,-50%) scale(${pop(frame, 0, 12, 1.6)})`}}>
        <Img src={staticFile(plan.hero)} style={{maxWidth: 480, maxHeight: 460, filter: 'drop-shadow(0 18px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <Title text="BUYING" size={170} frame={frame} at={spb * 0.5} y={790} glow="#a03000" />
      <Title text={`${nb.name}?`} size={nb.name.length <= 8 ? 170 : 130} gold frame={frame} at={spb} y={960} glow="#a03000" />
      {frame > spb * 1.6 && <Title text="YES OR NO IN THE COMMENTS" size={64} frame={frame} at={spb * 1.6} stagger={0.5} y={1100} />}
      <FollowButton frame={frame} at={spb * 2.4} y={1300} />
      {frame > spb * 2.8 && <div style={{position: 'absolute', left: W / 2, top: 1450, transform: 'translate(-50%,-50%)'}}><Label text="FULL STATS ON" size={52} /></div>}
      <SearchBar frame={frame} at={spb * 3} y={1580} />
      {[0, 1].map((i) => <Star key={i} size={80} color="#fff6b0" style={{position: 'absolute', left: i ? 900 : 90, top: 700 + 30 * Math.sin(t * 3 + i), transform: `rotate(${t * 70}deg)`}} />)}
    </AbsoluteFill>
  );
};

export const NewBrawler: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{n_intro: Intro, n_reveal: Reveal, n_tier: TierScene, n_maps: Maps, n_build: Build, n_outro: Outro}}
    swipeInto={['n_reveal', 'n_maps', 'n_build', 'n_outro']} />
);
