// The data formats in the Remotion look (2026-11-17): modes, ranks, stop,
// giveaway and drops. Same content as the Pillow scenes in make.py (the plan
// carries it), drawn with the pieces in fx.tsx.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Arrow, Art, Backdrop, Banner, BrandBug, Burst, Chip, Confetti, Flare, FollowButton, Halo, HoloCard, InlineTitle, Label, SearchBar, SpeedLines, Star, Title} from './fx';
import {SceneProps, Stage} from './Stage';
import {DEEP, HEAD, INK, TIER, W, clamp, hookOf, mix, outBack, outCubic, pct, shade, Plan} from './theme';

export const ORANGE = '#ff9a28';
export const pop = (frame: number, at: number, len = 9, s = 2) => outBack((frame - at) / len, s);

/** "WIN RATE 54.0%"-style pill. */
export const StatPill: React.FC<{label: string; value: string; color: string; x?: number; y: number; scale?: number}> = ({label, value, color, x = W / 2, y, scale = 1}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${scale})`, display: 'flex', alignItems: 'center', gap: 18,
    padding: '14px 34px 16px', borderRadius: 999, background: 'rgba(10,12,30,0.82)', boxShadow: `0 0 0 5px ${INK}, 0 10px 0 5px ${DEEP}`}}>
    <Label text={label} size={44} color="#cfd6ff" stroke={0} />
    <Label text={value} size={64} color={color} />
  </div>
);

/** A stamped word, rotated, slammed on from big. */
export const Stamp: React.FC<{text: string; color: string; frame: number; at: number; x?: number; y: number}> = ({text, color, frame, at, x = W / 2, y}) => {
  const f = frame - at;
  if (f < 0) return null;
  const k = outBack(f / 8, 1.0);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) rotate(-12deg) scale(${1 + 1.6 * (1 - k)})`, opacity: clamp(f / 3),
      padding: '18px 40px 22px', borderRadius: 30, border: `14px solid ${color}`, background: 'rgba(10,12,30,0.55)', boxShadow: `0 0 0 6px ${INK}`}}>
      <Label text={text} size={118} color={color} />
    </div>
  );
};

/** A brawler portrait in a rounded frame. */
export const Face: React.FC<{src?: string; size: number; color?: string}> = ({src, size, color = '#3c56c8'}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.2, overflow: 'hidden', boxShadow: `0 0 0 6px ${INK}, 0 10px 0 6px ${DEEP}`,
    background: `linear-gradient(180deg, ${mix(color, '#fff', 0.35)}, ${shade(color, 0.6)})`}}>
    {src && <Img src={staticFile(src)} style={{width: size, height: size}} />}
  </div>
);

/** The ending every data format shares: a question, the follow button, the site typed in. */
export const Ending: React.FC<{frame: number; t: number; spb: number; color?: string; big: string; line1?: string; line2?: string; lead: string; text?: string; arrow?: boolean}> = ({
  frame, t, spb, color = ORANGE, big, line1, line2, lead, text, arrow = true,
}) => {
  const bounce = Math.abs(Math.sin((frame / spb) * Math.PI)) * 24;
  return (
    <AbsoluteFill>
      <Backdrop color={color} t={t} rays={0.6} cy={700} />
      <Title text={big} size={big.length > 7 ? 190 : 260} gold frame={frame} y={500 - bounce} glow="#ff3c8a" />
      {line1 && <Title text={line1} size={98} frame={frame} at={spb * 0.7} stagger={0.6} y={760} />}
      {line2 && <Title text={line2} size={98} frame={frame} at={spb * 1} stagger={0.6} y={880} />}
      {arrow && frame > spb * 1.3 && <Arrow x={W / 2} y={1080 + Math.abs(Math.sin(t * 6)) * 30} size={140} />}
      <FollowButton frame={frame} at={spb * 2.2} y={1290} />
      {frame > spb * 2.6 && <div style={{position: 'absolute', left: W / 2, top: 1430, transform: 'translate(-50%,-50%)'}}><Label text={lead} size={52} /></div>}
      <SearchBar frame={frame} at={spb * 2.8} y={1560} text={text} />
      {[0, 1].map((i) => <Star key={i} size={80} color="#fff6b0" style={{position: 'absolute', left: i ? 900 : 90, top: 680 + 30 * Math.sin(t * 3 + i), transform: `rotate(${t * 70}deg)`}} />)}
    </AbsoluteFill>
  );
};

