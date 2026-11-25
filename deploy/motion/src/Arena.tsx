// The 2026-11-23 formats (owner: "make some cool new incredible and viral
// videos... do them all"): a tier list for one rank, higher or lower on win
// rates, the most underrated brawler, a two-week win-rate race and "pick one
// from each row". make.py --plan decides what each says; this only draws it.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Art, Backdrop, Banner, BrandBug, Burst, Chip, Confetti, Crown, Flare, Halo, Label, Ring, SpeedLines, Title} from './fx';
import {Ending, Face, StatPill, Stamp, pop} from './Formats';
import {SceneProps, Stage} from './Stage';
import {TrendArrow} from './Tier';
import {DEEP, INK, LEVEL, TIER, W, alpha, clamp, hookOf, mix, outBack, outCubic, shade, Plan} from './theme';

const GREEN = '#3ce07a', RED = '#ff4a62', GOLD = '#ffc53d';
const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (k: number) => k * k * (3 - 2 * k);
/** A league badge by name ("masters"), from the plan's league list or its rank tag. */
const badge = (plan: Plan, name: string): string | undefined =>
  [...(plan.leagues || []), ...(plan.rank?.badges || [])].find((b: string) => b.includes(`league-${name}`));

/** A rounded dark panel. */
const Panel: React.FC<{x: number; y: number; w: number; h: number; color?: string; glow?: number; children?: React.ReactNode}> = ({x, y, w, h, color = '#1b2150', glow = 0, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 26,
    background: `linear-gradient(180deg, ${alpha(mix(color, '#ffffff', 0.08), 0.92)}, ${alpha(shade(color, 0.7), 0.92)})`,
    boxShadow: `0 0 0 5px ${INK}, 0 9px 0 5px ${DEEP}${glow ? `, 0 0 ${40 * glow}px ${12 * glow}px ${alpha(GOLD, 0.6 * glow)}` : ''}`}}>
    {children}
  </div>
);

// ================================================================ ranktier
const RANK_COL: Record<string, string> = {MASTERS: '#ffb21e', LEGENDARY: '#ff4f6a', MYTHIC: '#b05cff', DIAMOND: '#36b6ff'};
const BOARD = {top: 320, bottom: 1500, left: 34, right: W - 34, label: 124, gap: 8, per: 10};

const boardRows = (plan: Plan) => {
  const rows: any[] = plan.rows || [];
  const lines = rows.map((r) => Math.max(1, Math.ceil(r.items.length / BOARD.per)));
  const total = lines.reduce((a, b) => a + b, 0);
  const lineH = Math.min(120, (BOARD.bottom - BOARD.top - BOARD.gap * (rows.length - 1)) / Math.max(1, total));
  const face = Math.min(lineH - 9, (BOARD.right - BOARD.left - BOARD.label - 20) / BOARD.per - 7);
  let y = BOARD.top;
  return rows.map((r, i) => {
    const h = lines[i] * lineH;
    const out = {...r, y, h, lineH, face};
    y += h + BOARD.gap;
    return out;
  });
};

