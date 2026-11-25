// The Worlds 2026 series (2026-11-25, owner: "lots of content on the brawl
// championship that ended this weekend"): nine Shorts from the World Finals'
// own games, read from the official API. make.py `worlds` writes each one as a
// list of the scenes below; every number and word comes from there.
import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Art, Backdrop, Burst, Chip, Confetti, Crown, Flare, Halo, Label, Ring, SpeedLines, Title} from './fx';
import {Ending, pop} from './Formats';
import {SceneProps, Stage} from './Stage';
import {DEEP, INK, TIER, W, alpha, clamp, hookOf, mix, outBack, outCubic, shade, Plan} from './theme';

const GOLD = '#ffc72c', BLUE = '#3c7bff', RED = '#ff3c64', GREEN = '#7dff9b', VIOLET = '#7a3cff';

const Face: React.FC<{src: string; size: number; color?: string; dim?: boolean}> = ({src, size, color = VIOLET, dim}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.2, overflow: 'hidden', boxShadow: `0 0 0 ${Math.max(4, size * 0.03)}px ${INK}`, background: shade(color, 0.6), opacity: dim ? 0.4 : 1, flexShrink: 0}}>
    <Img src={staticFile(src)} style={{width: size, height: size}} />
  </div>
);
const Panel: React.FC<{y: number; h: number; w?: number; color?: string; x?: number; scale?: number; children: React.ReactNode}> = ({y, h, w = 940, color = '#ffffff', x = W / 2, scale = 1, children}) => (
  <div style={{position: 'absolute', left: x, top: y, width: w, height: h, transform: `translate(-50%,-50%) scale(${scale})`, borderRadius: 44, background: 'rgba(10,12,30,0.88)',
    boxShadow: `0 0 0 8px ${INK}, 0 14px 0 8px ${DEEP}, inset 0 0 0 5px ${alpha(color, 0.45)}`}}>{children}</div>
);
const fit = (s: string, max: number, width: number) => Math.min(max, width / (Math.max(1, s.length) * 0.62));

// ---------------------------------------------------------------- intro
const Intro: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const lines: string[] = seg.lines || [];
  const faces: string[] = (seg.faces || []).map((b: any) => b.face);
  const top = faces.length ? 420 : 620;
  return (
    <AbsoluteFill>
      <Backdrop color={seg.color || VIOLET} t={t} rays={1} cy={faces.length ? 1240 : 900} />
      {lines.map((l, i) => {
        const at = i * spb * 0.55;
        return <Title key={i} text={l} size={i === (seg.gold ?? 1) ? 190 : 140} maxWidth={930} gold={i === (seg.gold ?? 1)} frame={frame} at={at} stagger={0.8} y={top + i * 205} glow="#1a0a3a" />;
      })}
      {faces.length > 0 && <Halo x={W / 2} y={1260} r={520} color={GOLD} a={0.7} />}
      {faces.map((f, i) => {
        const k = pop(frame, spb * 1.4 + i * 4, 10, 2.2);
        const n = faces.length, per = Math.min(5, n);
        const row = Math.floor(i / per), inRow = Math.min(per, n - row * per);
        return <div key={i} style={{position: 'absolute', left: W / 2 + ((i % per) - (inRow - 1) / 2) * 196, top: 1200 + row * 200, transform: `translate(-50%,-50%) scale(${Math.max(0, k)}) rotate(${(i % 2 ? 1 : -1) * 4 + 3 * Math.sin(t * 2 + i)}deg)`}}><Face src={f} size={172} color={GOLD} /></div>;
      })}
      {seg.chip && frame > spb * 2.3 && <Chip text={seg.chip} color="#283069" size={fit(seg.chip, 56, 840)} x={W / 2} y={faces.length ? 1580 : 1480} rot={-2} scale={pop(frame, spb * 2.3)} />}
    </AbsoluteFill>
  );
};