// ================================================================ modes
const ModesIntro: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={ORANGE} t={t} rays={0.6} cy={1250} />
    <Title text="THE BEST" size={200} frame={frame} y={420} glow="#ff3c8a" />
    <Title text="BRAWLER" size={200} frame={frame} at={spb} y={630} glow="#ff3c8a" />
    <Title text="FOR EVERY MODE" size={128} gold frame={frame} at={spb * 2} y={830} glow="#ff3c8a" />
    {seg.modes.map((mk: string, i: number) => {
      const m = plan.modes?.[mk];
      if (!m) return null;
      const k = pop(frame, spb * 3 + i * 4, 9, 2.2);
      if (k <= 0) return null;
      const x = W / 2 + ((i % 2) - 0.5) * 470, y = 1080 + Math.floor(i / 2) * 170;
      return (
        <div key={mk} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${k}) rotate(${i % 2 ? 3 : -3}deg)`, display: 'flex', alignItems: 'center', gap: 14,
          padding: '12px 30px 14px 14px', borderRadius: 999, background: `linear-gradient(180deg, ${mix(m.color, '#fff', 0.3)}, ${m.color} 55%, ${shade(m.color, 0.7)})`,
          boxShadow: `0 0 0 6px ${INK}, 0 10px 0 6px ${DEEP}`}}>
          {m.icon && <Img src={staticFile(m.icon)} style={{width: 92, height: 92, objectFit: 'contain'}} />}
          <Label text={m.name} size={50} />
        </div>
      );
    })}
  </AbsoluteFill>
);

const ModesMode: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const m = plan.modes?.[seg.mode] || {name: seg.mode, color: ORANGE};
  const b = seg.b;
  const u = (frame - 3) / 12;
  return (
    <AbsoluteFill>
      <Backdrop color={m.color} t={t} rays={0.9} cy={900} />
      <BrandBug />
      {m.icon && <Img src={staticFile(m.icon)} style={{position: 'absolute', left: W / 2 - 330, top: 570, width: 660, height: 660, objectFit: 'contain', opacity: 0.16,
        transform: `rotate(${-8 + 4 * Math.sin(t)}deg) scale(${1.15 - 0.15 * outCubic(frame / 14)})`}} />}
      <div style={{position: 'absolute', left: W / 2, top: 400, transform: `translate(-50%,-50%) scale(${pop(frame, 0, 10, 1.8)})`, display: 'flex', alignItems: 'center', gap: 22}}>
        {m.icon && <Img src={staticFile(m.icon)} style={{width: 150, height: 150, objectFit: 'contain'}} />}
      </div>
      <Title text={m.name} size={130} frame={frame} y={560} color={mix(m.color, '#fff', 0.2)} glow={shade(m.color, 0.5)} />
      <Halo x={W / 2} y={960} r={560} color={m.color} a={0.85} />
      {u > 0 && <div style={{position: 'absolute', left: W / 2, top: 980, transform: `translate(-50%,-50%) translateY(${(1 - outBack(u, 1.4)) * 260}px) scale(${0.6 + 0.4 * outBack(u, 1.6)})`}}>
        <Art src={b.art} size={760} style={{filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
      </div>}
      <Burst f={frame - 3} x={W / 2} y={960} color={mix(m.color, '#fff', 0.5)} />
      <Banner text={b.name} color={m.color} size={b.name.length <= 7 ? 140 : 118} y={1400} frame={frame} at={6} />
      {frame > spb * 1.2 && <Chip text={`TOP 3 ON ${seg.hits} OF ${seg.maps} MAPS`} color="#283069" size={50} x={W / 2} y={1560} scale={pop(frame, spb * 1.2)} />}
      {seg.again && <Stamp text={`${b.name} AGAIN?!`} color="#ffd23f" frame={frame} at={spb * 2} y={780} />}
      <Flare f={frame - 3} y={960} color={m.color} />
    </AbsoluteFill>
  );
};

const ModesOutro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <Ending frame={frame} t={t} spb={spb} big="SAVE THIS" line1="FOR YOUR NEXT GAME" line2="WHO DO YOU MAIN?" {...hookOf(plan, "BEST PICKS FOR EVERY MAP ON")} arrow={false} />
);

export const Modes: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{m_intro: ModesIntro, m_mode: ModesMode, m_outro: ModesOutro}} swipeInto={['m_mode', 'm_outro']} />
);

// ================================================================ ranks
const RanksIntro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const lo = plan.low || '#4696ff', hi = plan.leg || '#ffaf28';
  const slide = outCubic(frame / 14);
  return (
    <AbsoluteFill>
      <Backdrop color="#2c2c7a" t={t} rays={0.4} dark />
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: 960, transform: `translateX(${(1 - slide) * -W}px)`,
        background: `linear-gradient(160deg, ${mix(lo, '#000', 0.2)} 0%, ${shade(lo, 0.45)} 100%)`, clipPath: 'polygon(0 0, 100% 0, 100% 78%, 0 100%)', opacity: 0.85}} />
      <div style={{position: 'absolute', left: 0, top: 860, width: W, height: 1060, transform: `translateX(${(1 - slide) * W}px)`,
        background: `linear-gradient(200deg, ${mix(hi, '#000', 0.15)} 0%, ${shade(hi, 0.45)} 100%)`, clipPath: 'polygon(0 22%, 100% 0, 100% 100%, 0 100%)', opacity: 0.85}} />
      <Title text="WHAT YOU" size={120} frame={frame} y={430} color={mix(lo, '#fff', 0.4)} />
      <Title text="PICK" size={210} frame={frame} at={2} y={600} color={mix(lo, '#fff', 0.25)} glow={shade(lo, 0.45)} />
      <div style={{position: 'absolute', left: W / 2, top: 930, transform: `translate(-50%,-50%) scale(${pop(frame, spb, 8, 2.6)}) rotate(-8deg)`}}>
        <div style={{width: 250, height: 250, borderRadius: '50%', background: 'linear-gradient(180deg,#ff6a8a,#ff2f5c)', boxShadow: `0 0 0 10px ${INK}, 0 16px 0 10px ${DEEP}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 12}}>
          <InlineTitle text="VS" size={140} />
        </div>
      </div>
      <Burst f={frame - spb} x={W / 2} y={930} color="#ffffff" />
      <Title text="WHAT MASTERS" size={120} frame={frame} at={spb * 2} y={1220} color={mix(hi, '#fff', 0.4)} />
      <Title text="PICK" size={210} gold frame={frame} at={spb * 2 + 2} y={1390} glow={shade(hi, 0.45)} />
    </AbsoluteFill>
  );
};