/** The tier board, filled up to tier `upto`; `now` is the tier landing this scene. */
const Board: React.FC<{plan: Plan; upto: number; frame: number; now?: number}> = ({plan, upto, frame, now = -1}) => {
  const rows = boardRows(plan);
  return (
    <>
      {rows.map((r, i) => {
        const col = TIER[r.tier] || '#888';
        const lit = i === now;
        const glow = lit ? clamp(frame / 8) * (0.7 + 0.3 * Math.sin(frame / 4)) : 0;
        return (
          <React.Fragment key={r.tier}>
            <div style={{position: 'absolute', left: BOARD.left, top: r.y, width: BOARD.label, height: r.h - 4, borderRadius: 20,
              opacity: i <= upto ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(180deg, ${mix(col, '#fff', 0.35)} 0%, ${col} 50%, ${shade(col, 0.7)} 100%)`,
              boxShadow: `0 0 0 5px ${INK}, 0 8px 0 5px ${DEEP}${lit ? `, 0 0 ${36 * glow}px ${10 * glow}px ${alpha(col, 0.8)}` : ''}`}}>
              <Label text={r.tier} size={Math.min(96, r.lineH * 0.9)} />
            </div>
            <div style={{position: 'absolute', left: BOARD.left + BOARD.label + 12, top: r.y, width: BOARD.right - BOARD.left - BOARD.label - 12, height: r.h - 4,
              borderRadius: 20, background: lit ? alpha(mix(col, '#0c0e1e', 0.75), 0.92) : 'rgba(10,12,30,0.72)',
              boxShadow: `0 0 0 5px ${INK}${lit ? `, 0 0 ${30 * glow}px ${8 * glow}px ${alpha(col, 0.7)}` : ''}`}} />
            {i <= upto && r.items.map((b: any, j: number) => {
              const at = lit ? 6 + j * Math.max(0.6, 14 / r.items.length) : -99;
              const k = lit ? outBack((frame - at) / 7, 2.2) : 1;
              if (k <= 0) return null;
              const cx = BOARD.left + BOARD.label + 22 + (j % BOARD.per) * (r.face + 7) + r.face / 2;
              const cy = r.y + Math.floor(j / BOARD.per) * r.lineH + r.lineH / 2 - 2;
              return (
                <React.Fragment key={b.id}>
                  <div style={{position: 'absolute', left: cx - r.face / 2, top: cy - r.face / 2, width: r.face, height: r.face, borderRadius: r.face * 0.2,
                    overflow: 'hidden', transform: `translateY(${(1 - k) * -60}px) scale(${k})`, boxShadow: `0 0 0 3px ${INK}`, background: shade(col, 0.6)}}>
                    {b.face && <Img src={staticFile(b.face)} style={{width: r.face, height: r.face}} />}
                  </div>
                  {b.dir && <div style={{position: 'absolute', left: cx + r.face * 0.08, top: cy + r.face * 0.08, transform: `scale(${lit ? outBack((frame - at - 10) / 8, 2.4) : 1})`}}>
                    <TrendArrow dir={b.dir} size={r.face * 0.5} /></div>}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
};

const RtHeader: React.FC<{plan: Plan; frame: number}> = ({plan, frame}) => (
  <Title text={`${plan.word} TIER LIST`} size={86} gold frame={frame + 99} y={222} />
);

const RtIntro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const col = RANK_COL[plan.word] || GOLD;
  const big: string[] = plan.big || [];
  return (
    <AbsoluteFill>
      <Backdrop color={col} t={t} rays={0.9} cy={560} />
      <Halo x={W / 2} y={560} r={420} color={mix(col, '#fff', 0.3)} a={0.9} />
      {big.map((src, i) => {
        const k = pop(frame, i * 4, 10, 1.8);
        const x = W / 2 + (i - (big.length - 1) / 2) * (big.length > 2 ? 210 : 300);
        const s = big.length > 2 ? 250 : 400;
        return k > 0 ? <Img key={i} src={staticFile(src)} style={{position: 'absolute', left: x - s / 2, top: 560 - s / 2, width: s, height: s, objectFit: 'contain',
          transform: `scale(${k}) rotate(${Math.sin(t * 2 + i) * 5}deg)`, filter: 'drop-shadow(0 16px 0 rgba(0,0,0,0.35))'}} /> : null;
      })}
      <Burst f={frame - 4} x={W / 2} y={560} color="#fff6b0" />
      <Title text={plan.word} size={plan.word.length > 8 ? 170 : 210} frame={frame} at={spb} y={900} glow={shade(col, 0.5)} />
      <Title text="TIER LIST" size={220} gold frame={frame} at={spb * 1.8} y={1110} />
      {frame > spb * 3 && <Chip text={`ONLY ${plan.tag} GAMES`} color={shade(col, 0.85)} size={64} x={W / 2} y={1320} scale={pop(frame, spb * 3)} />}
      {frame > spb * 3.6 && <Title text={`${Math.max(1, Math.round((plan.games || 0) / 1000))}K GAMES THIS WEEK · SEASON ${plan.season}`} size={50} frame={frame} at={spb * 3.6} stagger={0.3} y={1470} color="#fff1c9" />}
    </AbsoluteFill>
  );
};

const RtTier: React.FC<SceneProps> = ({plan, seg, frame, t}) => {
  const rows: any[] = plan.rows || [];
  const i = rows.findIndex((r) => r.tier === seg.tier);
  const col = TIER[seg.tier] || GOLD;
  const k = outBack(frame / 9, 1.4);
  const fade = 1 - clamp((frame - 10) / 8);
  return (
    <AbsoluteFill>
      <Backdrop color={mix(col, '#2a2f6a', 0.55)} t={t} rays={0.35} cy={900} dark />
      <RtHeader plan={plan} frame={frame} />
      <Board plan={plan} upto={i} now={i} frame={frame} />
      {fade > 0 && (
        <div style={{position: 'absolute', left: W / 2, top: 900, opacity: fade, transform: `translate(-50%,-50%) scale(${(1 + 1.8 * (1 - k)) * (1 + 0.25 * (1 - fade))})`}}>
          <Title text={seg.tier} size={520} frame={999} color={col} x={0} y={0} glow={shade(col, 0.5)} />
        </div>
      )}
      <Flare f={frame - 2} y={900} color={col} />
      {rows.some((r) => r.items.some((b: any) => b.dir)) && (
        <div style={{position: 'absolute', left: W / 2, top: 1536, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 14}}>
          <TrendArrow dir={1} size={46} /><Label text="RISING" size={38} stroke={6} /><span style={{width: 24}} />
          <TrendArrow dir={-1} size={46} /><Label text="FALLING THIS WEEK" size={38} stroke={6} />
        </div>
      )}
      <div style={{position: 'absolute', left: W / 2, top: 1600, transform: 'translate(-50%,-50%)', opacity: 0.85}}><Label text="brawlzone.net" size={40} stroke={6} /></div>
    </AbsoluteFill>
  );
};

const RtTop: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const b = seg.b;
  const u = frame / 12;
  return (
    <AbsoluteFill>
      <Backdrop color={TIER.S} t={t} rays={1} cy={900} />
      <BrandBug />
      <Title text={`#1 IN ${plan.word}`} size={130} gold frame={frame} y={380} glow="#8a0024" />
      <Halo x={W / 2} y={920} r={520} color="#ffe08a" a={0.85} />
      <div style={{position: 'absolute', left: W / 2, top: 930, transform: `translate(-50%,-50%) translateY(${(1 - outBack(u, 1.4)) * 260}px) scale(${0.6 + 0.4 * outBack(u, 1.5)})`}}>
        <Art src={b.art} size={820} style={{filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <div style={{position: 'absolute', left: W / 2 - 130, top: 470, transform: `scale(${pop(frame, spb, 8, 2)}) rotate(-8deg)`}}><Crown size={260} /></div>
      <Banner text={b.name} color={TIER.S} size={b.name.length <= 8 ? 140 : 110} y={1430} frame={frame} at={4} />
      {frame > spb && <StatPill label="WINS" value={pc(b.wr)} color="#7cff8a" y={1600} scale={pop(frame, spb)} />}
      <Burst f={frame - 3} x={W / 2} y={930} />
      {frame > spb && <Confetti t={(frame - spb) / 30} />}
    </AbsoluteFill>
  );
};

const RtSide: React.FC<{b: any; was: string; now: string; good: boolean; x: number; frame: number; at: number; word: string}> = ({b, was, now, good, x, frame, at, word}) => {
  const k = pop(frame, at, 10, 1.6);
  if (k <= 0) return null;
  const c = good ? GREEN : RED;
  return (
    <div style={{position: 'absolute', left: x, top: 960, transform: `translate(-50%,-50%) scale(${k})`, width: 470, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22}}>
      <Label text={good ? `BETTER IN ${word}` : `WORSE IN ${word}`} size={44} color={c} />
      <div style={{filter: good ? 'none' : 'saturate(0.6)'}}><Face src={b.face} size={300} color={c} /></div>
      <Label text={b.name} size={b.name.length > 8 ? 54 : 66} />
      <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
          <Label text="ALL RANKS" size={26} color="#cfd6ff" stroke={0} />
          <div style={{width: 96, height: 96, borderRadius: 22, background: TIER[was] || '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 5px ${INK}`}}><Label text={was} size={70} /></div>
        </div>
        <Label text=">" size={70} color={c} />
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
          <Label text={word} size={26} color="#cfd6ff" stroke={0} />
          <div style={{width: 120, height: 120, borderRadius: 26, background: TIER[now] || '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 6px ${INK}, 0 0 30px 6px ${alpha(c, 0.7)}`}}><Label text={now} size={90} /></div>
        </div>
      </div>
    </div>
  );
};

const RtDiff: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={RANK_COL[plan.word] || GOLD} t={t} rays={0.5} cy={900} dark />
    <BrandBug />
    <Title text="YOUR RANK" size={120} frame={frame} y={360} />
    <Title text="CHANGES EVERYTHING" size={92} gold frame={frame} at={spb * 0.6} y={500} />
    <RtSide b={seg.up} was={seg.upAll} now={seg.up.tier} good x={W / 2 - 262} frame={frame} at={spb * 1.2} word={plan.word} />
    <RtSide b={seg.down} was={seg.downAll} now={seg.down.tier} good={false} x={W / 2 + 262} frame={frame} at={spb * 2.2} word={plan.word} />
  </AbsoluteFill>
);

const RtOutro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <Ending frame={frame} t={t} spb={spb} color={RANK_COL[plan.word] || GOLD} big="YOUR RANK?" line1="COMMENT YOUR RANK" line2="AND YOUR MAIN" {...hookOf(plan, 'A TIER LIST FOR EVERY RANK')} />
);

export const RankTier: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{rt_intro: RtIntro, rt_tier: RtTier, rt_top: RtTop, rt_diff: RtDiff, rt_outro: RtOutro}} swipeInto={['rt_top', 'rt_diff', 'rt_outro']} />
);

// ================================================================ higherlower
const HL_A = {x: 300, y: 610}, HL_B = {x: 300, y: 1170};

const Button: React.FC<{up: boolean; x: number; y: number; state: number; frame: number}> = ({up, x, y, state, frame}) => {
  // state: 0 waiting, 1 right answer, -1 wrong answer
  const c = up ? GREEN : RED;
  const pulse = state === 1 ? 1 + 0.06 * Math.sin(frame / 3) : 1;
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${pulse})`, width: 380, height: 128, borderRadius: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, opacity: state === -1 ? 0.35 : 1, filter: state === -1 ? 'grayscale(0.8)' : 'none',
      background: `linear-gradient(180deg, ${mix(c, '#fff', 0.35)} 0%, ${c} 50%, ${shade(c, 0.72)} 100%)`,
      boxShadow: `0 0 0 7px ${INK}, 0 12px 0 7px ${DEEP}${state === 1 ? `, 0 0 50px 14px ${alpha(c, 0.8)}` : ''}`}}>
      <svg width={56} height={56} viewBox="0 0 100 100" style={{transform: up ? 'none' : 'rotate(180deg)'}}>
        <path d="M50 8 L94 62 L66 62 L66 94 L34 94 L34 62 L6 62 Z" fill="#fff" stroke={INK} strokeWidth="9" strokeLinejoin="round" />
      </svg>
      <Label text={up ? 'HIGHER' : 'LOWER'} size={66} />
    </div>
  );
};

const HlIntro: React.FC<SceneProps> = ({frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color="#6c4cff" t={t} rays={0.8} cy={820} />
    <Title text="HIGHER" size={250} frame={frame} y={600} color="#8dffb0" glow="#0b6b32" />
    <Title text="OR" size={130} frame={frame} at={spb * 0.5} y={800} />
    <Title text="LOWER" size={250} frame={frame} at={spb * 0.8} y={1000} color="#ffa0ac" glow="#7a0016" />
    {frame > spb * 1.4 && <Chip text="WIN RATE EDITION" color="#ff9a28" size={70} x={W / 2} y={1220} scale={pop(frame, spb * 1.4)} />}
    {frame > spb * 2 && <Title text="6 ROUNDS · EACH ONE HARDER" size={56} frame={frame} at={spb * 2} stagger={0.3} y={1380} color="#e6e0ff" />}
  </AbsoluteFill>
);

const Fighter: React.FC<{b: any; x: number; y: number; scale?: number; dim?: boolean}> = ({b, x, y, scale = 1, dim}) => (
  <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${scale})`}}>
    <Halo x={-250} y={-250} r={250} color={dim ? '#5a6090' : '#ffe08a'} a={0.6} />
    <Art src={b.art} size={470} style={{position: 'relative', filter: dim ? 'saturate(0.4) brightness(0.7)' : 'drop-shadow(0 16px 0 rgba(0,0,0,0.3))'}} />
  </div>
);

const HlRound: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const a = seg.a, b = seg.b;
  const first = seg.i === 0;
  // The last round's mystery brawler climbs into the known slot.
  const kA = first ? pop(frame, 0, 10, 1.4) : outCubic(frame / 10);
  const aY = first ? HL_A.y : lerp(HL_B.y, HL_A.y, kA);
  const kB = outBack((frame - 4) / 11, 1.3);
  const bX = lerp(W + 400, HL_B.x, kB);
  const reveal = spb * 4;
  const shown = frame >= reveal;
  const count = lerp(a.wr, b.wr, smooth(clamp((frame - reveal) / 14)));
  const n = 3 - Math.floor((frame - spb) / spb);
  const ticking = frame >= spb && frame < reveal;
  const right = shown && frame >= reveal + 14;
  const lvl = LEVEL[seg.lvl] || '#ffb428';
  return (
    <AbsoluteFill>
      <Backdrop color="#4a3cc8" t={t} rays={0.4} cy={880} dark />
      <SpeedLines t={t} a={ticking && n === 1 ? 0.3 : 0} cy={880} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 210, display: 'flex', justifyContent: 'center', gap: 22}}>
        <div style={{padding: '10px 28px 12px', borderRadius: 999, background: INK, boxShadow: '0 0 0 5px #fff'}}><Label text={`ROUND ${seg.i + 1}/6`} size={46} stroke={0} /></div>
        <div style={{padding: '10px 28px 12px', borderRadius: 999, background: lvl, boxShadow: `0 0 0 5px ${INK}`}}><Label text={seg.lvl} size={46} /></div>
      </div>
      {/* known */}
      <Fighter b={a} x={HL_A.x} y={aY} scale={0.95} />
      <div style={{position: 'absolute', left: 560, top: aY - 110, width: 480}}>
        <Label text={a.name} size={a.name.length > 8 ? 64 : 80} />
        <div style={{marginTop: 18}}><Label text={pc(a.wr)} size={128} color={GOLD} /></div>
        <div style={{marginTop: 8}}><Label text="WIN RATE" size={36} color="#cfd6ff" stroke={0} /></div>
      </div>
      {/* the line between them, with the clock */}
      <div style={{position: 'absolute', left: 60, right: 60, top: 888, height: 8, borderRadius: 4, background: alpha('#ffffff', 0.35)}} />
      <div style={{position: 'absolute', left: W / 2, top: 892, transform: 'translate(-50%,-50%)'}}>
        {right ? null : ticking ? <Ring n={String(Math.max(1, n))} frac={1 - ((frame - spb) % spb) / spb} color={n === 1 ? RED : GOLD} size={170} pulse={1 + 0.08 * Math.max(0, 1 - ((frame - spb) % spb) / 6)} />
          : <div style={{padding: '12px 30px 14px', borderRadius: 999, background: INK, boxShadow: `0 0 0 6px ${GOLD}`}}><Label text="VS" size={70} color={GOLD} stroke={0} /></div>}
      </div>
      {/* mystery */}
      <Fighter b={b} x={bX} y={HL_B.y} scale={0.95} />
      <div style={{position: 'absolute', left: 560 + (bX - HL_B.x), top: HL_B.y - 110, width: 480}}>
        <Label text={b.name} size={b.name.length > 8 ? 64 : 80} />
        <div style={{marginTop: 18}}>
          {shown ? <Label text={pc(count)} size={128} color={right ? (seg.up ? '#8dffb0' : '#ffa0ac') : '#ffffff'} />
            : <Label text="??.?%" size={128} color="#8f96c8" />}
        </div>
        <div style={{marginTop: 8}}><Label text="WIN RATE" size={36} color="#cfd6ff" stroke={0} /></div>
      </div>
      <Button up x={W / 2 - 205} y={1560} state={right ? (seg.up ? 1 : -1) : 0} frame={frame} />
      <Button up={false} x={W / 2 + 205} y={1560} state={right ? (seg.up ? -1 : 1) : 0} frame={frame} />
      {right && <Stamp text={seg.up ? 'HIGHER!' : 'LOWER!'} color={seg.up ? '#8dffb0' : '#ffa0ac'} frame={frame} at={reveal + 14} x={W / 2} y={892} />}
      <Burst f={frame - reveal - 14} x={760} y={HL_B.y} color={seg.up ? '#b9ffcf' : '#ffc0c8'} />
    </AbsoluteFill>
  );
};

const HL_SCORES: [string, string, string][] = [['6/6', 'pro', 'PRO'], ['5/6', 'masters', 'MASTERS'], ['4/6', 'legendary', 'LEGENDARY'],
  ['3/6', 'mythic', 'MYTHIC'], ['2/6', 'diamond', 'DIAMOND'], ['0-1', 'bronze', 'BRONZE']];
const HlScore: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color="#6c4cff" t={t} rays={0.6} cy={500} />
    <Title text="HOW MANY" size={150} frame={frame} y={330} />
    <Title text="DID YOU GET?" size={130} gold frame={frame} at={spb * 0.4} y={490} />
    {HL_SCORES.map(([score, league, label], i) => {
      const k = pop(frame, spb * 0.8 + i * 4, 8, 1.8);
      if (k <= 0) return null;
      const src = badge(plan, league);
      return (
        <div key={i} style={{position: 'absolute', left: W / 2, top: 680 + i * 150, transform: `translate(-50%,-50%) scale(${k})`, width: 760, height: 124,
          borderRadius: 30, display: 'flex', alignItems: 'center', gap: 30, padding: '0 34px', background: i === 0 ? 'linear-gradient(180deg,#ffe27a,#ffb21e)' : 'rgba(10,12,30,0.8)',
          boxShadow: `0 0 0 5px ${INK}, 0 9px 0 5px ${DEEP}`}}>
          <Label text={score} size={70} color={i === 0 ? INK : '#fff'} stroke={i === 0 ? 0 : undefined} />
          {src && <Img src={staticFile(src)} style={{width: 96, height: 96, objectFit: 'contain'}} />}
          <Label text={label} size={66} color={i === 0 ? INK : GOLD} stroke={i === 0 ? 0 : undefined} />
        </div>
      );
    })}
  </AbsoluteFill>
);

const HlOutro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <Ending frame={frame} t={t} spb={spb} color="#6c4cff" big="YOUR SCORE?" line1="COMMENT IT" line2="BELOW" {...hookOf(plan, 'EVERY WIN RATE ON')} />
);

