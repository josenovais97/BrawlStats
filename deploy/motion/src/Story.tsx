// The Instagram Stories (2026-11-25, owner: "we only post one story per day,
// we need to post at least 3 good ones, with nice stuff"): one short scene
// each, in the Shorts' look. deploy/story/plan.py decides what each says.
// Instagram lays the account's name over the top ~250 px and its reply bar
// over the bottom ~320, and the API takes no link sticker, so everything sits
// between y 270 and 1590 and the ask is "link in bio".
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {Arrow, Art, Backdrop, Burst, Chip, Confetti, Crown, Flare, Halo, HoloCard, Label, RankTag, Ring, SearchBar, SpeedLines, Title} from './fx';
import {BODY, DEEP, INK, TIER, W, alpha, clamp, mix, outBack, outCubic, shade, Plan} from './theme';
import {TrendArrow} from './Tier';

const pop = (frame: number, at: number, len = 9, s = 2) => (frame < at ? 0 : outBack((frame - at) / len, s));
type P = {plan: Plan; frame: number; t: number};

/** The address typed in, and where to tap. */
const Ask: React.FC<{frame: number; at: number; url: string; chip?: string; y?: number}> = ({frame, at, url, chip = 'LINK IN BIO', y = 1425}) => (
  <>
    <SearchBar frame={frame} at={at} y={y} text={url} height={124} width={900} />
    {frame > at + 16 && <Chip text={chip} color="#ff3c64" size={58} x={W / 2} y={y + 132} rot={-2} scale={pop(frame, at + 16) * (1 + 0.03 * Math.sin(frame / 5))} />}
  </>
);