const RanksList: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const low = seg.side === 'low';
  const col = low ? plan.low || '#4696ff' : plan.leg || '#ffaf28';
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={0.35} />
      <BrandBug />
      <Title text={low ? 'DIAMOND & BELOW' : 'MASTERS+'} size={110} frame={frame} y={350} color={mix(col, '#fff', 0.3)} glow={shade(col, 0.45)} />
      <div style={{position: 'absolute', left: W / 2, top: 455, transform: 'translate(-50%,-50%)', opacity: clamp(frame / 8)}}><Label text="MOST PICKED THIS WEEK" size={44} color="#e6ebff" /></div>
      {seg.items.map((b: any, j: number) => {
        const u = (frame - spb * 0.5 - j * spb * 0.6) / 11;
        if (u <= 0) return null;
        return (
          <div key={j} style={{position: 'absolute', left: W / 2 + (low ? 1000 : -1000) * (1 - outBack(u, 1.3)), top: 620 + j * 225, transform: 'translate(-50%,-50%) skewX(-6deg)',
            width: 940, height: 196, borderRadius: 34, display: 'flex', alignItems: 'center',
            background: `linear-gradient(100deg, ${mix(col, '#fff', 0.3)} 0%, ${col} 40%, ${shade(col, 0.48)} 100%)`,
            boxShadow: `0 0 0 7px ${INK}, 0 14px 0 7px ${DEEP}, inset 0 6px 0 rgba(255,255,255,0.35)`}}>
            <div style={{marginLeft: 18, transform: 'skewX(6deg)'}}><Face src={b.face} size={164} color={col} /></div>
            <div style={{marginLeft: 28, display: 'flex', flexDirection: 'column', transform: 'skewX(6deg)'}}>
              <Label text={`#${j + 1}`} size={52} color="#ffe45a" />
              <div style={{marginTop: 6}}><Label text={b.name} size={b.name.length > 10 ? 60 : 78} /></div>
            </div>
            <div style={{position: 'absolute', right: 28, top: 44, transform: 'skewX(6deg)', padding: '10px 22px 12px', borderRadius: 26, background: INK}}>
              <Label text={pct(b.use || 0)} size={70} stroke={0} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const RanksReveal: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const lo = plan.low || '#4696ff', hi = plan.leg || '#ffaf28';
  const side = (b: any, x: number, col: string, at: number, label: string) => (
    <>
      <Halo x={x} y={780} r={380} color={col} a={0.9} />
      <div style={{position: 'absolute', left: x, top: 780, transform: `translate(-50%,-50%) scale(${pop(frame, at, 12, 1.6)})`}}><Art src={b.art} size={500} /></div>
      <div style={{position: 'absolute', left: x, top: 1140, transform: `translate(-50%,-50%) scale(${pop(frame, at + 3)})`}}>
        <Label text={b.name} size={b.name.length > 8 ? 70 : 92} color={mix(col, '#fff', 0.3)} /></div>
      <div style={{position: 'absolute', left: x, top: 1235, transform: `translate(-50%,-50%) scale(${pop(frame, at + 6)})`}}><Label text={label} size={46} /></div>
    </>
  );
  return (
    <AbsoluteFill>
      <Backdrop color="#2c2c7a" t={t} rays={0.5} dark cy={800} />
      <BrandBug />
      <div style={{position: 'absolute', left: W / 2 - 4, top: 380, width: 8, height: 1000, background: 'rgba(255,255,255,0.35)', transform: 'rotate(8deg)'}} />
      {side(seg.low1, W * 0.27, lo, 0, '#1 LOW RANKS')}
      {side(seg.leg1, W * 0.73, hi, spb * 0.5, '#1 MASTERS+')}
      <div style={{position: 'absolute', left: W / 2, top: 1140, transform: `translate(-50%,-50%) scale(${pop(frame, spb, 8, 2.4)})`}}><Title text="VS" size={130} frame={999} x={0} y={0} /></div>
      {seg.missing && frame > spb * 2.2 && (
        <>
          <Title text={`${seg.low1.name} ISN'T EVEN`} size={84} frame={frame} at={spb * 2.2} stagger={0.5} y={1430} color="#ff7a8a" />
          <Title text="TOP 8 IN MASTERS+" size={84} frame={frame} at={spb * 2.4} stagger={0.5} y={1540} color="#ff7a8a" />
        </>
      )}
    </AbsoluteFill>
  );
};

const RanksOutro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <Ending frame={frame} t={t} spb={spb} big="WHAT RANK" line1="ARE YOU?" line2="TELL US + YOUR MAIN" {...hookOf(plan, "TIER LIST FOR YOUR RANK ON")} arrow={false} />
);

export const Ranks: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{p_intro: RanksIntro, p_list: RanksList, p_reveal: RanksReveal, p_outro: RanksOutro}} swipeInto={['p_list', 'p_reveal', 'p_outro']} />
);