export const HigherLower: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{hl_intro: HlIntro, hl_round: HlRound, hl_score: HlScore, hl_outro: HlOutro}} swipeInto={['hl_score', 'hl_outro']} />
);

// ================================================================ hiddenop
const SilHero: React.FC<{plan: Plan; y: number; size: number; t: number}> = ({plan, y, size, t}) => (
  <div style={{position: 'absolute', left: W / 2, top: y, transform: `translate(-50%,-50%) scale(${1 + 0.03 * Math.sin(t * 4)})`}}>
    <Img src={staticFile(plan.hero.sil)} style={{maxWidth: size, maxHeight: size, objectFit: 'contain', filter: 'drop-shadow(0 0 30px rgba(255,200,60,0.55))'}} />
    <div style={{position: 'absolute', left: '50%', top: '45%', transform: `translate(-50%,-50%) rotate(${Math.sin(t * 3) * 6}deg)`}}><Label text="?" size={size * 0.42} color={GOLD} /></div>
  </div>
);

const HoIntro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color="#5a2bd6" t={t} rays={0.6} cy={1150} dark />
    <Title text="THE MOST" size={120} frame={frame} y={330} />
    <Title text="UNDERRATED" size={180} gold frame={frame} at={spb * 0.6} y={500} glow="#5a1a9a" />
    <Title text="BRAWLER IN RANKED" size={96} frame={frame} at={spb * 1.2} y={660} />
    <Halo x={W / 2} y={1150} r={460} color="#8a5cff" a={0.7} />
    {frame > spb * 1.5 && <SilHero plan={plan} y={1150} size={720} t={t} />}
    {frame > spb * 3 && <Title text="NOBODY PICKS IT. IT WINS." size={62} frame={frame} at={spb * 3} stagger={0.3} y={1580} color="#e6dcff" />}
  </AbsoluteFill>
);