// -------------------------------------------------------------- compare
const Compare: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const a = seg.you, b = seg.pro;
  const max = Math.max(a.v, b.v);
  const bar = (o: any, i: number, color: string) => {
    const at = spb * (0.5 + i * 1.0);
    const n = outCubic((frame - at) / 20);
    const y = 760 + i * 330;
    if (frame < at) return null;
    return (
      <React.Fragment key={i}>
        <div style={{position: 'absolute', left: 70, top: y - 148}}><Label text={o.name} size={58} color={i ? '#ffe45a' : '#dfe4ff'} /></div>
        <div style={{position: 'absolute', left: 70, top: y - 66, width: 940, height: 150, borderRadius: 40, background: 'rgba(10,12,30,0.75)', boxShadow: `0 0 0 7px ${INK}`}} />
        <div style={{position: 'absolute', left: 70, top: y - 66, width: Math.max(150, 940 * (o.v / max) * n), height: 150, borderRadius: 40,
          background: `linear-gradient(180deg, ${mix(color, '#fff', 0.45)} 0%, ${color} 50%, ${shade(color, 0.7)} 100%)`, boxShadow: `0 0 0 7px ${INK}, 0 12px 0 7px ${DEEP}`}} />
        <div style={{position: 'absolute', left: 110, top: y - 46}}><Label text={fmt(o.v * n, o.f)} size={106} /></div>
      </React.Fragment>
    );
  };
  return (
    <AbsoluteFill>
      <Backdrop color={seg.color || VIOLET} t={t} rays={0.6} cy={920} />
      <Title text={seg.title} size={130} maxWidth={860} frame={frame} y={330} glow="#1a0a3a" />
      {seg.sub && <div style={{position: 'absolute', left: W / 2, top: 452, transform: 'translate(-50%,-50%)'}}><Label text={seg.sub} size={48} color="#cfd6ff" /></div>}
      {bar(a, 0, BLUE)}
      {bar(b, 1, GOLD)}
      {frame > spb * 2.5 && <div style={{position: 'absolute', left: W / 2, top: 1380, transform: `translate(-50%,-50%) scale(${pop(frame, spb * 2.5, 10, 2.4)}) rotate(-3deg)`}}>
        <Chip text={seg.note} color={RED} size={fit(seg.note, 92, 820)} x={0} y={0} /></div>}
      <Flare f={frame - Math.round(spb * 2.5)} y={1380} color="#ffe45a" />
    </AbsoluteFill>
  );
};
const fmt = (v: number, f?: string) => (f === '1' ? v.toFixed(1) : f === '2' ? v.toFixed(2) : f === '%' ? `${v.toFixed(0)}%` : f === 's' ? `${v.toFixed(0)}s` : Math.round(v).toLocaleString('en-US'));