// ================================================================ stop
const RED = '#ff3750', GREEN = '#32e178';

const StopIntro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const over: any[] = plan.over || [];
  return (
    <AbsoluteFill>
      <Backdrop color={RED} t={t} rays={0.6} />
      <div style={{position: 'absolute', left: W / 2, top: 430, transform: `translate(-50%,-50%) scale(${pop(frame, 0, 9, 1.6)})`}}>
        <div style={{width: 360, height: 360, background: 'linear-gradient(180deg,#ff6a7a,#e01c38)', clipPath: 'polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 0 0 14px #fff`, paddingTop: 14}}>
          <InlineTitle text="STOP" size={124} />
        </div>
      </div>
      <Title text="PICKING" size={190} frame={frame} at={spb} y={720} glow="#7a0016" />
      <Title text="THESE BRAWLERS" size={118} frame={frame} at={spb * 2} y={900} glow="#7a0016" />
      {over.map((b, i) => {
        const at = spb * 3 + i * spb * 0.5;
        const k = pop(frame, at, 8, 2);
        if (k <= 0) return null;
        const x = W / 2 + (i - (over.length - 1) / 2) * 196;
        return (
          <div key={i} style={{position: 'absolute', left: x, top: 1230, transform: `translate(-50%,-50%) scale(${k}) rotate(${(i - 2) * 4}deg)`}}>
            <Face src={b.face} size={170} color={TIER[b.tier] || RED} />
            {frame - at > 6 && <div style={{position: 'absolute', left: 85, top: 85, transform: `translate(-50%,-50%) scale(${1 + 1.2 * (1 - outBack((frame - at - 6) / 7, 1))})`}}>
              <Label text="X" size={190} color={RED} stroke={12} /></div>}
          </div>
        );
      })}
      {frame > spb * 4.6 && <Title text="EVERYONE PLAYS THEM. THEY LOSE." size={58} frame={frame} at={spb * 4.6} stagger={0.3} y={1480} color="#ffd0d6" />}
    </AbsoluteFill>
  );
};

const StopOne: React.FC<SceneProps> = ({plan, seg, frame, t, spb, beat}) => {
  const good = seg.kind === 's_gem';
  const c = good ? GREEN : RED;
  const b = seg.b;
  const u = frame / 12;
  const wrNow = 50 + ((b.wr || 0.5) * 100 - 50) * outCubic((beat - 0.9) / 0.8);
  return (
    <AbsoluteFill>
      <Backdrop color={c} t={t} rays={0.85} cy={1000} />
      <BrandBug />
      <div style={{position: 'absolute', left: W / 2, top: 1000, transform: `translate(-50%,-50%) scale(${1.3 - 0.3 * outCubic(u)})`, fontFamily: HEAD,
        fontSize: 840, lineHeight: 1, color: 'transparent', WebkitTextStroke: '14px rgba(255,255,255,0.25)'}}>#{seg.n}</div>
      <Halo x={W / 2} y={1000} r={540} color={c} a={0.8} />
      <div style={{position: 'absolute', left: W / 2, top: 1000, transform: `translate(-50%,-50%) translateY(${(1 - outBack(u, 1.4)) * 280}px) scale(${0.6 + 0.4 * outBack(u, 1.6)})`}}>
        <Art src={b.art} size={860} style={{filter: good ? 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))' : 'drop-shadow(0 22px 0 rgba(0,0,0,0.3)) saturate(0.75)'}} />
      </div>
      <Title text={`#${seg.n}`} size={200} gold frame={frame} x={200} y={420} />
      <Chip text={good ? `#${seg.useRank} OF ${plan.total} IN PICKS` : `#${seg.useRank} MOST PICKED`} color="#283069" size={50} x={W - 290} y={420} scale={pop(frame, 3)} />
      <Banner text={b.name} color={c} size={b.name.length <= 8 ? 140 : 112} y={1500} frame={frame} at={4} />
      {beat >= 0.9 && <StatPill label={good ? 'WINS' : 'WINS ONLY'} value={`${wrNow.toFixed(1)}%`} color={good ? '#7cff8a' : '#ff8a96'} y={1665} scale={pop(frame, spb * 0.9)} />}
      <Stamp text={good ? 'HIDDEN GEM' : 'OVERRATED'} color={good ? '#7cff8a' : '#ff5a6e'} frame={frame} at={spb * 1.9} x={W / 2 + 40} y={1150} />
      <Flare f={frame - spb * 1.9} y={1150} color={c} />
    </AbsoluteFill>
  );
};

const StopSwitch: React.FC<SceneProps> = ({frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={GREEN} t={t} rays={1} cy={900} />
    <Title text="PICK THESE" size={180} frame={frame} y={760} glow="#0b6b32" />
    <Title text="INSTEAD" size={250} frame={frame} at={spb} y={1010} color="#b9ffcf" glow="#0b6b32" />
    <Burst f={frame - spb} x={W / 2} y={1010} color="#ffffff" />
    {frame > spb * 1.8 && <Title text="NOBODY PICKS THEM. THEY WIN." size={58} frame={frame} at={spb * 1.8} stagger={0.3} y={1260} color="#d6ffe2" />}
  </AbsoluteFill>
);

const StopOutro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <Ending frame={frame} t={t} spb={spb} big="AGREE?" line1="DEFEND YOUR MAIN" line2="IN THE COMMENTS" {...hookOf(plan, "THE HIDDEN META ON")} />
);

export const Stop: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{s_intro: StopIntro, s_over: StopOne, s_switch: StopSwitch, s_gem: StopOne, s_outro: StopOutro}} swipeInto={['s_switch', 's_outro']} />
);