// ---------------------------------------------------------------- reward
const Reward: React.FC<P> = ({plan, frame, t}) => {
  const bob = 16 * Math.sin(t * 3);
  return (
    <AbsoluteFill>
      <Backdrop color={plan.fresh ? '#ff4f9a' : '#2f8bff'} t={t} rays={1} cy={850} />
      <Title text={plan.fresh ? 'NEW FREE' : "TODAY'S FREE"} size={130} maxWidth={900} frame={frame} y={345} glow="#0f2a8a" />
      <Title text="REWARD" size={210} gold frame={frame} at={12} maxWidth={900} y={520} glow="#0f2a8a" />
      <Halo x={W / 2} y={880} r={520} color="#ffe45a" a={0.85 * clamp((frame - 20) / 8)} />
      <div style={{position: 'absolute', left: W / 2, top: 880 + bob, transform: `translate(-50%,-50%) scale(${pop(frame, 20, 14, 2)}) rotate(${4 * Math.sin(t * 2.2)}deg)`}}>
        <Img src={staticFile(plan.art)} style={{width: 470, height: 470, objectFit: 'contain'}} />
      </div>
      <Burst f={frame - 20} x={W / 2} y={880} />
      <Flare f={frame - 20} y={880} color="#ffe45a" />
      <Title text={plan.name} size={120} maxWidth={920} frame={frame} at={34} y={1175} glow="#0f2a8a" />
      {frame > 56 && <Chip text={plan.more ? `AND ${plan.more} MORE` : plan.fresh ? "CLAIM IT BEFORE IT'S GONE" : 'FREE IN THE SUPERCELL STORE'} color={plan.fresh ? '#3cc878' : '#283069'} size={48} x={W / 2} y={1285} scale={pop(frame, 56)} />}
      <Ask frame={frame} at={74} url="brawlzone.net/rewards" />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ duel
const Side: React.FC<{b: any; left: boolean; frame: number; t: number; reveal: number}> = ({b, left, frame, t, reveal}) => {
  const shown = frame >= reveal;
  const k = outBack((frame - 8) / 12, 1.4);
  const x = left ? 283 : 797;
  const win = shown && b.win;
  const lose = shown && !b.win;
  const n = outCubic((frame - reveal) / 18);
  const c = left ? '#ff3c64' : '#3c7bff';
  const up = win ? outBack((frame - reveal) / 10, 2) : 0;
  return (
    <div style={{position: 'absolute', left: x, top: 955, width: 470, height: 770, transform: `translate(-50%,-50%) translateX(${(left ? -1 : 1) * 700 * (1 - k)}px) scale(${1 + 0.05 * up - (lose ? 0.05 : 0)})`, opacity: lose ? 0.62 : 1, zIndex: win ? 3 : 1}}>
      <div style={{position: 'absolute', inset: 0, borderRadius: 60, overflow: 'hidden',
        background: `radial-gradient(90% 70% at 50% 35%, ${mix(c, '#ffffff', 0.45)} 0%, ${c} 50%, ${shade(c, 0.45)} 100%)`,
        boxShadow: `0 0 0 10px ${win ? '#ffd23f' : INK}, 0 18px 0 10px ${DEEP}`}}>
        <AbsoluteFill style={{backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.09) 0 22px, transparent 22px 64px)'}} />
        <div style={{position: 'absolute', left: '50%', top: 300, transform: `translate(-50%,-50%) translateY(${8 * Math.sin(t * 3 + (left ? 0 : 2))}px)`}}>
          <Art src={b.art} size={520} />
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 330, background: `linear-gradient(0deg, ${alpha(DEEP, 0.92)} 45%, transparent)`}} />
      </div>
      <div style={{position: 'absolute', left: '50%', bottom: 165, transform: 'translateX(-50%)'}}>
        <Label text={b.name} size={Math.min(82, 430 / (b.name.length * 0.62))} />
      </div>
      <div style={{position: 'absolute', left: '50%', bottom: 34, transform: `translateX(-50%) scale(${shown ? outBack((frame - reveal) / 9, 2.2) : 1 + 0.04 * Math.sin(t * 7)})`, whiteSpace: 'nowrap'}}>
        <Label text={shown ? `${(b.wr * 100 * n).toFixed(1)}%` : '?'} size={104} color={win ? '#7dff9b' : shown ? '#ff9aa9' : '#ffe45a'} />
      </div>
      {win && <div style={{position: 'absolute', left: '50%', top: -92 - 70 * (1 - up), transform: `translateX(-50%) rotate(${5 * Math.sin(t * 3)}deg)`}}><Crown size={160} /></div>}
    </div>
  );
};
const Duel: React.FC<P> = ({plan, frame, t}) => {
  const reveal: number = plan.reveal;
  const left = reveal - frame;
  const sec = Math.ceil(left / 30);
  return (
    <AbsoluteFill>
      <Backdrop color={frame >= reveal ? '#ffb21e' : '#8a5aff'} t={t} rays={0.8} cy={880} />
      <SpeedLines t={t} a={left > 0 ? 0.3 * clamp(1 - left / 45) : 0} cy={880} />
      <RankTag rank={plan.rank} y={290} />
      <Title text="WHO WINS MORE?" size={120} maxWidth={900} gold={frame >= reveal} frame={frame} y={402} glow="#ff3c8a" />
      {plan.sides.map((b: any, i: number) => <Side key={i} b={b} left={i === 0} frame={frame} t={t} reveal={reveal} />)}
      {frame < reveal && frame > 24 && <div style={{position: 'absolute', zIndex: 9, left: W / 2, top: 860, transform: `translate(-50%,-50%) scale(${pop(frame, 24, 9, 2.4)})`}}>
        {left <= 90 ? <Ring n={String(sec)} frac={(left % 30) / 30} color="#ff3c64" size={200} pulse={1 + 0.08 * ((left % 30) / 30)} /> : <InkVs />}
      </div>}
      {frame >= reveal && <><Flare f={frame - reveal} y={880} color="#ffe45a" /><Confetti t={(frame - reveal) / 30} /></>}
      {frame >= reveal && frame < reveal + 4 && <AbsoluteFill style={{background: `rgba(255,255,255,${0.7 * (1 - (frame - reveal) / 4)})`}} />}
      <Ask frame={frame} at={reveal + 34} url="brawlzone.net" chip="FULL TIER LIST: LINK IN BIO" y={1452} />
      {frame < reveal && <div style={{position: 'absolute', left: W / 2, top: 1440, transform: 'translate(-50%,-50%)'}}><Label text="PICK ONE BEFORE THE TIMER ENDS" size={54} color="#ffe45a" /></div>}
    </AbsoluteFill>
  );
};
const InkVs: React.FC = () => (
  <div style={{width: 190, height: 190, borderRadius: '50%', background: 'linear-gradient(180deg,#ffe45a,#ff8a10)', boxShadow: `0 0 0 10px ${INK}, 0 14px 0 10px ${DEEP}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
    <Label text="VS" size={96} />
  </div>
);

// ----------------------------------------------------------------- roast
const Roast: React.FC<P> = ({plan, frame, t}) => {
  const line: string = plan.line;
  const size = line.length <= 60 ? 70 : line.length <= 90 ? 62 : 54;
  const typeAt = 34;
  const n = Math.round(clamp((frame - typeAt) / (line.length / 1.5)) * line.length);
  const done = typeAt + line.length / 1.5;
  return (
    <AbsoluteFill>
      <Backdrop color="#ff5a28" t={t} rays={0.9} cy={800} />
      <Title text="ROAST OF THE DAY" size={112} maxWidth={920} gold frame={frame} y={340} glow="#7a0016" />
      <Title text={`${plan.b.name} MAINS`} size={104} maxWidth={900} frame={frame} at={12} y={480} glow="#7a0016" />
      <Halo x={W / 2} y={790} r={430} color="#ffd23f" a={0.6} />
      <div style={{position: 'absolute', left: W / 2, top: 800 + 10 * Math.sin(t * 3), transform: `translate(-50%,-50%) scale(${pop(frame, 14, 12, 1.8)}) rotate(${2 * Math.sin(t * 2)}deg)`}}>
        <Art src={plan.b.art} size={520} />
      </div>
      <div style={{position: 'absolute', left: W / 2, top: 1185, width: 920, transform: `translate(-50%,-50%) scale(${pop(frame, 26, 10, 1.6)})`, borderRadius: 46, padding: '40px 46px 46px',
        background: 'rgba(12,12,26,0.9)', boxShadow: `0 0 0 8px ${INK}, 0 16px 0 8px ${DEEP}, inset 0 0 0 6px #ff8a1e`, textAlign: 'center', fontFamily: BODY, fontSize: size, lineHeight: 1.18, color: '#fff'}}>
        {line.slice(0, n)}<span style={{color: 'transparent'}}>{line.slice(n)}</span>
      </div>
      {frame > done + 6 && <div style={{position: 'absolute', left: 868, top: 905, transform: `translate(-50%,-50%) rotate(12deg) scale(${1 + 1.4 * (1 - outBack((frame - done - 6) / 8, 1))})`, opacity: clamp((frame - done - 6) / 3),
        padding: '12px 30px 16px', borderRadius: 26, border: '12px solid #ff3c64', background: 'rgba(10,12,30,0.6)', boxShadow: `0 0 0 6px ${INK}`}}><Label text="OUCH" size={92} color="#ff3c64" /></div>}
      <Ask frame={frame} at={Math.round(done) + 20} url="brawlzone.net/roast" chip="GET ROASTED: LINK IN BIO" />
    </AbsoluteFill>
  );
};

// --------------------------------------------------------- gems and traps
const List: React.FC<P> = ({plan, frame, t}) => {
  const gems = plan.story === 'gems';
  const c = gems ? '#7dff9b' : '#ff8a9a';
  return (
    <AbsoluteFill>
      <Backdrop color={gems ? '#22b866' : '#e0264f'} t={t} rays={0.7} cy={880} />
      <RankTag rank={plan.rank} y={296} />
      <Title text={gems ? 'HIDDEN GEMS' : 'STOP PICKING'} size={140} maxWidth={900} gold={gems} frame={frame} y={424} glow={gems ? '#0a5a30' : '#5a0018'} />
      <div style={{position: 'absolute', left: W / 2, top: 548, transform: 'translate(-50%,-50%)'}}><Label text={gems ? 'FEW PICK THEM. THEY WIN.' : 'POPULAR. BUT THEY LOSE.'} size={52} /></div>
      {plan.items.map((b: any, i: number) => {
        const at = 24 + i * 26;
        if (frame < at) return null;
        const k = outBack((frame - at) / 11, 1.4);
        const n = outCubic((frame - at - 6) / 16);
        return (
          <div key={i} style={{position: 'absolute', left: W / 2, top: 735 + i * 224, width: 930, height: 194, transform: `translate(-50%,-50%) translateX(${(i % 2 ? 1 : -1) * 900 * (1 - k)}px)`, borderRadius: 46,
            background: gems ? 'linear-gradient(180deg, rgba(20,60,44,0.96), rgba(8,22,26,0.96))' : 'linear-gradient(180deg, rgba(70,16,36,0.96), rgba(28,8,20,0.96))',
            boxShadow: `0 0 0 8px ${INK}, 0 14px 0 8px ${DEEP}, inset 0 0 0 5px ${alpha(c, 0.5)}`}}>
            <div style={{position: 'absolute', left: 22, top: 22, width: 150, height: 150, borderRadius: 32, overflow: 'hidden', boxShadow: `0 0 0 6px ${INK}`, transform: `rotate(${2 * Math.sin(t * 2 + i)}deg)`}}><Img src={staticFile(b.face)} style={{width: 150, height: 150}} /></div>
            <div style={{position: 'absolute', left: 206, top: 44}}><Label text={b.name} size={Math.min(74, 360 / (b.name.length * 0.62))} /></div>
            <div style={{position: 'absolute', left: 206, top: 126}}><Label text={`#${b.picks} OF ${b.of} IN PICKS`} size={40} color="#cfd6ff" stroke={5} /></div>
            <div style={{position: 'absolute', right: 34, top: 34, textAlign: 'right'}}><Label text={`${(b.wr * 100 * n).toFixed(1)}%`} size={92} color={c} /></div>
            <div style={{position: 'absolute', right: 38, top: 136}}><Label text="WIN RATE" size={34} color="#cfd6ff" stroke={5} /></div>
          </div>
        );
      })}
      <Ask frame={frame} at={112} url="brawlzone.net" chip="FULL TIER LIST: LINK IN BIO" />
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------------- guess
const Guess: React.FC<P> = ({plan, frame, t}) => {
  const zooms: string[] = plan.zooms;
  const per: number = plan.per;
  const i = Math.min(zooms.length - 1, Math.max(0, Math.floor((frame - 20) / per)));
  const f = frame - 20 - i * per;
  return (
    <AbsoluteFill>
      <Backdrop color="#7a5cff" t={t} rays={0.8} cy={900} />
      <Title text="WHO IS THIS" size={140} maxWidth={900} frame={frame} y={345} glow="#1a3cff" />
      <Title text="BRAWLER?" size={180} maxWidth={860} gold frame={frame} at={10} y={505} glow="#1a3cff" />
      <div style={{position: 'absolute', left: W / 2, top: 935, transform: `translate(-50%,-50%) rotate(${2 * Math.sin(t * 1.6)}deg) scale(${pop(frame, 16, 12, 1.6) * (1 + 0.06 * Math.max(0, 1 - f / 8))})`}}>
        <HoloCard size={660} rim="#ffd23f" t={t} beat={t * 1.6} inner="#1e2350">
          <Img src={staticFile(zooms[i])} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
        </HoloCard>
      </div>
      <div style={{position: 'absolute', left: W / 2, top: 1330, transform: 'translate(-50%,-50%)', display: 'flex', gap: 20}}>
        {zooms.map((_, k) => <div key={k} style={{width: 120, height: 26, borderRadius: 13, background: k <= i ? '#ffd23f' : 'rgba(255,255,255,0.25)', boxShadow: `0 0 0 5px ${INK}`}} />)}
      </div>
      <Ask frame={frame} at={20 + per * zooms.length - 20} url="brawlzone.net/daily-challenge" chip="THE ANSWER: LINK IN BIO" y={1450} />
    </AbsoluteFill>
  );
};

// -------------------------------------------------------------- giveaway
const Give: React.FC<P> = ({plan, frame, t}) => (
  <AbsoluteFill>
    <Backdrop color="#9a5aff" t={t} rays={1} cy={860} />
    <Confetti t={t * 0.7} />
    <Title text="FREE" size={190} gold frame={frame} y={360} glow="#ff3c8a" />
    <Title text="BRAWL PASS" size={170} maxWidth={920} frame={frame} at={10} y={540} glow="#ff3c8a" />
    <Halo x={W / 2} y={850} r={470} color="#ffd23f" a={0.75} />
    <div style={{position: 'absolute', left: W / 2, top: 850 + 14 * Math.sin(t * 3), transform: `translate(-50%,-50%) scale(${pop(frame, 20, 12, 1.8)}) rotate(${-4 + 3 * Math.sin(t * 2)}deg)`}}>
      <Img src={staticFile(plan.prize)} style={{width: 560}} />
    </div>
    <Burst f={frame - 20} x={W / 2} y={850} />
    <Title text={plan.days === 0 ? 'ENDS TODAY' : plan.days === 1 ? '1 DAY LEFT' : `${plan.days} DAYS LEFT`} size={150} maxWidth={880} gold frame={frame} at={40} y={1140} glow="#7a0016" />
    {frame > 62 && <Chip text={`${plan.entrants}+ PLAYERS ARE IN`} color="#3cc878" size={56} x={W / 2} y={1275} scale={pop(frame, 62)} />}
    <Ask frame={frame} at={80} url="brawlzone.net/giveaway" chip="ENTER FREE: LINK IN BIO" />
  </AbsoluteFill>
);

// -------------------------------------------------------------- telegram
const Plane: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 240 240">
    <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#37bbfe" /><stop offset="1" stopColor="#007dbb" /></linearGradient></defs>
    <circle cx="120" cy="120" r="112" fill="url(#tg)" stroke={INK} strokeWidth="12" />
    <path d="M52 118 L186 66 C192 64 197 67 195 76 L172 178 C170 185 165 187 159 183 L124 157 L107 174 C104 177 102 178 98 178 L101 142 L166 83 C169 80 165 79 161 82 L80 133 L46 122 C42 121 43 120 52 118 Z" fill="#fff" />
  </svg>
);
const Telegram: React.FC<P> = ({plan, frame, t}) => (
  <AbsoluteFill>
    <Backdrop color="#2aa5e8" t={t} rays={0.8} cy={820} />
    <Title text="FREE REWARDS" size={128} maxWidth={920} gold frame={frame} y={345} glow="#06406a" />
    <Title text="ON TELEGRAM" size={128} maxWidth={920} frame={frame} at={12} y={490} glow="#06406a" />
    <div style={{position: 'absolute', zIndex: 4, left: 190, top: 665, transform: `translate(-50%,-50%) scale(${pop(frame, 22, 10, 2.4)}) rotate(${6 * Math.sin(t * 2.5)}deg)`}}><Plane size={220} /></div>
    {/* a post in the channel */}
    <div style={{position: 'absolute', left: W / 2 + 20, top: 915, width: 820, transform: `translate(-50%,-50%) scale(${pop(frame, 34, 12, 1.5)}) translateY(${6 * Math.sin(t * 2.4)}px)`, borderRadius: 44, overflow: 'hidden', background: '#ffffff',
      boxShadow: `0 0 0 8px ${INK}, 0 18px 0 8px ${DEEP}`}}>
      <div style={{position: 'relative', width: 820, height: 400, overflow: 'hidden', background: 'radial-gradient(80% 90% at 50% 45%, #8fd0ff 0%, #2f8bff 55%, #1440a8 100%)'}}>
        <div style={{position: 'absolute', left: '50%', top: '50%', width: 1400, height: 1400, transform: `translate(-50%,-50%) rotate(${t * 12}deg)`, background: 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.18) 0deg 7deg, transparent 7deg 20deg)'}} />
        <Img src={staticFile(plan.art)} style={{position: 'absolute', left: 120, top: 50, width: 300, height: 300, objectFit: 'contain', transform: `rotate(${4 * Math.sin(t * 2)}deg)`}} />
        <div style={{position: 'absolute', left: 450, top: 110, width: 350}}><Label text="FREE" size={92} color="#ffe45a" /></div>
        <div style={{position: 'absolute', left: 450, top: 220, width: 350}}><Label text={plan.name} size={Math.min(64, 340 / (plan.name.length * 0.64))} /></div>
      </div>
      <div style={{padding: '22px 34px 30px', fontFamily: BODY, color: INK}}>
        <div style={{fontSize: 46}}>New free reward</div>
        <div style={{marginTop: 18, height: 84, borderRadius: 24, background: 'linear-gradient(180deg,#37bbfe,#0a8fd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 44,
          transform: `scale(${frame > 100 && frame % 40 < 6 ? 0.96 : 1})`}}>Claim it</div>
      </div>
    </div>
    {frame > 78 && <Chip text="EVERY NEW REWARD, WITH THE LINK" color="#283069" size={48} x={W / 2} y={1262} scale={pop(frame, 78)} />}
    {plan.manual
      ? frame > 92 && <>{/* room under the arrow for a link sticker, put on by hand */}
        <div style={{position: 'absolute', left: W / 2, top: 1345, transform: 'translate(-50%,-50%)'}}><Label text="JOIN HERE" size={62} color="#ffe45a" /></div>
        <Arrow x={W / 2} y={1425 + Math.abs(Math.sin(t * 5)) * 18} size={90} /></>
      : <Ask frame={frame} at={92} url="@brawlzone_rewards" chip="SEARCH IT ON TELEGRAM" />}
  </AbsoluteFill>
);

// ----------------------------------------------------------------- tiers
const RANK_COL: Record<string, string> = {MASTERS: '#ffb21e', LEGENDARY: '#ff4f6a', MYTHIC: '#b05cff', DIAMOND: '#36b6ff'};
const PER = 8, FACE = 92, LINE = 101, ROW_X = 178;
const Tiers: React.FC<P> = ({plan, frame, t}) => {
  let y = 470;
  const rows = plan.rows.map((r: any) => {
    const lines = Math.max(1, Math.ceil((r.items.length + (r.more ? 1 : 0)) / PER));
    const out = {...r, y, h: lines * LINE + 14};
    y += out.h + 12;
    return out;
  });
  const arrowsAt = 26 + rows.length * 22 + 14;
  return (
    <AbsoluteFill>
      <Backdrop color={RANK_COL[plan.word] || '#ffb21e'} t={t} rays={0.6} cy={860} dark />
      <Title text={`${plan.word} TIER LIST`} size={106} maxWidth={920} gold frame={frame} stagger={0.8} y={325} glow="#1a0a3a" />
      <div style={{position: 'absolute', left: W / 2, top: 412, transform: `translate(-50%,-50%) scale(${pop(frame, arrowsAt, 9, 1.6)})`, display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap'}}>
        <TrendArrow dir={1} size={50} /><Label text="RISING" size={42} color="#8dffab" /><span style={{width: 26}} />
        <TrendArrow dir={-1} size={50} /><Label text="FALLING THIS WEEK" size={42} color="#ff9aa9" />
      </div>
      {rows.map((r: any, i: number) => {
        const at = 18 + i * 22;
        if (frame < at) return null;
        const k = outBack((frame - at) / 9, 1.5);
        const col = TIER[r.tier];
        return (
          <div key={r.tier} style={{position: 'absolute', left: 40, top: r.y, width: 1000, height: r.h, transform: `translateX(${(1 - k) * -900}px)`}}>
            <div style={{position: 'absolute', left: 0, top: 0, width: 124, height: r.h, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(180deg, ${mix(col, '#fff', 0.35)} 0%, ${col} 50%, ${shade(col, 0.7)} 100%)`, boxShadow: `0 0 0 5px ${INK}, 0 9px 0 5px ${DEEP}`}}><Label text={r.tier} size={88} /></div>
            <div style={{position: 'absolute', left: 136, top: 0, width: 864, height: r.h, borderRadius: 24, background: 'rgba(10,12,30,0.78)', boxShadow: `0 0 0 5px ${INK}`}} />
            {r.items.map((b: any, j: number) => {
              const f = frame - at - 5 - j * 0.9;
              if (f < 0) return null;
              const x = ROW_X - 28 + (j % PER) * (FACE + 13), yy = 10 + Math.floor(j / PER) * LINE;
              const a = pop(frame, arrowsAt + 4 + (j % 5) * 2, 9, 2.6);
              return (
                <React.Fragment key={b.id}>
                  <div style={{position: 'absolute', left: x, top: yy, width: FACE, height: FACE, borderRadius: 20, overflow: 'hidden', transform: `scale(${outBack(f / 7, 2)})`, boxShadow: `0 0 0 3px ${INK}`, background: shade(col, 0.6),
                    opacity: b.dir || a === 0 ? 1 : 1 - 0.14 * clamp((frame - arrowsAt) / 10)}}>
                    <Img src={staticFile(b.face)} style={{width: FACE, height: FACE}} />
                  </div>
                  {b.dir !== 0 && a > 0 && <div style={{position: 'absolute', left: x + FACE - 40, top: yy + FACE - 42, transform: `scale(${a * (1 + 0.06 * Math.sin(t * 6 + j))})`}}><TrendArrow dir={b.dir} size={52} /></div>}
                </React.Fragment>
              );
            })}
            {r.more > 0 && frame > at + 14 && <div style={{position: 'absolute', left: ROW_X - 28 + (r.items.length % PER) * (FACE + 13) + 6, top: 10 + Math.floor(r.items.length / PER) * LINE + 24}}><Label text={`+${r.more}`} size={44} color="#cfd6ff" stroke={5} /></div>}
          </div>
        );
      })}
      {frame > arrowsAt + 30 && <div style={{position: 'absolute', left: W / 2, top: Math.min(1355, y + 34), transform: `translate(-50%,-50%) scale(${pop(frame, arrowsAt + 30)})`}}><Label text="AGREE? REPLY WITH YOUR MAIN" size={50} color="#ffe45a" /></div>}
      <Ask frame={frame} at={arrowsAt + 44} url="brawlzone.net/tier-list" chip="EVERY RANK: LINK IN BIO" y={1462} />
    </AbsoluteFill>
  );
};

const KINDS: Record<string, React.FC<P>> = {reward: Reward, new: Reward, duel: Duel, roast: Roast, gems: List, traps: List, tiers: Tiers, guess: Guess, giveaway: Give, telegram: Telegram};
export const Story: React.FC<{plan: Plan}> = ({plan}) => {
  const frame = useCurrentFrame();
  const Scene = KINDS[plan.story as string];
  return <AbsoluteFill style={{background: '#000'}}>{Scene && <Scene plan={plan} frame={frame} t={frame / plan.fps} />}</AbsoluteFill>;
};