const HoClue: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color="#5a2bd6" t={t} rays={0.5} cy={700} dark />
    <div style={{position: 'absolute', left: W / 2, top: 230, transform: `translate(-50%,-50%) scale(${pop(frame, 0)})`, padding: '10px 30px 12px', borderRadius: 999,
      background: INK, boxShadow: `0 0 0 5px ${GOLD}`}}><Label text={`CLUE ${seg.n}/3`} size={50} color={GOLD} stroke={0} /></div>
    <Halo x={W / 2} y={720} r={420} color="#8a5cff" a={0.7} />
    <SilHero plan={plan} y={720} size={640} t={t} />
    <div style={{position: 'absolute', left: W / 2, top: 1290, transform: `translate(-50%,-50%) scale(${pop(frame, 4, 10, 1.5)})`, width: 860, padding: '34px 40px 40px',
      borderRadius: 40, background: 'rgba(10,12,30,0.88)', boxShadow: `0 0 0 6px ${seg.col}, 0 12px 0 6px ${DEEP}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
      <Label text={seg.label} size={50} color="#cfd6ff" stroke={0} />
      <Label text={seg.value} size={seg.value.length > 10 ? 104 : 140} color={seg.col} />
      <Label text={seg.sub} size={44} color="#ffffff" stroke={0} />
    </div>
    <Flare f={frame - 4} y={1290} color={seg.col} />
  </AbsoluteFill>
);

const HoReveal: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const h = plan.hero;
  const k = clamp(frame / 8);
  return (
    <AbsoluteFill>
      <Backdrop color={GOLD} t={t} rays={1} cy={880} />
      <BrandBug />
      <Chip text={`ONLY #${h.useRank} OF ${plan.total} IN PICKS`} color="#283069" size={52} x={W / 2} y={330} scale={pop(frame, 6)} />
      <Halo x={W / 2} y={880} r={540} color="#fff3b0" a={0.9} />
      <div style={{position: 'absolute', left: W / 2, top: 880, transform: `translate(-50%,-50%) scale(${1 + 0.15 * (1 - outBack(frame / 12, 1.5))})`}}>
        <Img src={staticFile(h.sil)} style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', maxWidth: 820, maxHeight: 820, opacity: 1 - k}} />
        <Art src={h.art} size={820} style={{opacity: k, filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <Burst f={frame - 4} x={W / 2} y={880} />
      <Flare f={frame - 4} y={880} color={GOLD} />
      <Banner text={h.name} color="#ff8a28" size={h.name.length <= 8 ? 140 : 110} y={1400} frame={frame} at={6} />
      <Stamp text="HIDDEN OP" color="#7cff8a" frame={frame} at={spb * 1.6} x={W / 2 + 60} y={1110} />
      {frame > spb && <StatPill label="WINS" value={pc(h.wr)} color="#7cff8a" y={1570} scale={pop(frame, spb)} />}
      {frame > spb * 1.6 && <Confetti t={(frame - spb * 1.6) / 30} />}
    </AbsoluteFill>
  );
};

const HoMore: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const more: any[] = plan.more || [];
  return (
    <AbsoluteFill>
      <Backdrop color="#3cbf6a" t={t} rays={0.6} cy={900} />
      <BrandBug />
      <Title text="2 MORE" size={150} frame={frame} y={380} />
      <Title text="HIDDEN PICKS" size={120} gold frame={frame} at={spb * 0.5} y={540} glow="#0b6b32" />
      {more.map((b, i) => {
        const k = pop(frame, spb * 1.1 + i * spb * 0.9, 10, 1.6);
        if (k <= 0) return null;
        return (
          <div key={b.id} style={{position: 'absolute', left: W / 2, top: 830 + i * 360, transform: `translate(-50%,-50%) scale(${k})`, width: 900, height: 300,
            borderRadius: 40, background: 'rgba(10,12,30,0.86)', boxShadow: `0 0 0 6px ${INK}, 0 12px 0 6px ${DEEP}`, display: 'flex', alignItems: 'center', gap: 40, padding: '0 40px'}}>
            <Face src={b.face} size={220} color={GREEN} />
            <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
              <Label text={b.name} size={b.name.length > 8 ? 64 : 78} />
              <Label text={`WINS ${pc(b.wr)}`} size={58} color="#7cff8a" />
              <Label text={`#${b.useRank} OF ${plan.total} IN PICKS`} size={38} color="#cfd6ff" stroke={0} />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const HoOutro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <Ending frame={frame} t={t} spb={spb} color="#5a2bd6" big="TRY IT!" line1="WHO'S YOUR" line2="HIDDEN PICK?" {...hookOf(plan, 'THE HIDDEN META ON')} />
);

export const HiddenOp: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{ho_intro: HoIntro, ho_clue: HoClue, ho_reveal: HoReveal, ho_more: HoMore, ho_outro: HoOutro}} swipeInto={['ho_reveal', 'ho_more', 'ho_outro']} />
);

// ================================================================ wrrace
const RACE = {top: 360, row: 106, left: 40, bar0: 150, barMax: 760, shown: 10};

const raceAt = (racers: Record<string, any>, d: number) => {
  const i = Math.floor(d), k = d - i;
  const out: Record<string, number> = {};
  for (const [id, r] of Object.entries(racers)) {
    const v: number[] = r.v;
    const a = v[Math.min(i, v.length - 1)], b = v[Math.min(i + 1, v.length - 1)];
    out[id] = lerp(a, b, k);
  }
  return out;
};
const ranksAt = (vals: Record<string, number>) => {
  const order = Object.keys(vals).sort((x, y) => vals[y] - vals[x]);
  return Object.fromEntries(order.map((id, i) => [id, i]));
};

const RIntro: React.FC<SceneProps> = ({frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color="#ff6a28" t={t} rays={0.8} cy={760} />
    {[0, 1, 2, 3, 4].map((i) => {
      const k = outCubic((frame - i * 3) / 14);
      return <div key={i} style={{position: 'absolute', left: 60, top: 1130 + i * 92, height: 64, width: k * (820 - i * 120), borderRadius: 32,
        background: `linear-gradient(90deg, ${['#ff3c64', '#ff8c28', '#ffcd28', '#46d778', '#3caaff'][i]}, ${alpha('#ffffff', 0.85)})`, boxShadow: `0 0 0 5px ${INK}`}} />;
    })}
    <Title text="WHO RULED" size={170} frame={frame} y={520} />
    <Title text="RANKED?" size={250} gold frame={frame} at={spb * 0.8} y={740} glow="#8a2a00" />
    {frame > spb * 1.6 && <Chip text="THE LAST 2 WEEKS" color="#283069" size={66} x={W / 2} y={960} scale={pop(frame, spb * 1.6)} />}
  </AbsoluteFill>
);

const RRace: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const racers: Record<string, any> = plan.racers || {};
  const days: string[] = plan.days || [];
  const n = days.length;
  const per = (seg.len * spb) / n;
  const d = Math.min(n - 1, frame / per);
  const vals = raceAt(racers, d);
  // Ranks at keyframes a quarter day apart, each bar sliding between them:
  // an overtake is a short slide, and bars never sit on top of each other.
  const kf = d * 4, ki = Math.floor(kf), kk = smooth(kf - ki);
  const r0 = ranksAt(raceAt(racers, Math.min(n - 1, ki / 4))), r1 = ranksAt(raceAt(racers, Math.min(n - 1, (ki + 1) / 4)));
  const pos = Object.fromEntries(Object.keys(racers).map((id) => [id, lerp(r0[id], r1[id], kk)]));
  const all = Object.values(racers).flatMap((r: any) => r.v as number[]);
  const lo = Math.min(...all) - 0.004;
  const tops = Object.keys(racers).map((id) => vals[id]).sort((a, b) => b - a);
  const floor = Math.max(lo, (tops[RACE.shown + 2] ?? lo) - 0.006);
  const hi = Math.max(...all) + 0.002;
  const leader = Object.keys(pos).sort((a, b) => pos[a] - pos[b])[0];
  const dayI = Math.round(d);
  const reset = plan.reset;
  const resetF = reset != null ? reset * per : -999;
  return (
    <AbsoluteFill>
      <Backdrop color="#283a9a" t={t} rays={0.25} cy={900} dark />
      <div style={{position: 'absolute', left: 0, right: 0, top: 190, display: 'flex', justifyContent: 'center'}}>
        <div style={{padding: '12px 40px 16px', borderRadius: 999, background: INK, boxShadow: `0 0 0 6px ${GOLD}, 0 10px 0 6px ${DEEP}`}}>
          <Label text={days[dayI]} size={84} color={GOLD} stroke={0} />
        </div>
      </div>
      {/* the timeline under the date, with the reset flagged */}
      <div style={{position: 'absolute', left: 120, right: 120, top: 292, height: 12, borderRadius: 6, background: alpha('#ffffff', 0.25)}}>
        <div style={{width: `${(d / (n - 1)) * 100}%`, height: 12, borderRadius: 6, background: GOLD}} />
        {reset != null && <div style={{position: 'absolute', left: `${(reset / (n - 1)) * 100}%`, top: -10, width: 8, height: 32, borderRadius: 4, background: '#ff4a62', boxShadow: `0 0 0 3px ${INK}`}} />}
      </div>
      {Object.entries(racers).map(([id, r]) => {
        const p = pos[id];
        if (p > RACE.shown + 0.6) return null;
        const v = vals[id];
        const len = RACE.bar0 + (RACE.barMax - RACE.bar0) * clamp((v - floor) / (hi - floor));
        const y = RACE.top + p * RACE.row;
        const op = clamp(RACE.shown + 0.6 - p);
        const face = 86;
        return (
          <div key={id} style={{position: 'absolute', left: RACE.left, top: y, opacity: op, height: RACE.row - 18, display: 'flex', alignItems: 'center'}}>
            <div style={{position: 'relative', width: len, height: RACE.row - 18, borderRadius: (RACE.row - 18) / 2,
              background: `linear-gradient(180deg, ${mix(r.color, '#fff', 0.35)} 0%, ${r.color} 55%, ${shade(r.color, 0.7)} 100%)`,
              boxShadow: `0 0 0 5px ${INK}, 0 7px 0 5px ${DEEP}`, display: 'flex', alignItems: 'center'}}>
              <div style={{position: 'absolute', left: 4, top: (RACE.row - 18 - face) / 2, width: face, height: face, borderRadius: '50%', overflow: 'hidden', boxShadow: `0 0 0 4px ${INK}`, background: INK}}>
                {r.face && <Img src={staticFile(r.face)} style={{width: face, height: face}} />}
              </div>
              <div style={{position: 'absolute', left: face + 18, whiteSpace: 'nowrap'}}><Label text={r.name} size={r.name.length > 9 ? 36 : 42} /></div>
            </div>
            <div style={{marginLeft: 16, whiteSpace: 'nowrap'}}><Label text={pc(v)} size={48} color={id === leader ? GOLD : '#ffffff'} /></div>
            {id === leader && <div style={{position: 'absolute', left: -6, top: -40, transform: 'rotate(-14deg)'}}><Crown size={70} /></div>}
          </div>
        );
      })}
      {frame >= resetF && frame < resetF + per * 1.6 && (
        <>
          <Flare f={frame - resetF} y={900} color="#ff4a62" />
          <div style={{position: 'absolute', left: W / 2, top: 900, transform: `translate(-50%,-50%) scale(${outBack((frame - resetF) / 8, 1.8)}) rotate(-4deg)`}}>
            <Chip text={`SEASON ${plan.season} STARTS`} color="#ff4a62" size={80} x={0} y={0} />
          </div>
        </>
      )}
      <div style={{position: 'absolute', left: W / 2, top: 1500, transform: 'translate(-50%,-50%)', opacity: 0.85}}><Label text="ADJUSTED WIN RATE · brawlzone.net" size={34} stroke={5} /></div>
    </AbsoluteFill>
  );
};

const RFinal: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const b = seg.b;
  const u = frame / 12;
  const last = plan.racers?.[b.id]?.v?.slice(-1)[0] ?? b.wr;
  return (
    <AbsoluteFill>
      <Backdrop color={GOLD} t={t} rays={1} cy={920} />
      <BrandBug />
      {/* A streak is the story only when it is long; else the new #1 is. */}
      <Title text={plan.streak >= 4 ? `#1 FOR ${plan.streak} DAYS` : '#1 RIGHT NOW'} size={120} gold frame={frame} y={380} glow="#8a4a00" />
      {plan.streak >= 4 && frame > spb && <Title text="STRAIGHT" size={90} frame={frame} at={spb} y={510} />}
      <Halo x={W / 2} y={960} r={520} color="#fff3b0" a={0.9} />
      <div style={{position: 'absolute', left: W / 2, top: 980, transform: `translate(-50%,-50%) translateY(${(1 - outBack(u, 1.4)) * 260}px) scale(${0.6 + 0.4 * outBack(u, 1.5)})`}}>
        <Art src={b.art} size={800} style={{filter: 'drop-shadow(0 22px 0 rgba(0,0,0,0.3))'}} />
      </div>
      <div style={{position: 'absolute', left: W / 2 - 120, top: 560, transform: `scale(${pop(frame, spb * 0.6, 8, 2)}) rotate(-6deg)`}}><Crown size={240} /></div>
      <Banner text={b.name} color="#ff8a28" size={b.name.length <= 8 ? 140 : 110} y={1440} frame={frame} at={4} />
      {frame > spb && <StatPill label="WINS" value={pc(last)} color="#7cff8a" y={1600} scale={pop(frame, spb)} />}
      <Burst f={frame - 3} x={W / 2} y={980} />
      {frame > spb && <Confetti t={(frame - spb) / 30} />}
    </AbsoluteFill>
  );
};

const ROutro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <Ending frame={frame} t={t} spb={spb} color="#ff6a28" big="NEXT #1?" line1="WHO TAKES" line2="THE CROWN?" {...hookOf(plan, 'THE LIVE TIER LIST ON')} />
);

export const WinRace: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{r_intro: RIntro, r_race: RRace, r_final: RFinal, r_outro: ROutro}} swipeInto={['r_race', 'r_final', 'r_outro']} />
);