// ----------------------------------------------------------------- rows
const Rows: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const rows: any[] = seg.rows || [];
  const h = rows.length > 5 ? 176 : 208;
  const gap = h + 22;
  const y0 = 640 + (5 - Math.min(5, rows.length)) * 60 - (rows.length > 5 ? 20 : 0);
  const step = seg.step || 0.8;
  return (
    <AbsoluteFill>
      <Backdrop color={seg.color || VIOLET} t={t} rays={0.55} cy={960} />
      <Title text={seg.title} size={132} maxWidth={860} gold frame={frame} stagger={0.7} y={330} glow="#1a0a3a" />
      {seg.sub && <div style={{position: 'absolute', left: W / 2, top: 462, transform: 'translate(-50%,-50%)'}}><Label text={seg.sub} size={fit(seg.sub, 50, 900)} color="#dfe4ff" /></div>}
      {rows.map((r, i) => {
        const order = seg.up ? rows.length - 1 - i : i;
        const at = spb * (0.7 + order * step);
        if (frame < at) return null;
        const k = outBack((frame - at) / 10, 1.5);
        const c = r.color || '#ffffff';
        const right: string = r.val || '';
        return (
          <div key={i} style={{position: 'absolute', left: W / 2, top: y0 + i * gap, width: 960, height: h, transform: `translate(-50%,-50%) translateX(${(i % 2 ? 1 : -1) * 1000 * (1 - k)}px)`, borderRadius: 44,
            background: r.hot ? `linear-gradient(180deg, ${mix(c, '#101430', 0.45)}, ${mix(c, '#101430', 0.75)})` : 'rgba(10,12,30,0.9)', boxShadow: `0 0 0 8px ${INK}, 0 13px 0 8px ${DEEP}, inset 0 0 0 5px ${alpha(c, r.hot ? 0.95 : 0.4)}`}}>
            <div style={{position: 'absolute', left: 26, top: 0, height: h, display: 'flex', alignItems: 'center', gap: 24}}>
              {r.rank != null && <div style={{width: 76, textAlign: 'center'}}><Label text={`${r.rank}`} size={84} color={i === 0 ? GOLD : '#cfd6ff'} /></div>}
              {r.b && <Face src={r.b.face} size={h - 46} color={c} />}
              {r.b2 && <Face src={r.b2.face} size={h - 46} color={c} />}
              <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                <Label text={r.name} size={fit(r.name, h > 190 ? 70 : 60, r.b2 ? 330 : 400)} />
                {r.sub && <Label text={r.sub} size={fit(r.sub, 40, r.b2 ? 340 : 430)} color="#cfd6ff" stroke={5} />}
              </div>
            </div>
            <div style={{position: 'absolute', right: 34, top: 0, height: h, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', gap: 8}}>
              <Label text={right} size={fit(right, 92, 300)} color={c} />
              {r.valSub && <Label text={r.valSub} size={34} color="#cfd6ff" stroke={5} />}
            </div>
          </div>
        );
      })}
      {seg.note && frame > spb * (0.9 + rows.length * step) && <Chip text={seg.note} color={RED} size={fit(seg.note, 64, 820)} x={W / 2} y={Math.min(1640, y0 + rows.length * gap - h / 2 + 70)} rot={-2} scale={pop(frame, spb * (0.9 + rows.length * step), 10, 2.2)} />}
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------------- hero
const Hero: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const lines: any[] = seg.lines || [];
  return (
    <AbsoluteFill>
      <Backdrop color={seg.color || '#ff8c28'} t={t} rays={1} cy={760} />
      <Title text={seg.title} size={130} maxWidth={930} frame={frame} stagger={0.8} y={315} glow="#1a0a3a" />
      <Halo x={W / 2} y={760} r={500} color="#ffffff" a={0.5} />
      <div style={{position: 'absolute', left: W / 2, top: 770 + 12 * Math.sin(t * 3), transform: `translate(-50%,-50%) scale(${pop(frame, 4, 12, 1.8)}) rotate(${2 * Math.sin(t * 1.8)}deg)`}}><Art src={seg.b.art} size={680} /></div>
      <Title text={seg.b.name} size={150} maxWidth={900} gold frame={frame} at={spb * 0.5} y={1150} glow="#1a0a3a" />
      {lines.map((l, i) => {
        const at = spb * (1.2 + i * 0.9);
        return frame > at ? <div key={i} style={{position: 'absolute', left: W / 2, top: 1300 + i * 108, transform: `translate(-50%,-50%) scale(${pop(frame, at)})`}}><Label text={l.t} size={fit(l.t, 74, 960)} color={l.c || '#ffffff'} /></div> : null;
      })}
      {seg.stamp && frame > spb * (1.4 + lines.length * 0.9) && <Stamp text={seg.stamp} f={frame - Math.round(spb * (1.4 + lines.length * 0.9))} />}
    </AbsoluteFill>
  );
};
const Stamp: React.FC<{text: string; f: number}> = ({text, f}) => (
  <div style={{position: 'absolute', left: 800, top: 520, transform: `translate(-50%,-50%) rotate(13deg) scale(${1 + 1.6 * (1 - outBack(f / 8, 1))})`, opacity: clamp(f / 3), padding: '16px 36px 20px', borderRadius: 30, border: `14px solid ${RED}`, background: 'rgba(10,12,30,0.7)', boxShadow: `0 0 0 7px ${INK}`}}>
    <Label text={text} size={fit(text, 110, 420)} color={RED} />
  </div>
);

// ----------------------------------------------------------------- grid
const Grid: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const items: any[] = seg.items || [];
  const per = 6, size = 138, gap = 18;
  const x0 = W / 2 - ((per - 1) * (size + gap)) / 2;
  const rows = Math.ceil(items.length / per);
  const y0 = 960 - ((rows - 1) * (size + gap)) / 2;
  return (
    <AbsoluteFill>
      <Backdrop color={seg.color || '#e0264f'} t={t} rays={0.5} cy={960} dark />
      <Title text={seg.title} size={128} maxWidth={860} frame={frame} stagger={0.7} y={320} glow="#3a0010" />
      {seg.sub && <div style={{position: 'absolute', left: W / 2, top: 444, transform: 'translate(-50%,-50%)'}}><Label text={seg.sub} size={fit(seg.sub, 52, 900)} color="#ffe45a" /></div>}
      {items.map((b, i) => {
        const at = spb * 0.6 + i * Math.max(1.6, (spb * (seg.len - 2.4)) / items.length);
        const k = pop(frame, at, 8, 2.4);
        if (k <= 0) return null;
        const f = frame - at;
        return (
          <div key={b.id} style={{position: 'absolute', left: x0 + (i % per) * (size + gap), top: y0 + Math.floor(i / per) * (size + gap), transform: `translate(-50%,-50%) scale(${k})`}}>
            <Face src={b.face} size={size} color={RED} />
            {f > 5 && <svg width={size} height={size} viewBox="0 0 100 100" style={{position: 'absolute', left: 0, top: 0, opacity: 0.92 * clamp((f - 5) / 4)}}>
              <path d="M18 18 L82 82 M82 18 L18 82" stroke={INK} strokeWidth="20" strokeLinecap="round" /><path d="M18 18 L82 82 M82 18 L18 82" stroke={RED} strokeWidth="11" strokeLinecap="round" /></svg>}
          </div>
        );
      })}
      {seg.note && frame > spb * (seg.len - 1.7) && <Chip text={seg.note} color="#283069" size={fit(seg.note, 66, 800)} x={W / 2} y={1570} rot={-2} scale={pop(frame, spb * (seg.len - 1.7), 10, 2.2)} />}
    </AbsoluteFill>
  );
};

// ----------------------------------------------------------------- bans
const Bans: React.FC<SceneProps> = ({seg, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={seg.color || '#c8245a'} t={t} rays={0.5} cy={960} />
    <Title text={seg.title} size={132} maxWidth={860} gold frame={frame} stagger={0.7} y={320} glow="#3a0010" />
    <div style={{position: 'absolute', left: W / 2, top: 446, transform: 'translate(-50%,-50%)', display: 'flex', gap: 34, alignItems: 'center', whiteSpace: 'nowrap'}}>
      <div style={{width: 44, height: 44, borderRadius: 12, background: GOLD, boxShadow: `0 0 0 5px ${INK}`}} /><Label text="THE PROS" size={46} color="#ffe45a" />
      <div style={{width: 44, height: 44, borderRadius: 12, background: BLUE, boxShadow: `0 0 0 5px ${INK}`}} /><Label text="YOU (MYTHIC+)" size={46} color="#cfe0ff" />
    </div>
    {(seg.rows || []).map((r: any, i: number) => {
      const at = spb * (0.6 + i * 0.95);
      if (frame < at) return null;
      const n = outCubic((frame - at - 4) / 18), k = outBack((frame - at) / 10, 1.4);
      const y = 640 + i * 262;
      const bar = (v: number, dy: number, c: string) => (
        <>
          <div style={{position: 'absolute', left: 250, top: dy, width: 660, height: 78, borderRadius: 24, background: 'rgba(255,255,255,0.1)'}} />
          <div style={{position: 'absolute', left: 250, top: dy, width: Math.max(40, 660 * Math.min(1, v / (seg.max || 75)) * n), height: 78, borderRadius: 24, background: `linear-gradient(180deg, ${mix(c, '#fff', 0.4)}, ${c} 55%, ${shade(c, 0.7)})`, boxShadow: `0 0 0 5px ${INK}`}} />
          <div style={{position: 'absolute', left: 274, top: dy + 10}}><Label text={`${Math.round(v * n)}%`} size={60} /></div>
        </>
      );
      return (
        <Panel key={i} y={y} h={238} scale={k} color="#ffffff">
          <div style={{position: 'absolute', left: 30, top: 24}}><Face src={r.b.face} size={160} color="#c8245a" /></div>
          <div style={{position: 'absolute', left: 30, width: 190, top: 192, textAlign: 'center'}}><Label text={r.b.name} size={fit(r.b.name, 40, 180)} /></div>
          {bar(r.pro, 28, GOLD)}
          {bar(r.you, 128, BLUE)}
        </Panel>
      );
    })}
  </AbsoluteFill>
);

// ---------------------------------------------------------------- draft
const Trio: React.FC<{items: any[]; size: number; dim?: boolean; color: string}> = ({items, size, dim, color}) => (
  <div style={{display: 'flex', gap: 22}}>{items.map((b) => (
    <div key={b.id} style={{width: size, textAlign: 'center', opacity: dim ? 0.45 : 1}}>
      <Face src={b.face} size={size} color={color} />
      <div style={{marginTop: 14}}><Label text={b.name} size={fit(b.name, 42, size + 6)} /></div>
    </div>))}
  </div>
);
export const Draft: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => {
  const reveal = Math.round(spb * (seg.len - 2.6));
  const shown = frame >= reveal;
  const left = reveal - frame;
  const row = (team: any, i: number, color: string) => {
    const k = outBack((frame - spb * (0.4 + i * 0.4)) / 11, 1.4);
    const win = shown && team.win;
    const y = i ? 1240 : 740;
    return (
      <div key={i} style={{position: 'absolute', left: W / 2, top: y, width: 960, height: 400, transform: `translate(-50%,-50%) translateX(${(i ? 1 : -1) * 1000 * (1 - k)}px) scale(${win ? 1.03 : 1})`, borderRadius: 54,
        background: `linear-gradient(180deg, ${mix(color, '#101430', 0.35)}, ${mix(color, '#101430', 0.72)})`, boxShadow: `0 0 0 ${win ? 12 : 8}px ${win ? GOLD : INK}, 0 16px 0 ${win ? 12 : 8}px ${DEEP}`}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 20, textAlign: 'center'}}><Label text={shown ? `${team.name}${team.win ? ' WON' : ' LOST'} ${team.score}` : `TEAM ${i ? 'B' : 'A'}`} size={56} color={win ? '#ffe45a' : '#ffffff'} /></div>
        <div style={{position: 'absolute', left: 0, right: 0, top: 104, display: 'flex', justifyContent: 'center'}}><Trio items={team.trio} size={216} dim={shown && !team.win} color={color} /></div>
        {win && <div style={{position: 'absolute', left: -14, top: -92, transform: `rotate(-16deg) scale(${outBack((frame - reveal) / 9, 2)})`}}><Crown size={150} /></div>}
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Backdrop color={shown ? GOLD : seg.color || VIOLET} t={t} rays={0.7} cy={980} />
      <SpeedLines t={t} a={left > 0 ? 0.3 * clamp(1 - left / 45) : 0} cy={980} />
      <Title text={seg.title || 'WHO WON?'} size={150} maxWidth={900} gold frame={frame} y={290} glow="#1a0a3a" />
      <div style={{position: 'absolute', left: W / 2, top: 440, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 20, whiteSpace: 'nowrap'}}>
        {seg.icon && <Img src={staticFile(seg.icon)} style={{width: 84, height: 84, objectFit: 'contain'}} />}
        <Label text={`${seg.mode} · ${seg.map.toUpperCase()}`} size={fit(`${seg.mode} ${seg.map}`, 54, 760)} />
      </div>
      {row(seg.a, 0, RED)}
      {row(seg.b, 1, BLUE)}
      {!shown && frame > spb && <div style={{position: 'absolute', left: W / 2, top: 988, transform: `translate(-50%,-50%) scale(${pop(frame, spb, 9, 2.2)})`, zIndex: 5}}>
        <Ring n={String(Math.max(1, Math.ceil(left / plan.fps)))} frac={(left % plan.fps) / plan.fps} color={GOLD} size={170} /></div>}
      {shown && <><Flare f={frame - reveal} y={seg.a.win ? 740 : 1240} color="#ffe45a" /><Confetti t={(frame - reveal) / 30} /></>}
      {seg.n && <Chip text={`DRAFT ${seg.n} OF ${seg.of}`} color="#283069" size={50} x={W / 2} y={1560} />}
    </AbsoluteFill>
  );
};

// ------------------------------------------------- the final, set by set
const SetScene: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  const shown = frame > spb * 2.2;
  const side = (team: any, i: number, color: string) => {
    const y = i ? 1190 : 730;
    const win = shown && team.win;
    return (
      <div key={i} style={{position: 'absolute', left: W / 2, top: y, width: 960, height: 370, transform: `translate(-50%,-50%) translateX(${(i ? 1 : -1) * 1000 * (1 - outBack((frame - 4) / 11, 1.3))}px)`, borderRadius: 50,
        background: `linear-gradient(180deg, ${mix(color, '#101430', 0.3)}, ${mix(color, '#101430', 0.7)})`, boxShadow: `0 0 0 ${win ? 12 : 8}px ${win ? GOLD : INK}, 0 14px 0 ${win ? 12 : 8}px ${DEEP}`}}>
        <div style={{position: 'absolute', left: 44, top: 22}}><Label text={team.name} size={64} color={win ? '#ffe45a' : '#ffffff'} /></div>
        <div style={{position: 'absolute', left: 40, top: 112}}><Trio items={team.trio} size={188} dim={shown && !team.win} color={color} /></div>
        {shown && <div style={{position: 'absolute', right: 60, top: 110, transform: `scale(${pop(frame, spb * 2.2, 9, 2.4)})`}}><Label text={String(team.score)} size={190} color={team.win ? '#ffe45a' : '#cfd6ff'} /></div>}
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Backdrop color={seg.color || VIOLET} t={t} rays={0.6} cy={960} />
      <Title text={`SET ${seg.n}`} size={150} gold frame={frame} y={290} glow="#1a0a3a" />
      <div style={{position: 'absolute', left: W / 2, top: 436, transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 20, whiteSpace: 'nowrap'}}>
        {seg.icon && <Img src={staticFile(seg.icon)} style={{width: 84, height: 84, objectFit: 'contain'}} />}
        <Label text={`${seg.mode} · ${seg.map.toUpperCase()}`} size={fit(`${seg.mode} ${seg.map}`, 54, 760)} />
      </div>
      {side(seg.a, 0, GOLD)}
      {side(seg.b, 1, RED)}
      {shown && <Burst f={frame - Math.round(spb * 2.2)} x={W / 2} y={seg.a.win ? 730 : 1190} />}
      {frame > spb * 2.8 && <Chip text={seg.total} color="#283069" size={84} x={W / 2} y={1515} scale={pop(frame, spb * 2.8, 10, 2.2)} />}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- text
const Say: React.FC<SceneProps> = ({seg, frame, t, spb}) => (
  <AbsoluteFill>
    <Backdrop color={seg.color || '#ff8c28'} t={t} rays={1} cy={900} />
    {(seg.lines || []).map((l: any, i: number) => {
      const at = spb * i * (seg.step || 0.8);
      return <Title key={i} text={l.t} size={l.big ? 230 : 150} maxWidth={930} gold={!!l.big} frame={frame} at={at} stagger={0.7} y={700 + i * 250 - (seg.lines.length - 2) * 100} glow="#1a0a3a" />;
    })}
    {seg.note && frame > spb * 2 && <Chip text={seg.note} color="#283069" size={fit(seg.note, 60, 800)} x={W / 2} y={1500} scale={pop(frame, spb * 2)} />}
  </AbsoluteFill>
);

// ----------------------------------------------------------- ban tiers
const PER = 7, BF = 106;
const BanTiers: React.FC<SceneProps> = ({seg, frame, t, spb}) => {
  let y = 520;
  const rows = (seg.rows || []).map((r: any) => {
    const h = Math.max(1, Math.ceil(r.items.length / PER)) * 152 + 18;
    const out = {...r, y, h};
    y += h + 14;
    return out;
  });
  return (
    <AbsoluteFill>
      <Backdrop color={seg.color || '#c8245a'} t={t} rays={0.5} cy={960} dark />
      <Title text={seg.title} size={132} maxWidth={860} gold frame={frame} stagger={0.7} y={310} glow="#3a0010" />
      {seg.sub && <div style={{position: 'absolute', left: W / 2, top: 428, transform: 'translate(-50%,-50%)'}}><Label text={seg.sub} size={fit(seg.sub, 48, 900)} color="#ffe45a" /></div>}
      {rows.map((r: any, i: number) => {
        const at = spb * (0.5 + i * 1.0);
        if (frame < at) return null;
        const col = TIER[r.tier];
        const k = outBack((frame - at) / 9, 1.5);
        return (
          <div key={r.tier} style={{position: 'absolute', left: 36, top: r.y, width: 1008, height: r.h, transform: `translateX(${(1 - k) * -1000}px)`}}>
            <div style={{position: 'absolute', left: 0, top: 0, width: 150, height: r.h, borderRadius: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: `linear-gradient(180deg, ${mix(col, '#fff', 0.35)} 0%, ${col} 50%, ${shade(col, 0.7)} 100%)`, boxShadow: `0 0 0 6px ${INK}, 0 10px 0 6px ${DEEP}`}}>
              <Label text={r.tier} size={88} /><Label text={r.cut} size={38} /></div>
            <div style={{position: 'absolute', left: 164, top: 0, width: 844, height: r.h, borderRadius: 28, background: 'rgba(10,12,30,0.82)', boxShadow: `0 0 0 6px ${INK}`}} />
            {r.items.map((b: any, j: number) => {
              const f = frame - at - 6 - j * 1.6;
              if (f < 0) return null;
              return (
                <div key={b.b.id} style={{position: 'absolute', left: 182 + (j % PER) * 118, top: 14 + Math.floor(j / PER) * 152, width: BF, textAlign: 'center', transform: `scale(${outBack(f / 7, 2)})`}}>
                  <Face src={b.b.face} size={BF} color={col} />
                  <div style={{marginTop: 6}}><Label text={b.v} size={34} color="#ffffff" stroke={5} /></div>
                </div>
              );
            })}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Outro: React.FC<SceneProps> = ({plan, seg, frame, t, spb}) => (
  <Ending frame={frame} t={t} spb={spb} color={VIOLET} big={seg.big} line1={seg.line1} line2={seg.line2} {...hookOf(plan, seg.lead || 'MORE WORLDS NUMBERS ON')} />
);

export const Worlds: React.FC<{plan: Plan}> = ({plan}) => (
  <Stage plan={plan} scenes={{wf_intro: Intro, wf_compare: Compare, wf_rows: Rows, wf_hero: Hero, wf_grid: Grid, wf_bans: Bans, wf_draft: Draft, wf_set: SetScene, wf_say: Say, wf_bantiers: BanTiers, wf_outro: Outro}}
    swipeInto={['wf_compare', 'wf_rows', 'wf_hero', 'wf_grid', 'wf_bans', 'wf_draft', 'wf_set', 'wf_bantiers', 'wf_outro']} />
);