// ================================================================ giveaway
const PURPLE = '#9a5aff';

const GwIntro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={PURPLE} t={t} rays={0.9} cy={1150} />
    <Title text="FREE" size={260} gold frame={frame} y={420} glow="#ff3c8a" />
    <Title text="GIVEAWAY" size={190} frame={frame} at={spb} y={640} glow="#ff3c8a" />
    <Halo x={W / 2} y={1150} r={520} color="#ffd23f" a={0.75} />
    {plan.prize && frame > spb * 1.6 && <div style={{position: 'absolute', left: W / 2, top: 1150 + 14 * Math.sin(t * 3),
      transform: `translate(-50%,-50%) scale(${pop(frame, spb * 1.6, 12, 1.8)}) rotate(${-4 + 3 * Math.sin(t * 2)}deg)`}}>
      <Img src={staticFile(plan.prize)} style={{width: 700}} /></div>}
    <Burst f={frame - spb * 1.6} x={W / 2} y={1150} />
    {frame > spb * 2.6 && <Chip text="WIN THE BRAWL PASS" color="#ff3c64" size={72} x={W / 2} y={1560} rot={-3} scale={pop(frame, spb * 2.6, 9, 2)} />}
  </AbsoluteFill>
);

const GwDays: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const days = plan.days || 0;
  return (
    <AbsoluteFill>
      <Backdrop color="#ff3c64" t={t} rays={1} cy={830} />
      <BrandBug />
      {days <= 3 && <Title text="LAST CHANCE" size={140} frame={frame} y={420} color="#ffd0d6" glow="#7a0016" />}
      <Halo x={W / 2} y={830} r={520} color="#ffd23f" a={0.7} />
      <div style={{position: 'absolute', left: W / 2, top: 830, transform: `translate(-50%,-50%) scale(${1 + 0.9 * (1 - outBack(frame / 12, 1.4)) + 0.04 * Math.sin(t * 8)})`}}>
        <Title text={String(days)} size={520} gold frame={999} x={0} y={0} glow="#7a0016" />
      </div>
      <Title text={days === 1 ? 'DAY LEFT' : 'DAYS LEFT'} size={170} frame={frame} at={spb * 0.8} y={1180} />
      {frame > spb * 1.6 && <Chip text="ENDS NOV 30" color="#283069" size={68} x={W / 2} y={1420} scale={pop(frame, spb * 1.6)} />}
    </AbsoluteFill>
  );
};

const GwHow: React.FC<SceneProps> = ({frame, t, spb}) => {
  const steps: [string, string, string][] = [['1', 'GO TO', 'brawlzone.net/giveaway'], ['2', 'TYPE YOUR', 'PLAYER TAG'], ['3', "DONE! IT'S", 'FREE']];
  return (
    <AbsoluteFill>
      <Backdrop color={PURPLE} t={t} rays={0.4} />
      <BrandBug />
      <Title text="HOW TO ENTER" size={140} gold frame={frame} y={390} glow="#ff3c8a" />
      {steps.map(([n, a, b], i) => {
        const at = spb * 0.8 + i * spb * 1.6;
        if (frame < at) return null;
        const y = 720 + i * 360;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: 150, top: y, transform: `translate(-50%,-50%) scale(${pop(frame, at, 9, 2.2)})`, width: 180, height: 180, borderRadius: '50%',
              background: 'linear-gradient(180deg,#ff7a9a,#ff2f5c)', boxShadow: `0 0 0 8px ${INK}, 0 14px 0 8px ${DEEP}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Label text={n} size={120} /></div>
            <div style={{position: 'absolute', left: 620, top: y - 70, transform: `translate(-50%,-50%) scale(${pop(frame, at + 3)})`}}><Label text={a} size={60} color="#e2d8ff" /></div>
            {i === 0
              ? <SearchBar frame={frame} at={at + 4} x={640} y={y + 30} width={760} height={100} text={b} />
              : <div style={{position: 'absolute', left: 620, top: y + 30, transform: `translate(-50%,-50%) scale(${pop(frame, at + 5)})`}}><Label text={b} size={104} /></div>}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

const GwMore: React.FC<SceneProps> = ({frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={PURPLE} t={t} rays={0.6} />
    <BrandBug />
    <Title text="MORE POINTS" size={160} frame={frame} y={520} glow="#ff3c8a" />
    <Title text="= MORE CHANCES" size={124} gold frame={frame} at={spb * 0.7} y={720} glow="#ff3c8a" />
    {frame > spb * 1.4 && <Chip text="+2 JOIN OUR DISCORD" color="#5865f2" size={76} x={W / 2} y={1060} rot={3} scale={pop(frame, spb * 1.4, 9, 2)} />}
    {frame > spb * 1.9 && <Chip text="+1 PER FRIEND" color="#3cc878" size={76} x={W / 2} y={1260} rot={-3} scale={pop(frame, spb * 1.9, 9, 2)} />}
  </AbsoluteFill>
);

const GwOutro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const bounce = Math.abs(Math.sin((frame / spb) * Math.PI)) * 24;
  return (
    <AbsoluteFill>
      <Backdrop color={PURPLE} t={t} rays={0.7} cy={1100} />
      <Confetti t={frame / 30} />
      <Title text="ENTER NOW" size={210} gold frame={frame} y={440 - bounce} glow="#ff3c8a" />
      <SearchBar frame={frame} at={spb * 0.6} y={650} text="brawlzone.net/giveaway" height={130} />
      {frame > spb * 1.1 && <Arrow x={W / 2} y={840 + Math.abs(Math.sin(t * 6)) * 30} size={130} />}
      {plan.prize && frame > spb * 1.4 && <div style={{position: 'absolute', left: W / 2, top: 1120, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 1.4)}) rotate(${4 * Math.sin(t * 2)}deg)`}}>
        <Img src={staticFile(plan.prize)} style={{width: 420}} /></div>}
      <FollowButton frame={frame} at={spb * 2.4} y={1450} />
      {frame > spb * 2.8 && <div style={{position: 'absolute', left: W / 2, top: 1590, transform: 'translate(-50%,-50%)'}}><Label text="FOR THE WINNER ON NOV 30" size={54} color="#ffe45a" /></div>}
    </AbsoluteFill>
  );
};