// ================================================================ pickrow
const PR_X = [200, 540, 880], PR_Y = [620, 1020, 1420], PR_FACE = 214;

/** The 3 x 3 board; rows before `done` show their verdicts, row `now` is being revealed from frame `at`. */
const PickBoard: React.FC<{plan: Plan; frame: number; done: number; now?: number; at?: number; dimOthers?: boolean}> = ({plan, frame, done, now = -1, at = 0, dimOthers}) => {
  const rows: any[] = plan.rows || [];
  return (
    <>
      {rows.map((r, i) => {
        const revealed = i < done || i === now;
        const f = i === now ? frame - at : 99;
        const op = dimOthers && i !== now && i >= done ? 0.45 : 1;
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: W / 2, top: PR_Y[i] - PR_FACE / 2 - 52, transform: 'translate(-50%,-50%)', opacity: op, padding: '6px 26px 8px',
              borderRadius: 999, background: r.color, boxShadow: `0 0 0 5px ${INK}, 0 7px 0 5px ${DEEP}`, whiteSpace: 'nowrap'}}>
              <Label text={r.cls} size={40} />
            </div>
            {r.items.map((b: any, j: number) => {
              const best = revealed && b.id === r.best, worst = revealed && b.id === r.worst;
              const k = clamp((f - j * 5) / 12);
              const showWr = revealed && f - j * 5 >= 0;
              const verdict = revealed && f >= 22;
              return (
                <div key={b.id} style={{position: 'absolute', left: PR_X[j], top: PR_Y[i], opacity: op, transform: `translate(-50%,-50%) scale(${verdict && best ? 1.06 : 1})`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
                  <div style={{position: 'relative', filter: verdict && worst ? 'grayscale(0.85) brightness(0.8)' : 'none',
                    boxShadow: verdict && best ? `0 0 50px 16px ${alpha(GREEN, 0.75)}` : 'none', borderRadius: PR_FACE * 0.2}}>
                    <Face src={b.face} size={PR_FACE} color={r.color} />
                    {verdict && worst && <div style={{position: 'absolute', left: PR_FACE / 2, top: PR_FACE / 2, transform: `translate(-50%,-50%) scale(${1 + (1 - outBack((f - 22) / 8, 1)) * 1.2})`}}>
                      <Label text="X" size={230} color={RED} stroke={12} /></div>}
                    {verdict && best && <div style={{position: 'absolute', left: PR_FACE / 2 - 60, top: -86, transform: `scale(${outBack((f - 22) / 8, 2)})`}}><Crown size={120} /></div>}
                  </div>
                  <div style={{height: 52, display: 'flex', alignItems: 'center'}}>
                    {showWr ? <Label text={pc(lerp(0.5, b.wr, smooth(k)))} size={50} color={verdict ? (best ? '#8dffb0' : worst ? '#ffa0ac' : '#ffffff') : '#ffffff'} />
                      : <Label text={b.name} size={b.name.length > 8 ? 36 : 42} />}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
};

const PrIntro: React.FC<SceneProps> = ({plan, frame, t, spb}) => {
  const faces = (plan.rows || []).flatMap((r: any) => r.items);
  return (
    <AbsoluteFill>
      <Backdrop color="#ff3c8a" t={t} rays={0.8} cy={700} />
      <Title text="PICK ONE" size={230} frame={frame} y={470} />
      <Title text="FROM EACH ROW" size={130} gold frame={frame} at={spb * 0.5} y={680} glow="#8a0040" />
      {frame > spb && <Chip text="WE RATE YOUR TEAM" color="#283069" size={64} x={W / 2} y={870} scale={pop(frame, spb)} />}
      {faces.map((b: any, i: number) => {
        const k = pop(frame, spb * 1.3 + i * 2.5, 8, 2);
        if (k <= 0) return null;
        return <div key={i} style={{position: 'absolute', left: PR_X[i % 3] - 85, top: 1050 + Math.floor(i / 3) * 200 + Math.sin(t * 4 + i) * 8, transform: `scale(${k})`}}>
          <Face src={b.face} size={170} color={plan.rows[Math.floor(i / 3)].color} /></div>;
      })}
    </AbsoluteFill>
  );
};

const PrBoard: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const left = Math.max(1, 5 - Math.floor((frame - spb * 0.5) / spb));
  return (
    <AbsoluteFill>
      <Backdrop color="#c8306e" t={t} rays={0.35} cy={960} dark />
      <Title text="PICK NOW!" size={110} gold frame={frame} y={232} />
      {frame > spb * 0.5 && <div style={{position: 'absolute', left: W - 140, top: 232, transform: 'translate(-50%,-50%)'}}>
        <Ring n={String(left)} frac={1 - ((frame - spb * 0.5) % spb) / spb} color={left <= 2 ? RED : GOLD} size={150} /></div>}
      <PickBoard plan={plan} frame={frame} done={0} />
    </AbsoluteFill>
  );
};

const PrRow: React.FC<SceneProps> = ({plan, seg, frame, t}) => (
  <AbsoluteFill>
    <Backdrop color="#c8306e" t={t} rays={0.35} cy={PR_Y[seg.i]} dark />
    <Title text="THE ANSWERS" size={100} gold frame={frame + 99} y={232} />
    <PickBoard plan={plan} frame={frame} done={seg.i} now={seg.i} at={4} dimOthers />
    <Flare f={frame - 26} y={PR_Y[seg.i]} color={GREEN} />
  </AbsoluteFill>
);

const TeamOf: React.FC<{plan: Plan; which: 'best' | 'worst'; frame: number; spb: number}> = ({plan, which, frame, spb}) => {
  const rows: any[] = plan.rows || [];
  const team = rows.map((r) => r.items.find((b: any) => b.id === r[which]));
  const avg = team.reduce((s, b) => s + b.wr, 0) / Math.max(1, team.length);
  const good = which === 'best';
  return (
    <>
      {team.map((b, i) => {
        const k = pop(frame, spb * 0.6 + i * 5, 10, 1.6);
        if (k <= 0) return null;
        return (
          <div key={b.id} style={{position: 'absolute', left: PR_X[i], top: 930, transform: `translate(-50%,-50%) scale(${k})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16}}>
            <Art src={b.art} size={360} style={{filter: good ? 'drop-shadow(0 16px 0 rgba(0,0,0,0.3))' : 'grayscale(0.85) brightness(0.8)'}} />
            <Label text={b.name} size={b.name.length > 8 ? 42 : 52} />
            <Label text={pc(b.wr)} size={50} color={good ? '#8dffb0' : '#ffa0ac'} />
          </div>
        );
      })}
      {frame > spb * 1.8 && <StatPill label="TEAM AVERAGE" value={pc(avg)} color={good ? '#7cff8a' : '#ff8a96'} y={1380} scale={pop(frame, spb * 1.8)} />}
    </>
  );
};

const PrBest: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={GREEN} t={t} rays={1} cy={900} />
    <BrandBug />
    <Title text="THE PERFECT" size={150} frame={frame} y={380} glow="#0b6b32" />
    <Title text="TEAM" size={220} gold frame={frame} at={spb * 0.3} y={560} />
    <TeamOf plan={plan} which="best" frame={frame} spb={spb} />
    {frame > spb * 1.8 && <Confetti t={(frame - spb * 1.8) / 30} />}
  </AbsoluteFill>
);

const PrWorst: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={RED} t={t} rays={0.6} cy={900} dark />
    <BrandBug />
    <Title text="THE TRAP" size={170} frame={frame} y={380} glow="#7a0016" />
    <Title text="TEAM" size={200} frame={frame} at={spb * 0.3} y={560} color="#ffc0c8" />
    <TeamOf plan={plan} which="worst" frame={frame} spb={spb} />
  </AbsoluteFill>
);

const PrOutro: React.FC<SceneProps> = ({plan, frame, t, spb}) => (
  <Ending frame={frame} t={t} spb={spb} color="#ff3c8a" big="YOUR TEAM?" line1="COMMENT YOUR" line2="3 PICKS" {...hookOf(plan, 'EVERY BRAWLER, EVERY RANK ON')} />
);

export const PickRow: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{pr_intro: PrIntro, pr_board: PrBoard, pr_row: PrRow, pr_best: PrBest, pr_worst: PrWorst, pr_outro: PrOutro}} swipeInto={['pr_board', 'pr_best', 'pr_outro']} />
);