export const Giveaway: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{g_intro: GwIntro, g_days: GwDays, g_how: GwHow, g_more: GwMore, g_outro: GwOutro}} swipeInto={['g_days', 'g_how', 'g_outro']} />
);

// ================================================================ drops
const dropArt = (plan: any, i: number) => {
  const keys = Object.keys(plan.art || {}).filter((k) => k !== 'UltraGrey');
  return keys.length ? plan.art[keys[((i % keys.length) + keys.length) % keys.length]] : null;
};
const barCol = (plan: any, i: number) => (plan.bars?.length ? plan.bars[((i % plan.bars.length) + plan.bars.length) % plan.bars.length].color : '#ffcd28');

const SimNote: React.FC = () => (
  <div style={{position: 'absolute', left: W / 2, top: 285, transform: 'translate(-50%,-50%)'}}><Label text="SIMULATED WITH THE REAL DROP RATES" size={34} color="#efeaff" stroke={5} /></div>
);

const DropsIntro: React.FC<SceneProps> = ({plan, frame, t, spb, beat}) => {
  const i = Math.floor(beat * 2);
  const art = dropArt(plan, i);
  const name = plan.name || 'DROPS';
  return (
    <AbsoluteFill>
      <Backdrop color={barCol(plan, i)} t={t} rays={0.9} cy={1180} />
      <BrandBug /><SimNote />
      <Title text="1,000" size={300} gold frame={frame} y={560} glow="#ff3c8a" />
      <Title text={name} size={name.length <= 12 ? 150 : 118} frame={frame} at={spb} y={790} glow="#ff3c8a" />
      <Halo x={W / 2} y={1180} r={460} color="#ffffff" a={0.5} />
      {art && frame > spb * 1.5 && <div style={{position: 'absolute', left: W / 2, top: 1180 + 16 * Math.sin(t * 3), transform: `translate(-50%,-50%) scale(${pop(frame, spb * 1.5, 12, 1.8)}) rotate(${4 * Math.sin(t * 5)}deg)`}}>
        <Img src={staticFile(art)} style={{width: 520}} /></div>}
      {frame > spb * 2.6 && <Chip text="WHAT DO YOU GET?" color="#ff3c64" size={76} x={W / 2} y={1560} rot={-3} scale={pop(frame, spb * 2.6, 9, 2)} />}
    </AbsoluteFill>
  );
};

const DropsOpen: React.FC<SceneProps> = ({plan, frame, t, beat}) => {
  const prog = outCubic(beat / 4.5);
  const done = prog >= 0.999;
  const i = done ? (plan.bars?.length || 1) - 1 : Math.floor(t * 9);
  const art = dropArt(plan, i);
  const bars: any[] = plan.bars || [];
  const most = Math.max(1, ...bars.map((b) => b.count));
  return (
    <AbsoluteFill>
      <Backdrop color={barCol(plan, i)} t={t} rays={0.8} cy={880} />
      <SpeedLines t={t} a={done ? 0 : 0.25} cy={880} />
      <BrandBug /><SimNote />
      <div style={{position: 'absolute', left: W / 2, top: 400, transform: 'translate(-50%,-50%)'}}><Label text={done ? 'OPENED!' : 'OPENING...'} size={86} /></div>
      <Title text={Math.round((plan.n || 1000) * prog).toLocaleString('en-US')} size={210} gold frame={999} y={570} />
      {art && <div style={{position: 'absolute', left: W / 2, top: 880, transform: `translate(-50%,-50%) rotate(${done ? 0 : 7 * Math.sin(t * 45)}deg) scale(${1 + (done ? 0 : 0.05 * Math.abs(Math.sin(t * 20)))})`}}>
        <Img src={staticFile(art)} style={{width: 400}} /></div>}
      {done && <Burst f={frame - Math.round(4.5 * (plan.step * plan.fps))} x={W / 2} y={880} />}
      <div style={{position: 'absolute', left: 70, top: 1110, width: W - 140, padding: '26px 30px', borderRadius: 40, background: 'rgba(10,12,30,0.72)', boxShadow: `0 0 0 6px ${INK}`}}>
        {bars.map((b, j) => {
          const n = Math.round(b.count * prog);
          return (
            <div key={j} style={{display: 'flex', alignItems: 'center', height: 86}}>
              <div style={{width: 330}}><Label text={b.label} size={b.label.length > 15 ? 27 : b.label.length > 11 ? 33 : 42} color={b.color} stroke={5} /></div>
              <div style={{flex: 1, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', boxShadow: `inset 0 0 0 4px ${INK}`}}>
                <div style={{width: `${(100 * n) / most}%`, height: '100%', borderRadius: 22, background: `linear-gradient(180deg, ${mix(b.color, '#fff', 0.45)}, ${b.color} 55%, ${shade(b.color, 0.7)})`}} />
              </div>
              <div style={{width: 150, textAlign: 'right'}}><Label text={n.toLocaleString('en-US')} size={52} /></div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const DropsLoot: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color="#ffcd28" t={t} rays={0.7} cy={1000} />
    <BrandBug /><SimNote />
    <Title text="THE LOOT" size={160} gold frame={frame} y={430} glow="#a04a00" />
    {(plan.loot || []).map((l: any, i: number) => {
      const at = spb * (1 + i);
      if (frame < at) return null;
      const y = 730 + i * 300;
      return (
        <React.Fragment key={i}>
          <div style={{position: 'absolute', left: 250, top: y, transform: `translate(-50%,-50%) scale(${pop(frame, at, 9, 2)}) rotate(${-6 + 3 * Math.sin(t * 2 + i)}deg)`}}>
            <Img src={staticFile(l.icon)} style={{width: 220}} /></div>
          <div style={{position: 'absolute', left: 650, top: y - 30, transform: `translate(-50%,-50%) scale(${pop(frame, at + 3)})`}}>
            <Title text={Math.round(l.total * outCubic((frame - at) / 18)).toLocaleString('en-US')} size={140} gold frame={999} x={0} y={0} /></div>
          <div style={{position: 'absolute', left: 650, top: y + 80, transform: `translate(-50%,-50%) scale(${pop(frame, at + 6)})`}}><Label text={l.key} size={56} /></div>
        </React.Fragment>
      );
    })}
  </AbsoluteFill>
);

const DropsGood: React.FC<SceneProps> = ({plan, frame, t, spb, beat}) => (
  <AbsoluteFill>
    <Backdrop color="#c05bff" t={t} rays={0.6} />
    <BrandBug /><SimNote />
    <Title text="THE GOOD STUFF" size={136} gold frame={frame} y={430} glow="#ff3c8a" />
    {(plan.good || []).map((g: any, i: number) => {
      const at = spb * (1 + i);
      const k = pop(frame, at, 9, 2);
      if (k <= 0) return null;
      const x = i % 2 === 0 ? 290 : 790, y = 740 + Math.floor(i / 2) * 330;
      return (
        <div key={i} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${k})`}}>
          <HoloCard size={440} rim="#c05bff" t={t} beat={beat + i * 0.2} inner="#5f3cc8" radius={50}>
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -40}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                <Img src={staticFile(g.icon)} style={{width: 140}} />
                <InlineTitle text={`x${g.count}`} size={g.count >= 100 ? 84 : 104} gold />
              </div>
            </div>
            <div style={{position: 'absolute', bottom: 60, left: 0, right: 0, textAlign: 'center'}}><Label text={g.label} size={g.label.length > 12 ? 38 : 46} /></div>
          </HoloCard>
        </div>
      );
    })}
  </AbsoluteFill>
);

const DropsLeg: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const legs: any[] = plan.legBrawlers || [];
  const xs = ({1: [W / 2], 2: [330, 750], 3: [220, W / 2, 860]} as Record<number, number[]>)[legs.length] || [];
  return (
    <AbsoluteFill>
      <Backdrop color="#ffcd28" t={t} rays={1} cy={1150} />
      <BrandBug /><SimNote />
      <Title text="LEGENDARY" size={150} gold frame={frame} y={420} glow="#a04a00" />
      <Title text="BRAWLERS" size={130} frame={frame} at={spb * 0.5} y={580} glow="#a04a00" />
      {frame > spb * 1.2 && <div style={{position: 'absolute', left: W / 2, top: 780, transform: `translate(-50%,-50%) scale(${1 + 0.8 * (1 - outBack((frame - spb * 1.2) / 12, 1.4))})`}}>
        <Title text={`x${plan.legs || 0}`} size={220} gold frame={999} x={0} y={0} /></div>}
      {legs.map((b, i) => {
        const at = spb * 2 + i * spb * 0.6;
        if (frame < at) return null;
        return (
          <React.Fragment key={i}>
            <Halo x={xs[i]} y={1230} r={300} color="#fff6b0" a={0.6} />
            <div style={{position: 'absolute', left: xs[i], top: 1230, transform: `translate(-50%,-50%) scale(${pop(frame, at, 11, 1.8)})`}}><Art src={b.art} size={legs.length > 2 ? 400 : 520} /></div>
            <Burst f={frame - at} x={xs[i]} y={1230} />
            <div style={{position: 'absolute', left: xs[i], top: 1560, transform: `translate(-50%,-50%) scale(${pop(frame, at + 4)})`}}><Label text={b.name} size={legs.length > 2 ? 52 : 64} /></div>
          </React.Fragment>
        );
      })}
      {!legs.length && frame > spb * 2 && <Title text="NONE..." size={150} frame={frame} at={spb * 2} y={1200} color="#ff7a8a" />}
    </AbsoluteFill>
  );
};

const DropsUltra: React.FC<SceneProps> = ({plan, frame, t, spb, beat}) => {
  const got = (plan.ultras || []).length > 0;
  const ultra = plan.art?.Ultra || dropArt(plan, -1);
  const reveal = beat >= 6;
  const rf = frame - 6 * spb;
  return (
    <AbsoluteFill>
      <Backdrop color={reveal && got ? '#ffcd28' : '#ff4fa3'} t={t} rays={reveal ? 1 : Math.min(1, 0.4 + beat * 0.1)} cy={1100} />
      {!reveal && <SpeedLines t={t} a={Math.min(0.6, beat * 0.1)} cy={1100} />}
      {reveal && got && <Confetti t={rf / 30} />}
      <BrandBug /><SimNote />
      <Title text="ULTRA BRAWLER?" size={128} gold frame={frame} y={430} glow="#7a0040" />
      {frame > spb * 0.8 && plan.ultraIn && <Chip text={`1 IN ${plan.ultraIn.toLocaleString('en-US')}`} color="#ff3c64" size={76} x={W / 2} y={610} rot={-3} scale={pop(frame, spb * 0.8, 9, 2)} />}
      {!reveal && ultra && <>
        <Halo x={W / 2} y={1100} r={420 + beat * 30} color="#ffffff" a={0.3 + beat * 0.08} />
        <div style={{position: 'absolute', left: W / 2, top: 1100, transform: `translate(-50%,-50%) rotate(${beat * 2 * Math.sin(t * 40)}deg) scale(${1 + 0.02 * beat * Math.abs(Math.sin(t * 30))})`}}>
          <Img src={staticFile(ultra)} style={{width: 480}} /></div>
        {beat > 1.5 && <div style={{position: 'absolute', left: W / 2, top: 1490 + 10 * Math.sin(t * 8), transform: 'translate(-50%,-50%)'}}><Label text="..." size={150} /></div>}
      </>}
      {reveal && got && <>
        <Burst f={rf} x={W / 2} y={1120} />
        <div style={{position: 'absolute', left: W / 2, top: 1120, transform: `translate(-50%,-50%) scale(${pop(frame, 6 * spb, 12, 1.8)})`}}><Art src={plan.ultras[0].art} size={640} /></div>
        <Title text={`WE GOT ${plan.ultras[0].name}!`} size={104} gold frame={frame} at={6.3 * spb} y={1540} />
      </>}
      {reveal && !got && <>
        {plan.art?.UltraGrey && <Img src={staticFile(plan.art.UltraGrey)} style={{position: 'absolute', left: W / 2 - 240, top: 820, width: 480}} />}
        <div style={{position: 'absolute', left: W / 2, top: 1060, transform: `translate(-50%,-50%) scale(${pop(frame, 6 * spb, 8, 1.2)})`}}><Title text="0" size={300} frame={999} x={0} y={0} color="#ff7a8a" /></div>
        <Title text="NOT EVEN ONE" size={118} frame={frame} at={6.6 * spb} y={1450} />
      </>}
      {reveal && <Flare f={rf} y={1100} />}
    </AbsoluteFill>
  );
};

const DropsOutro: React.FC<SceneProps> = ({plan, frame, t, spb, beat}) => {
  const art = dropArt(plan, Math.floor(beat));
  const bounce = Math.abs(Math.sin((frame / spb) * Math.PI)) * 22;
  return (
    <AbsoluteFill>
      <Backdrop color="#ffcd28" t={t} rays={0.7} cy={1090} />
      <Title text="OPEN YOUR OWN" size={150} gold frame={frame} y={420 - bounce} glow="#a04a00" />
      <SearchBar frame={frame} at={spb * 0.6} y={610} text="brawlzone.net/starr-drops" height={116} />
      {frame > spb * 1.1 && <Arrow x={W / 2} y={790 + Math.abs(Math.sin(t * 6)) * 30} size={120} />}
      {art && frame > spb * 1.4 && <div style={{position: 'absolute', left: W / 2, top: 1080, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 1.4)}) rotate(${5 * Math.sin(t * 3)}deg)`}}>
        <Img src={staticFile(art)} style={{width: 330}} /></div>}
      <FollowButton frame={frame} at={spb * 2.4} y={1390} />
      {frame > spb * 2.8 && <div style={{position: 'absolute', left: W / 2, top: 1530, transform: 'translate(-50%,-50%)'}}><Label text="FOR THE NEXT 1,000" size={56} color="#fff6b0" /></div>}
    </AbsoluteFill>
  );
};

export const Drops: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{d_intro: DropsIntro, d_open: DropsOpen, d_loot: DropsLoot, d_good: DropsGood, d_leg: DropsLeg, d_ultra: DropsUltra, d_outro: DropsOutro}}
    swipeInto={['d_loot', 'd_good', 'd_leg', 'd_ultra', 'd_outro']} />
);
