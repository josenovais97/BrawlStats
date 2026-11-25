// BrawlZone Bubble, the film (2026-11-25; v2 the same evening, owner: "show
// more features, improve the design, really amaze me"). One Ranked game and
// the season around it, shot like a product film: a dark studio, a phone with
// a body, interface that lifts off the glass. The screens are real: the panel
// from brawlzone.net (deploy/viral/app-film-capture.js) and the app itself,
// running on an emulator (branch app-footage), with the player's name changed.
// What moves is redrawn from the same answers.
import React from 'react';
import {AbsoluteFill, Img, Sequence, random, staticFile, useCurrentFrame} from 'remotion';
import {BODY, H, HEAD, INK, Plan, Segment, W, alpha, clamp, mix, outBack, outCubic} from './theme';
import {APP, CX, Device, Flash, GOLD, Glow, Lift, Orb, P, Piece, Pill, RINGS, Say, Shock, Sparks, Studio, Touch, Vignette, ease, hit, inOut, knock, lerp, num, sp} from './FilmKit';

const shot = (plan: any, name: string) => staticFile(plan.film.shots[name]);
/** A crop kept in film.json: {src, iw, box}. */
const cut = (plan: any, name: string) => { const c = plan.film.cuts[name]; return c ? {src: shot(plan, c.src), iw: c.iw, box: c.box} : null; };

// ------------------------------------------------------------------- the match
const LW = 980, LH = 452;
const PNW = Math.round(LW * 460 / 915), PNX = LW - PNW;
const SPOTS = [[-1, 0], [-1, 1], [-1, 2], [1, 0], [1, 1], [1, 2]];
const Game: React.FC<{plan: any; t: number; dim?: number}> = ({plan, t, dim = 0}) => {
  const all = [...plan.blue, ...plan.red];
  const spot = (i: number) => {
    const [side, k] = SPOTS[i];
    return [LW / 2 + side * (140 + k * 92) + 30 * Math.sin(t * 1.3 + k * 2 + side), 150 + k * 102 + 18 * Math.cos(t * 1.1 + k + side)];
  };
  return (
    <AbsoluteFill style={{background: '#2f7a3a', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: LW / 2, top: LH / 2 + 40, width: 1250, height: 821, transform: 'translate(-50%,-50%) perspective(900px) rotateX(32deg)'}}>
        <Img src={staticFile(plan.map)} style={{position: 'absolute', left: '50%', top: '50%', width: 821, height: 1250, transform: 'translate(-50%,-50%) rotate(90deg)'}} />
      </div>
      {[0, 1, 2, 3].map((n) => {
        const from = (n * 2 + Math.floor(t * 0.8 + n * 0.37)) % 6, to = (from + 3) % 6, ph = (t * 0.8 + n * 0.37) % 1;
        const [x0, y0] = spot(from), [x1, y1] = spot(to);
        const a = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI;
        return <div key={n} style={{position: 'absolute', left: x0 + (x1 - x0) * ph - 30, top: y0 - 45 + (y1 - y0) * ph, width: 60, height: 10, borderRadius: 5, transform: `rotate(${a}deg)`,
          background: `linear-gradient(90deg, transparent, ${from < 3 ? '#9fd4ff' : '#ffb08a'})`}} />;
      })}
      {all.map((b: any, i: number) => {
        const [x, y] = spot(i);
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, transform: 'translate(-50%,-100%)'}}>
            <div style={{position: 'absolute', left: '50%', bottom: -8, width: 74, height: 26, transform: 'translateX(-50%)', borderRadius: '50%', border: `5px solid ${i < 3 ? '#3c8cff' : '#ff4a4a'}`, background: 'rgba(0,0,0,0.25)'}} />
            <Img src={staticFile(b.art)} style={{height: 96, transform: i < 3 ? 'none' : 'scaleX(-1)'}} />
          </div>
        );
      })}
      <div style={{position: 'absolute', left: 66, bottom: 38, width: 124, height: 124, borderRadius: '50%', border: '6px solid rgba(255,255,255,0.32)'}} />
      <div style={{position: 'absolute', right: 66, bottom: 38, width: 114, height: 114, borderRadius: '50%', background: 'radial-gradient(circle,#ff8a4a,#d8401e)', boxShadow: '0 0 0 6px rgba(255,255,255,0.35)'}} />
      {dim > 0 && <AbsoluteFill style={{background: `rgba(5,8,25,${0.6 * dim})`}} />}
    </AbsoluteFill>
  );
};

// ===================================================================== scenes
/** The bubble drops, the lights come up, and the whole app bursts out of it. */
const Hook: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = hit(seg, 0, spb), b = hit(seg, 1, spb);
  const fall = clamp(frame / a);
  const y0 = 1010;
  const oy = frame < a ? lerp(-260, y0, fall * fall) : y0 - 46 * Math.abs(Math.sin(clamp((frame - a) / 13) * Math.PI)) * (1 - clamp((frame - a) / 13));
  const squash = Math.max(0, 1 - Math.abs(frame - a - 1) / 4);
  const on = clamp((frame - a) / 5);
  const burst = sp(frame - a - 2, 26, 0.55);
  const go = clamp((frame - b) / 22);
  const names: string[] = plan.film.burst;
  const n = names.length;
  const spin = t * 0.9 + 2.2 * outCubic(clamp((frame - a) / 50)) + 2.4 * go * go;
  const cards = names.map((name, i) => {
    const ang = (i / n) * Math.PI * 2 + spin;
    const depth = (Math.sin(ang) + 1) / 2;
    const rad = 520 * burst * (1 + 1.5 * go * go);
    return {name, i, ang, depth, x: CX + Math.cos(ang) * rad, y: y0 + Math.sin(ang) * rad * 0.42 + (i % 2 ? -270 : 210) * burst * (1 + go), s: (0.62 + 0.62 * depth) * (0.2 + 0.8 * clamp(burst)) * (1 + 1.7 * go * go * (0.4 + depth))};
  }).sort((p, q) => p.depth - q.depth);
  const piece = (c: any) => {
    const p = cut(plan, c.name);
    if (!p || burst <= 0) return null;
    const w = 500;
    return (
      <div key={c.i} style={{position: 'absolute', left: c.x - w / 2, top: c.y - 100, width: w, height: 200, opacity: clamp(burst * 3) * (0.6 + 0.4 * c.depth) * (1 - clamp((go - 0.72) / 0.28)), transform: `perspective(1200px) scale(${c.s}) rotateY(${Math.cos(c.ang) * -34}deg) rotateZ(${4 * Math.sin(t * 2 + c.i * 2)}deg)`, zIndex: c.depth > 0.5 ? 8 : 2}}>
        <Piece {...p} w={w} r={26} />
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <Studio color="#FFB43D" t={t} cy={y0} power={0.12 + 0.88 * on} floor={1500} />
      <AbsoluteFill style={{transform: `translate(${knock(frame - a) * 9}px, ${knock(frame - a - 1) * 14}px) scale(${1 + 0.25 * go * go})`, transformOrigin: `${CX}px ${y0}px`}}>
        {cards.filter((c) => c.depth <= 0.5).map(piece)}
        <div style={{position: 'absolute', left: CX - 210, top: 1200, width: 420, height: 90, borderRadius: '50%', background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.75), rgba(0,0,0,0))', transform: `scale(${0.4 + 0.6 * fall})`, zIndex: 3}} />
        <div style={{position: 'absolute', left: 0, top: 0, transform: `scale(${1 + 0.16 * squash}, ${1 - 0.16 * squash})`, transformOrigin: `${CX}px ${y0 + 190}px`, zIndex: 5}}>
          <Orb src={plan.me.face} x={CX} y={oy} d={360 * (1 + 0.5 * go * go)} t={t} glow={0.2 + 0.5 * on} rot={(1 - fall) * -50} />
        </div>
        {cards.filter((c) => c.depth > 0.5).map(piece)}
        <Shock x={CX} y={y0 + 180} f={frame - a} color={GOLD} r={980} len={22} />
        <Shock x={CX} y={y0} f={frame - a - 3} color="#fff" r={640} />
        <Sparks x={CX} y={y0 + 120} f={frame - a} n={34} r={760} />
      </AbsoluteFill>
      <Flash f={frame - a} a={0.75} len={9} color="#fff4d6" />
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** A tap in the draft: the panel slides over the game and the camera dives in. */
const TapIn: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const tap = hit(seg, 0, spb), open = hit(seg, 1, spb);
  const k = sp(frame - open, 15, 0.6);
  const z = inOut((frame - open - 4) / 26);
  const arrive = sp(frame, 20, 0.5);
  const s = lerp(0.98, 1.98, z);
  const cx = (PNX + PNW / 2 - LW / 2) * s * z;
  return (
    <AbsoluteFill>
      <Studio color="#3D7BFF" t={t} cy={1080} floor={1470} />
      <AbsoluteFill style={{transform: `translate(${-cx}px, ${-34 * z}px)`}}>
        <Device w={LW} h={LH} y={1080} s={s * (0.7 + 0.3 * arrive)} rx={lerp(34, 0, clamp(arrive)) * (1 - z) + 10 * (1 - z)} ry={lerp(-40, 8, clamp(arrive)) * (1 - z)} rz={-6 * (1 - z)} light={0.9 * (1 - 0.6 * z)}>
          <Game plan={plan} t={t + 3} dim={clamp(k)} />
          <Orb src={plan.me.face} x={78} y={108} d={84} t={t} glow={0.35} press={frame >= tap - 2 && frame <= tap + 4 ? 1 : 0} />
          <div style={{position: 'absolute', left: LW - PNW * clamp(k, 0, 1.02), top: 0, width: PNW, height: LH, background: APP.bg, overflow: 'hidden', boxShadow: '-16px 0 34px rgba(0,0,0,0.55)'}}>
            <Img src={shot(plan, 'draft0')} style={{width: PNW}} />
          </div>
          <Touch x={78} y={108} f={frame - tap} r={30} />
        </Device>
      </AbsoluteFill>
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** Who gets banned on the map: cards thrown from the dark, stamped as they land. */
const Bans: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const start = hit(seg, 0, spb), end = hit(seg, 4, spb);
  const list: any[] = plan.film.bans;
  // the fifth to the first, so the most banned lands last, in front
  const spots = [[0, 1010, 1.34], [-322, 930, 0.98], [322, 930, 0.98], [-250, 1318, 0.86], [250, 1318, 0.86]];
  const order = [4, 3, 2, 1, 0];
  const big = clamp((frame - end) / 10);
  const shake = knock(frame - end, 12);
  return (
    <AbsoluteFill>
      <Studio color="#FF3D5C" t={t} cy={1040} floor={1600} />
      <Pill text={`${plan.film.rank} · ${plan.film.map.toUpperCase()}`} y={520} k={sp(frame - 3, 12)} icon={plan.leagues?.masters} color={GOLD} />
      <AbsoluteFill style={{transform: `translate(${shake * 9}px, ${shake * 12}px) scale(${1 + 0.03 * Math.sin(t)})`}}>
        {order.map((i, j) => {
          const b = list[i];
          const at = hit(seg, j, spb);
          const k = sp(frame - at, 15, 0.75);
          if (!b || k <= 0) return null;
          const [dx, y, sc] = spots[i];
          const pctNow = Math.round(num(0, b.rate * 100, (frame - at) / 14));
          const st = sp(frame - at - 8, 8);
          const front = i === 0;
          return (
            <div key={i} style={{position: 'absolute', left: CX + dx - 170, top: y - 215, width: 340, height: 430, zIndex: front ? 9 : 4 - (i > 2 ? 1 : 0), opacity: clamp(k * 3),
              transform: `perspective(1500px) translateZ(${-1500 * (1 - k)}px) rotateY(${dx * -0.045 + 5 * Math.sin(t * 1.2 + i)}deg) rotateX(${50 * (1 - clamp(k)) + 3 * Math.sin(t + i * 2)}deg) rotate(${dx * 0.012}deg) scale(${sc * (front ? 1 : 1 - 0.06 * big)})`}}>
              <div style={{position: 'absolute', inset: 0, borderRadius: 38, overflow: 'hidden', background: 'linear-gradient(165deg, #ff5c72 0%, #8f1230 58%, #2b0512 100%)', boxShadow: `0 0 0 5px ${INK}, 0 0 0 8px ${front ? GOLD : 'rgba(255,255,255,0.28)'}, 0 44px 80px rgba(0,0,0,0.65)`}}>
                <Img src={staticFile(b.face)} style={{position: 'absolute', left: 0, top: 0, width: 340, height: 340, objectFit: 'cover'}} />
                <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, background: 'linear-gradient(180deg, rgba(20,2,8,0) 0%, rgba(20,2,8,0.96) 46%)'}} />
                <div style={{position: 'absolute', left: 0, right: 0, bottom: 92, textAlign: 'center', fontFamily: BODY, fontSize: 40, color: '#fff'}}>{b.name}</div>
                <div style={{position: 'absolute', left: 0, right: 0, bottom: 8, textAlign: 'center', fontFamily: HEAD, fontSize: 82, lineHeight: 1.05, color: GOLD}}>{pctNow}%</div>
                <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 60%)', transform: `translateX(${-120 + 300 * clamp((frame - at - 8) / 20)}%)`}} />
              </div>
              {st > 0 && (
                <div style={{position: 'absolute', right: -22, top: -26, width: 108, height: 108, transform: `scale(${2.6 - 1.6 * clamp(st)}) rotate(-14deg)`, opacity: clamp(st * 2)}}>
                  <svg width={108} height={108} viewBox="0 0 92 92"><circle cx={46} cy={46} r={36} fill="#14040a" stroke="#ff3d5c" strokeWidth={13} /><path d="M22 22 L70 70" stroke="#ff3d5c" strokeWidth={13} /></svg>
                </div>
              )}
            </div>
          );
        })}
        <Shock x={CX} y={1010} f={frame - end - 6} color="#ff8a9a" r={900} len={20} />
        <Sparks x={CX} y={1010} f={frame - end - 6} color="#ff8a9a" n={26} r={720} />
      </AbsoluteFill>
      <Flash f={frame - end - 6} a={0.35} color="#ff8a9a" />
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** The best picks for this draft, on a podium. */
const Picks: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const d = plan.film.draft;
  const order = [2, 1, 0];
  const px = [CX, CX - 322, CX + 322], ph = [430, 320, 250], w = 300;
  const floor = 1580;
  const board = sp(frame - 2, 14);
  const chip = (p: any, col: string, i: number) => (
    <div key={i} style={{width: 108, height: 108, borderRadius: 26, overflow: 'hidden', background: APP.surface2, boxShadow: `0 0 0 5px ${col}, 0 0 0 9px ${INK}`, transform: `scale(${sp(frame - 4 - i * 3, 12)})`}}><Img src={staticFile(p.face)} style={{width: 108, height: 108}} /></div>
  );
  return (
    <AbsoluteFill>
      <Studio color="#27D17F" t={t} cy={1060} floor={floor} />
      <Pill text={`${plan.film.rank} · ${plan.film.map.toUpperCase()}`} y={520} k={sp(frame - 3, 12)} icon={plan.leagues?.masters} color={GOLD} />
      <div style={{position: 'absolute', left: 0, width: W, top: 606, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 26, opacity: clamp(board * 2), transform: `translateY(${30 * (1 - board)}px)`}}>
        {d.allies.map((p: any, i: number) => chip(p, APP.cyan, i))}
        <div style={{width: 108, height: 108, borderRadius: 26, border: `6px dashed ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: HEAD, fontSize: 70, color: GOLD, transform: `scale(${1 + 0.06 * Math.sin(t * 7)})`}}>?</div>
        <div style={{fontFamily: HEAD, fontSize: 56, color: APP.muted}}>VS</div>
        {d.enemies.map((p: any, i: number) => chip(p, APP.loss, i + 2))}
      </div>
      {order.map((i, j) => {
        const p = d.picks[i];
        const at = hit(seg, j, spb);
        const k = sp(frame - at, 18, 0.75);
        const land = sp(frame - at - 5, 15, 0.8);
        if (k <= 0) return null;
        const h = ph[i] * clamp(k, 0, 1.05), x = px[i], top = floor - h;
        const col = i === 0 ? '#FFC53D' : i === 1 ? '#C9D4F2' : '#E0935A';
        const art = i === 0 ? 520 : 410;
        const pctNow = Math.round(num(0, p.pct, (frame - at - 4) / 18));
        return (
          <React.Fragment key={i}>
            <Glow x={x} y={top - art * 0.45} r={art * 0.8} color={col} a={0.42 * clamp(k)} />
            <Img src={staticFile(p.art)} style={{position: 'absolute', left: x, top: top + 14 - 700 * (1 - clamp(land)), height: art, transform: `translate(-50%,-100%) scale(${0.9 + 0.1 * land + 0.012 * Math.sin(t * 2 + i)})`, transformOrigin: '50% 100%', opacity: clamp(land * 3), zIndex: i === 0 ? 6 : 4, maxWidth: 560}} />
            <div style={{position: 'absolute', left: x - w / 2 - 12, top: top - 22, width: w + 24, height: 46, borderRadius: '50%', background: mix(col, '#ffffff', 0.25), zIndex: 3, boxShadow: `0 0 60px ${alpha(col, 0.5)}`}} />
            <div style={{position: 'absolute', left: x - w / 2, top, width: w, height: h + 10, zIndex: 5 - (i === 0 ? 0 : 1), background: `linear-gradient(90deg, ${mix(col, '#0b1030', 0.5)} 0%, ${mix(col, '#0b1030', 0.12)} 34%, ${mix(col, '#0b1030', 0.3)} 70%, ${mix(col, '#0b1030', 0.66)} 100%)`, clipPath: `inset(0 0 0 0)`}}>
              <div style={{position: 'absolute', left: 0, right: 0, top: 34, textAlign: 'center', fontFamily: HEAD, fontSize: p.name.length > 7 ? 48 : 60, lineHeight: 1, color: '#fff', WebkitTextStroke: `10px ${INK}`, paintOrder: 'stroke fill'}}>{p.name}</div>
              <div style={{position: 'absolute', left: 0, right: 0, top: 98, textAlign: 'center', fontFamily: HEAD, fontSize: i === 0 ? 112 : 92, lineHeight: 1, color: '#fff', WebkitTextStroke: `12px ${INK}`, paintOrder: 'stroke fill'}}>{pctNow}%</div>
              <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 60%)', transform: `translateX(${-130 + 260 * clamp((frame - at - 10) / 24)}%)`}} />
            </div>
            <Shock x={x} y={top} f={frame - at - 9} color={col} r={i === 0 ? 560 : 320} len={16} />
            {i === 0 && <Sparks x={x} y={top - 200} f={frame - at - 9} n={34} r={700} len={30} />}
          </React.Fragment>
        );
      })}
      <Flash f={frame - hit(seg, 2, spb) - 9} a={0.4} color="#fff0c0" />
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** They locked in a pick: who beats it. */
const Counter: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const c = plan.film.counter;
  const inF = hit(seg, 0, spb), h = [1, 2, 3].map((i) => hit(seg, i, spb));
  const k = sp(frame - inF, 18, 0.7);
  const hurt = h.reduce((n, x) => n + (frame >= x + 5 ? Math.max(0, 1 - (frame - x - 5) / 9) : 0), 0);
  const shake = h.reduce((n, x) => n + knock(frame - x - 5, 9), 0) + knock(frame - inF - 5, 10);
  return (
    <AbsoluteFill>
      <Studio color="#FF6A2E" t={t} cy={960} floor={1560} />
      <AbsoluteFill style={{transform: `translate(${shake * 7}px, ${shake * 9}px)`}}>
        <Glow x={770} y={980} r={620} color="#ff3d5c" a={0.55} />
        <div style={{position: 'absolute', right: -40, top: 1500, width: 620, height: 110, borderRadius: '50%', background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.8), rgba(0,0,0,0))'}} />
        <Img src={staticFile(c.target.art)} style={{position: 'absolute', right: -80 - 800 * (1 - clamp(k)) - 40 * hurt, top: 590, height: 980, transformOrigin: '50% 100%', transform: `rotate(${5 * hurt + 1.4 * Math.sin(t * 1.3)}deg) scale(${1 + 0.02 * Math.sin(t * 1.6)})`}} />
        {hurt > 0.3 && <Img src={staticFile(c.target.art)} style={{position: 'absolute', right: -80 - 40 * hurt, top: 590, height: 980, transformOrigin: '50% 100%', transform: `rotate(${5 * hurt}deg)`, filter: 'brightness(0) invert(1)', opacity: 0.7 * hurt}} />}
        <div style={{position: 'absolute', right: 62, top: 1420, fontFamily: HEAD, fontSize: 140, lineHeight: 1, color: '#fff', WebkitTextStroke: `18px ${INK}`, paintOrder: 'stroke fill', opacity: clamp(k * 2), transform: `translateX(${400 * (1 - clamp(k))}px) rotate(-3deg)`}}>{c.target.name}</div>
        <Pill text={plan.film.rank} y={520} x={CX} k={sp(frame - 3, 12)} icon={plan.leagues?.masters} color={GOLD} />
        {c.list.slice(0, 3).map((b: any, i: number) => {
          const kk = sp(frame - h[i], 14, 0.8);
          if (kk <= 0) return null;
          return (
            <div key={i} style={{position: 'absolute', left: 54, top: 660 + i * 250, width: 590, height: 214, zIndex: 8, transform: `perspective(1400px) translateX(${-900 * (1 - kk)}px) rotateY(${16 + 5 * Math.sin(t + i)}deg) rotateX(${2 * Math.sin(t * 1.2 + i)}deg)`, transformOrigin: '0 50%'}}>
              <div style={{position: 'absolute', inset: 0, borderRadius: 42, background: 'linear-gradient(120deg, #35d784 0%, #14663f 64%, #0b3424 100%)', boxShadow: `0 0 0 5px ${INK}, 0 0 0 8px rgba(255,255,255,0.3), inset 0 3px 0 rgba(255,255,255,0.35), 0 34px 60px rgba(0,0,0,0.6)`}} />
              <Img src={staticFile(b.face)} style={{position: 'absolute', left: 18, top: 18, width: 178, height: 178, borderRadius: 32, boxShadow: `0 0 0 5px ${INK}`}} />
              <div style={{position: 'absolute', left: 226, top: 40, fontFamily: HEAD, fontSize: 72, lineHeight: 1, color: '#fff', textShadow: '0 5px 0 rgba(0,0,0,0.3)'}}>{b.name}</div>
              <div style={{position: 'absolute', left: 226, top: 124, fontFamily: BODY, fontSize: 48, lineHeight: 1, color: '#d8ffe7'}}>+{num(0, b.edge, (frame - h[i] - 3) / 14).toFixed(1)} points</div>
              <div style={{position: 'absolute', inset: 0, borderRadius: 42, overflow: 'hidden'}}><div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 60%)', transform: `translateX(${-130 + 260 * clamp((frame - h[i] - 5) / 20)}%)`}} /></div>
            </div>
          );
        })}
        {h.map((x, i) => <React.Fragment key={i}><Shock x={720} y={900 + i * 170} f={frame - x - 5} r={380} color="#fff" len={12} /><Sparks x={720} y={900 + i * 170} f={frame - x - 5} color="#ffd9b0" n={14} r={360} len={16} /></React.Fragment>)}
      </AbsoluteFill>
      <Flash f={frame - inF - 4} a={0.4} color="#ff8a5c" />
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** Three more tabs, each a slab of glass that swings to the front on its word. */
const More: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const tabs = ['comps', 'trophies', 'ask'];
  const cols = ['#3D7BFF', '#FFB43D', '#8B6BFF'];
  const hs = [0, 1, 2].map((i) => hit(seg, i, spb));
  let pos = 0;
  for (let i = 1; i < 3; i++) pos += clamp(sp(frame - hs[i], 14, 0.6), 0, 1.06);
  const now = Math.min(2, Math.round(pos));
  const w = 880, h = w * 422 / 460;
  return (
    <AbsoluteFill>
      <Studio color={cols[now]} t={t} cy={1060} floor={1600} />
      <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, perspective: 1900, perspectiveOrigin: '50% 54%'}}>
        <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateX(${6 + 2 * Math.sin(t)}deg)`}}>
          {tabs.map((name, i) => {
            const u = i - pos;
            const k = sp(frame - 1, 16, 0.7);
            return (
              <div key={i} style={{position: 'absolute', left: CX - w / 2, top: 1060 - h / 2, width: w, height: h, borderRadius: 44, overflow: 'hidden', opacity: clamp(1.25 - Math.abs(u) * 0.55) * clamp(k * 2),
                transform: `translateX(${u * 760}px) translateZ(${-Math.abs(u) * 620 - 700 * (1 - k)}px) rotateY(${clamp(u, -1.2, 1.2) * -48 + 4 * Math.sin(t * 1.1)}deg)`,
                boxShadow: `0 0 0 4px ${INK}, 0 0 0 8px ${Math.abs(u) < 0.4 ? alpha(cols[i], 0.9) : 'rgba(255,255,255,0.2)'}, 0 70px 120px rgba(0,0,0,0.65)`}}>
                <Img src={shot(plan, name)} style={{width: w}} />
                <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(112deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.08) 100%)'}} />
              </div>
            );
          })}
        </div>
      </div>
      {hs.map((x, i) => <Shock key={i} x={CX} y={1060} f={frame - x - 2} color={cols[i]} r={820} len={14} />)}
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** The scoreboard, as the panel draws it, with its numbers counting. */
const Score: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const s = plan.film.score;
  const banner = hit(seg, 0, spb), rows = hit(seg, 1, spb), shine = hit(seg, 2, spb);
  const topK = Math.max(...s.rows.map((r: any) => r.k)), topD = Math.max(...s.rows.map((r: any) => r.dmg));
  const kb = sp(frame - banner, 14);
  const short = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
  const step = Math.max(2, spb * 0.16);
  const push = inOut((frame - shine + 4) / 20);
  const row = (r: any, i: number) => {
    const at = rows + i * step;
    const k = sp(frame - at, 13);
    const u = clamp((frame - at - 3) / 22);
    const best = frame >= shine && r.k === topK, bestD = frame >= shine && r.dmg === topD;
    const hero = r.you ? push : 0;
    return (
      <div key={i} style={{position: 'relative', height: 108, opacity: clamp(k * 2) * (r.you ? 1 : 1 - 0.55 * push), transform: `perspective(1400px) translateX(${(r.side === 'mine' ? -1 : 1) * 320 * (1 - clamp(k))}px) translateZ(${hero * 62}px)`, display: 'flex', alignItems: 'center', gap: 22, padding: '0 22px', borderRadius: 28, zIndex: r.you ? 5 : 1,
        background: r.you ? `linear-gradient(90deg, ${mix('#4a3a14', '#6b5010', hero)}, #33290f)` : 'transparent', boxShadow: r.you ? `inset 0 0 0 4px rgba(255,197,61,${0.65 + 0.35 * hero}), 0 ${30 * hero}px ${60 * hero}px rgba(0,0,0,0.6)` : 'none'}}>
        <div style={{position: 'relative', width: 82, height: 82, flex: '0 0 auto'}}>
          <Img src={staticFile(r.face)} style={{width: 82, height: 82, borderRadius: 22, boxShadow: `0 0 0 5px ${r.you ? APP.gold : '#050a1f'}`}} />
          {r.star && <div style={{position: 'absolute', right: -12, top: -14, fontSize: 42, lineHeight: 1, color: APP.gold, WebkitTextStroke: `5px ${INK}`, paintOrder: 'stroke fill'}}>★</div>}
        </div>
        <div style={{flex: '1 1 auto', minWidth: 0}}>
          <div style={{fontFamily: BODY, fontSize: 42, lineHeight: 1, color: r.you ? APP.gold : '#fff'}}>{r.name}</div>
          <div style={{marginTop: 12, height: 14, borderRadius: 7, background: 'rgba(0,0,0,0.4)', overflow: 'hidden'}}>
            <div style={{width: `${(r.dmg / topD) * 100 * outCubic(u)}%`, height: '100%', borderRadius: 7, background: r.side === 'mine' ? 'linear-gradient(90deg,#1aa6ff,#5fe0ff)' : 'linear-gradient(90deg,#c9203a,#ff6a7c)'}} />
          </div>
        </div>
        <div style={{width: 136, textAlign: 'center', fontFamily: HEAD, fontSize: best ? 66 : 52, color: '#fff'}}><span style={{color: best ? GOLD : '#fff'}}>{Math.round(num(0, r.k, u))}</span><span style={{color: APP.muted, fontSize: 42}}>/{Math.round(num(0, r.d, u))}</span></div>
        <div style={{width: 142, textAlign: 'right', fontFamily: BODY, fontSize: bestD ? 50 : 44, color: bestD ? GOLD : '#fff'}}>{short(num(0, r.dmg, u))}</div>
      </div>
    );
  };
  const mine = s.rows.filter((r: any) => r.side === 'mine'), theirs = s.rows.filter((r: any) => r.side === 'theirs');
  const bans = (list: string[], left: boolean) => (
    <div style={{display: 'flex', gap: 10}}>
      {list.map((f, i) => (
        <div key={i} style={{position: 'relative', width: 56, height: 56, transform: `scale(${sp(frame - rows - 6 * step - i * 2 - (left ? 0 : 4), 11)})`}}>
          <Img src={staticFile(f)} style={{width: 56, height: 56, borderRadius: 14, opacity: 0.55}} />
          <div style={{position: 'absolute', left: 4, top: 26, width: 48, height: 6, borderRadius: 3, background: APP.loss, transform: 'rotate(-45deg)'}} />
        </div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill>
      <Studio color={s.win ? '#22C96E' : '#FF3D5C'} t={t} cy={1000} floor={1640} />
      <div style={{position: 'absolute', left: CX - 500, top: 530, width: 1000, transformOrigin: '50% 60%', transform: `perspective(2200px) rotateX(${8 - 6 * push}deg) rotateY(${lerp(-9, 5, clamp(frame / 90))}deg) scale(${0.93 + 0.0006 * frame + 0.03 * push})`}}>
        <div style={{height: 172, borderRadius: 40, overflow: 'hidden', position: 'relative', background: s.win ? 'linear-gradient(120deg,#35d784 0%,#17734a 60%,#0e3f2c 100%)' : 'linear-gradient(120deg,#ff5c72,#a3243c 60%,#4a0f1c)', boxShadow: `0 0 0 5px ${INK}, 0 0 0 8px rgba(255,255,255,0.24), inset 0 3px 0 rgba(255,255,255,0.35), 0 30px 60px rgba(0,0,0,0.5)`, transform: `scale(${0.5 + 0.5 * kb})`, opacity: clamp(kb * 2)}}>
          <div style={{position: 'absolute', left: 44, top: 30, fontFamily: HEAD, fontSize: 88, lineHeight: 1, color: '#fff', textShadow: '0 5px 0 rgba(0,0,0,0.35)'}}>{s.win ? 'VICTORY' : 'DEFEAT'}</div>
          <div style={{position: 'absolute', left: 46, top: 120, display: 'flex', alignItems: 'center', gap: 10, fontFamily: BODY, fontSize: 33, lineHeight: 1, color: 'rgba(255,255,255,0.92)'}}>{s.modeIcon && <Img src={staticFile(s.modeIcon)} style={{height: 35}} />}{s.map}</div>
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0) 42%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 58%)', transform: `translateX(${-130 + 260 * clamp((frame - banner - 4) / 20)}%)`}} />
        </div>
        <div style={{marginTop: 24, borderRadius: 40, padding: '18px 16px 22px', background: 'linear-gradient(180deg,#24367f,#141f52)', boxShadow: `0 0 0 5px ${INK}, 0 0 0 8px rgba(255,255,255,0.16), inset 0 3px 0 rgba(255,255,255,0.16), 0 60px 110px rgba(0,0,0,0.65)`, opacity: clamp(sp(frame - rows + 6, 12) * 2)}}>
          <div style={{display: 'flex', alignItems: 'center', padding: '0 24px 8px', fontFamily: BODY, fontSize: 28, color: APP.muted}}><span style={{flex: '1 1 auto'}}>SCOREBOARD</span><span style={{width: 136, textAlign: 'center'}}>K/D</span><span style={{width: 142, textAlign: 'right'}}>DAMAGE</span></div>
          {mine.map((r: any, i: number) => row(r, i))}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px'}}>{bans(s.bans.mine, true)}<span style={{fontFamily: HEAD, fontSize: 34, color: APP.muted}}>VS</span>{bans(s.bans.theirs, false)}</div>
          {theirs.map((r: any, i: number) => row(r, i + 3))}
        </div>
      </div>
      <Sparks x={CX + 250} y={960} f={frame - shine} n={24} r={520} />
      <Flash f={frame - shine} a={0.25} color="#ffe9a8" />
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** The Bubble Pass: a ring a beat, the legendary one last. */
const Pass: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const order = ['gold', 'ember', 'frost', 'toxic', 'galaxy'];
  const hs = order.map((_, i) => hit(seg, i, spb));
  let i = 0;
  hs.forEach((x, j) => { if (frame >= x) i = j; });
  const k = sp(frame - hs[i], 12);
  const last = i === order.length - 1;
  const u = clamp((frame - hs[0]) / Math.max(1, hs[4] - hs[0]));
  const y = 960, d = (last ? 520 : 440) * (0.84 + 0.16 * k);
  return (
    <AbsoluteFill>
      <Studio color={last ? '#8B5CFF' : mix(RINGS[order[i]][0], '#3b2bb0', 0.45)} t={t} cy={y} floor={1600} />
      {last && [...Array(16).keys()].map((n) => (
        <div key={n} style={{position: 'absolute', left: CX - 14, top: y - 1100, width: 28, height: 1100, transformOrigin: '50% 100%', transform: `rotate(${n * 22.5 + t * 22}deg)`, background: 'linear-gradient(0deg, rgba(170,120,255,0.5), rgba(170,120,255,0))', clipPath: 'polygon(46% 100%, 54% 100%, 100% 0, 0 0)'}} />
      ))}
      {order.map((ring, j) => {
        // the rings already won, small, around the big one
        const won = j < i ? sp(frame - hs[j + 1], 14) : 0;
        if (won <= 0) return null;
        const x = 216 + j * 216;
        return <Orb key={j} src={plan.me.face} x={lerp(CX, x, clamp(won))} y={lerp(y, 1326, clamp(won))} d={118 * (2.2 - 1.2 * clamp(won))} ring={ring} t={t} glow={0.25} />;
      })}
      <Orb src={plan.me.face} x={CX} y={y + 12 * Math.sin(t * 2)} d={d} ring={order[i]} t={t * (last ? 2.4 : 1.3)} glow={last ? 0.85 : 0.5} rot={6 * Math.sin(t * 1.5)} />
      {last && [0, 1, 2, 3].map((n) => <div key={n} style={{position: 'absolute', left: CX + Math.cos(t * 2.2 + n * 1.57) * 372 - 12, top: y + Math.sin(t * 2.2 + n * 1.57) * 372 - 12, width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 0 26px 10px rgba(180,130,255,0.9)'}} />)}
      <Shock x={CX} y={y} f={frame - hs[i]} r={last ? 1000 : 560} color={RINGS[order[i]][0]} />
      {last && <Sparks x={CX} y={y} f={frame - hs[i]} n={34} color="#c9a8ff" r={760} len={30} />}
      <Flash f={last ? frame - hs[4] : -1} a={0.55} color="#d9c8ff" />
      <div style={{position: 'absolute', left: CX - 400, top: 1450, width: 800}}>
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: BODY, fontSize: 44, color: '#fff', marginBottom: 14}}><span>Bubble Pass</span><span style={{color: GOLD}}>Tier {[2, 4, 6, 8, 10][i]}</span></div>
        <div style={{height: 36, borderRadius: 18, background: 'rgba(6,10,28,0.9)', boxShadow: `0 0 0 5px ${INK}, 0 0 0 8px rgba(255,255,255,0.18)`, overflow: 'hidden'}}><div style={{width: `${12 + 88 * outCubic(u)}%`, height: '100%', background: 'linear-gradient(90deg,#8B6BFF,#FF5CE1,#FFC53D)'}} /></div>
      </div>
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

// the app's own screens: {src, iw, ih, boxes: {name: [x, y, w, h]}} in film.json
const screen = (plan: any, name: string) => { const a = plan.film.app[name]; return {...a, url: shot(plan, a.src)}; };
const PW = 566, PH = Math.round(PW * 2400 / 1080);

/** A number in a glass chip, beside the phone. */
const Chip: React.FC<{k: number; x: number; y: number; label: string; value: string; col: string; rot?: number}> = ({k, x, y, label, value, col, rot = 0}) => (k <= 0 ? null : (
  <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${0.3 + 0.7 * k}) rotate(${rot}deg)`, opacity: clamp(k * 2), padding: '16px 32px 20px', borderRadius: 34, textAlign: 'center', zIndex: 20,
    background: 'linear-gradient(180deg, rgba(34,49,108,0.94), rgba(8,13,40,0.96))', boxShadow: `inset 0 3px 0 rgba(255,255,255,0.25), 0 0 0 5px ${col}, 0 0 0 10px ${INK}, 0 34px 70px rgba(0,0,0,0.65)`}}>
    <div style={{fontFamily: HEAD, fontSize: 104, lineHeight: 1, color: col}}>{value}</div>
    <div style={{fontFamily: BODY, fontSize: 36, color: '#fff', whiteSpace: 'nowrap'}}>{label}</div>
  </div>
));

/** Your season against your rank: the Stats page comes apart in the air. */
const Season: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = screen(plan, 'stats');
  const inF = hit(seg, 0, spb), lift = hit(seg, 1, spb), c = hit(seg, 2, spb), d = hit(seg, 3, spb);
  const arr = sp(frame - inF, 26, 0.55);
  const up = inOut((frame - lift) / 20);
  const boxes: [string, number[]][] = Object.entries(a.boxes);
  return (
    <AbsoluteFill>
      <Studio color="#22C98A" t={t} cy={1080} floor={1640} />
      <Device w={PW} h={PH} x={CX + 900 * (1 - arr) - 10 * up} y={1120} s={0.98 - 0.02 * up} rx={lerp(3, 34, up)} ry={lerp(-70 * (1 - arr) - 9, -20, up) + 2.5 * Math.sin(t * 0.9)} rz={lerp(0, 15, up)} light={1}
        above={boxes.map(([name, bx], i) => (
          <Lift key={name} src={a.url} iw={a.iw} box={bx} sw={PW} z={[300, 130, 60, 40][i] ?? 40} dx={[-30, 30, -10, 0][i] ?? 0} dy={[-70, 10, 36, 0][i] ?? 0} grow={[0.3, 0.06, 0.04, 0][i] ?? 0} r={20} k={up > 0 ? sp(frame - lift - i * 3, 22, 0.75) : 0} />
        ))}>
        <Img src={a.url} style={{width: PW, position: 'absolute', left: 0, top: 0}} />
      </Device>
      <Chip k={sp(frame - c, 14)} x={230} y={1500} label="your K/D" value={plan.film.season.kd} col={APP.win} rot={-4} />
      <Chip k={sp(frame - d, 14)} x={W - 230} y={1540} label="others at your rank" value={plan.film.season.others} col="#9fb2ff" rot={4} />
      <Sparks x={230} y={1500} f={frame - c} color={APP.win} r={300} />
      <Flash f={frame - lift} a={0.22} />
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** The brawlers page runs past; the season's card comes off it. */
const Brawlers: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = screen(plan, 'brawlers');
  const inF = hit(seg, 0, spb), run = hit(seg, 1, spb), card = hit(seg, 2, spb);
  const arr = sp(frame - inF, 24, 0.6);
  const m = PW / a.iw;
  const far = Math.max(0, a.ih * m - PH);
  const scroll = far * inOut((frame - run) / 62);
  const k = sp(frame - card, 22, 0.65);
  const cw = 560, ch = Math.round(cw * 1.6);
  return (
    <AbsoluteFill>
      <Studio color="#FFB43D" t={t} cy={1080} floor={1640} />
      <Device w={PW} h={PH} x={CX - 190 * clamp(k)} y={1120 + 900 * (1 - arr)} s={0.98 - 0.1 * clamp(k)} rx={4 + 6 * clamp(k)} ry={lerp(22, 14, clamp(arr)) + 12 * clamp(k) + 2 * Math.sin(t)} rz={-2 - 4 * clamp(k)} light={1}>
        <Img src={a.url} style={{width: PW, position: 'absolute', left: 0, top: -scroll, maxWidth: 'none'}} />
        {a.nav && <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: a.nav[3] * m, overflow: 'hidden'}}><Img src={shot(plan, a.nav[4])} style={{width: PW, position: 'absolute', left: 0, top: -a.nav[1] * m, maxWidth: 'none'}} /></div>}
      </Device>
      {k > 0 && (
        <div style={{position: 'absolute', left: CX + 190 - cw / 2, top: 1130 - ch / 2, width: cw, height: ch, zIndex: 12, borderRadius: 46, overflow: 'hidden',
          transform: `perspective(1800px) translateZ(${-900 * (1 - k)}px) translateY(${200 * (1 - clamp(k))}px) rotateY(${-70 * (1 - clamp(k)) - 11 + 4 * Math.sin(t * 1.1)}deg) rotateX(4deg) rotateZ(3deg)`, boxShadow: `0 0 0 4px ${INK}, 0 0 0 8px ${GOLD}, 0 60px 120px rgba(0,0,0,0.75), 0 0 120px rgba(255,180,60,0.35)`, opacity: clamp(k * 3)}}>
          <Img src={staticFile(plan.film.card)} style={{width: cw, position: 'absolute', left: 0, top: -40, maxWidth: 'none'}} />
          <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 60%)', transform: `translateX(${-140 + 290 * clamp((frame - card - 6) / 30)}%)`}} />
        </div>
      )}
      <Shock x={CX + 190} y={1130} f={frame - card - 3} color={GOLD} r={760} />
      <Sparks x={CX + 190} y={1130} f={frame - card - 3} n={24} r={640} />
      <Flash f={frame - card - 2} a={0.3} color="#fff0c0" />
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** The squad's week: the table off the glass, and a crown. */
const Squad: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = screen(plan, 'squad');
  const inF = hit(seg, 0, spb), lift = hit(seg, 1, spb), win = hit(seg, 2, spb);
  const arr = sp(frame - inF, 24, 0.55);
  const up = inOut((frame - lift) / 18);
  const crown = sp(frame - win, 14);
  const boxes: [string, number[]][] = Object.entries(a.boxes);
  return (
    <AbsoluteFill>
      <Studio color="#E0409A" t={t} cy={1080} floor={1640} />
      <Device w={PW} h={PH} x={CX - 900 * (1 - arr)} y={1130} s={0.98} rx={lerp(3, 26, up)} ry={lerp(70 * (1 - arr) + 9, 18, up) + 2.5 * Math.sin(t * 0.9)} rz={lerp(0, -11, up)} light={1}
        above={boxes.map(([name, bx], i) => (
          <Lift key={name} src={a.url} iw={a.iw} box={bx} sw={PW} z={[190, 90][i] ?? 50} dx={[24, -10][i] ?? 0} dy={[-10, 20][i] ?? 0} grow={[0.22, 0.1][i] ?? 0} r={20} k={up > 0 ? sp(frame - lift - i * 3, 22, 0.75) : 0} />
        ))}>
        <Img src={a.url} style={{width: PW, position: 'absolute', left: 0, top: 0}} />
      </Device>
      {crown > 0 && (
        <svg width={190} height={150} viewBox="0 0 190 150" style={{position: 'absolute', left: CX - 190, top: 440 - 420 * (1 - clamp(crown)), zIndex: 20, transform: `rotate(${-7 + 4 * Math.sin(t * 3)}deg)`, filter: 'drop-shadow(0 18px 24px rgba(0,0,0,0.6))'}}>
          <path d="M12 40 L56 84 L95 14 L134 84 L178 40 L160 136 L30 136 Z" fill={GOLD} stroke={INK} strokeWidth={10} strokeLinejoin="round" />
          <path d="M40 120 L150 120" stroke="#fff3c4" strokeWidth={8} strokeLinecap="round" />
        </svg>
      )}
      <Sparks x={CX - 95} y={540} f={frame - win - 5} n={26} r={520} />
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** The home screen with the app's widgets, and its notifications dropping in. */
const Alerts: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = screen(plan, 'home');
  const inF = hit(seg, 0, spb), hs = [1, 2, 3].map((i) => hit(seg, i, spb));
  const arr = sp(frame - inF, 24, 0.6);
  const notes: any[] = plan.film.app.notes;
  const back = clamp((frame - hs[0]) / 14);
  const buzz = hs.reduce((n, x) => n + knock(frame - x, 12), 0);
  return (
    <AbsoluteFill>
      <Studio color="#1AC9B4" t={t} cy={1080} floor={1640} />
      <Device w={PW} h={PH} x={CX + buzz * 5} y={1150 + 900 * (1 - arr)} s={1 - 0.05 * back} rx={6 + 8 * back} ry={-16 + 6 * back + 3 * Math.sin(t * 0.8)} rz={2 + buzz * 0.5} light={1}>
        <Img src={a.url} style={{width: PW, position: 'absolute', left: 0, top: 0}} />
        <AbsoluteFill style={{background: `rgba(3,6,20,${0.35 * back})`}} />
      </Device>
      {notes.map((n, i) => {
        const k = sp(frame - hs[i], 17, 0.75);
        if (k <= 0) return null;
        // each new one lands on top and pushes the older ones down
        let y = 640;
        for (let j = i + 1; j < notes.length; j++) y += (notes[j].h + 26) * clamp(sp(frame - hs[j], 15, 0.6));
        const w = 900;
        return (
          <div key={i} style={{position: 'absolute', left: CX - w / 2, top: y - 70 * (1 - clamp(k)), width: w, zIndex: 20 - i, opacity: clamp(k * 2.5), transformOrigin: '50% 0', transform: `perspective(1600px) translateZ(${-420 * (1 - clamp(k))}px) rotateX(${-58 * (1 - clamp(k)) + 2 * Math.sin(t * 1.4 + i)}deg) rotateY(${3 * Math.sin(t + i)}deg)`}}>
            <div style={{height: n.h, borderRadius: 46, background: 'linear-gradient(180deg, rgba(58,64,92,0.97), rgba(40,45,68,0.98))', boxShadow: `inset 0 2px 0 rgba(255,255,255,0.25), 0 0 0 3px rgba(255,255,255,0.12), 0 44px 80px rgba(0,0,0,0.6)`, position: 'relative', overflow: 'hidden'}}>
              <Img src={staticFile('app-icon.png')} style={{position: 'absolute', left: 30, top: 34, width: 96, height: 96, borderRadius: 26}} />
              <div style={{position: 'absolute', left: 156, top: 30, fontFamily: BODY, fontSize: 30, color: '#aeb8dc'}}>BrawlZone Bubble · now</div>
              <div style={{position: 'absolute', left: 156, top: 68, right: 36, fontFamily: BODY, fontSize: 46, lineHeight: 1.1, color: '#fff'}}>{n.title}</div>
              {n.body && <div style={{position: 'absolute', left: 156, top: 128, right: 36, fontFamily: BODY, fontSize: 34, lineHeight: 1.22, color: '#d4daf0'}}>{n.body}</div>}
            </div>
          </div>
        );
      })}
      {hs.map((x, i) => <Shock key={i} x={CX} y={720} f={frame - x - 2} color="#8ff5e6" r={620} len={16} />)}
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

/** Everything, at once: the camera pulls back from one number to the whole app. */
const Bento: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = hit(seg, 0, spb), pull = hit(seg, 1, spb);
  const f = plan.film, G = 20, X0 = 46, Y0 = 500, C3 = (W - 92 - G * 2) / 3;
  const x = (c: number) => X0 + c * (C3 + G), w = (n: number) => C3 * n + G * (n - 1);
  const hs = [232, 186, 186, 186, 150, 118];
  const y = hs.map((_, i) => Y0 + hs.slice(0, i).reduce((m, v) => m + v + G, 0));
  const face = (src: string, size: number, col = INK, style: React.CSSProperties = {}) => <Img src={staticFile(src)} style={{width: size, height: size, borderRadius: size * 0.25, boxShadow: `0 0 0 5px ${col}, 0 10px 20px rgba(0,0,0,0.4)`, ...style}} />;
  const row: React.CSSProperties = {position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, paddingBottom: 44};
  const blue = 'linear-gradient(160deg, #3350b8 0%, #1b2b70 55%, #101a4c 100%)';
  const me = plan.me.face;
  const pick = f.draft.picks, trio = f.orbit;
  type T = {c: number; n: number; r: number; label: string; bg: string; body: React.ReactNode};
  const tiles: T[] = [
    {c: 0, n: 2, r: 0, label: '', bg: 'linear-gradient(150deg, #35cf85, #0c4a30)', body: (
      <><div style={{position: 'absolute', left: 36, top: 22, fontFamily: BODY, fontSize: 38, color: '#d8ffe9'}}>Your K/D</div>
        <div style={{position: 'absolute', left: 32, top: 66, fontFamily: HEAD, fontSize: 158, lineHeight: 1, color: '#fff', textShadow: '0 8px 0 rgba(0,0,0,0.25)'}}>{f.season.kd}</div>
        <div style={{position: 'absolute', right: 36, top: 92, textAlign: 'right'}}><div style={{fontFamily: HEAD, fontSize: 72, lineHeight: 1, color: '#bfe9d3'}}>{f.season.others}</div><div style={{fontFamily: BODY, fontSize: 30, color: '#bfe9d3'}}>others</div></div></>)},
    {c: 2, n: 1, r: 0, label: 'Bubble Pass', bg: 'linear-gradient(150deg, #8b5cff, #2a1266)', body: <Orb src={me} x={C3 / 2} y={98} d={122} ring="galaxy" t={t * 2} glow={0.5} />},
    {c: 0, n: 2, r: 1, label: 'Best picks', bg: 'linear-gradient(150deg, #2aa56b, #0f3d4a)', body: <div style={row}>{pick.map((p: any, i: number) => <div key={i} style={{display: 'flex', alignItems: 'center', gap: 12}}>{face(p.face, 92, i ? INK : GOLD)}<span style={{fontFamily: HEAD, fontSize: 48, color: '#fff'}}>{p.pct}%</span></div>)}</div>},
    {c: 2, n: 1, r: 1, label: 'Bans', bg: 'linear-gradient(150deg, #ff5c72, #6e0f26)', body: <div style={row}>{face(f.bans[0].face, 100)}<span style={{fontFamily: HEAD, fontSize: 54, color: '#fff'}}>{Math.round(f.bans[0].rate * 100)}%</span></div>},
    {c: 0, n: 1, r: 2, label: 'Match review', bg: 'linear-gradient(150deg, #22a565, #0b3a26)', body: <div style={{...row, fontFamily: HEAD, fontSize: 92, color: '#fff'}}>{Math.max(...f.score.rows.filter((r: any) => r.you).map((r: any) => r.k))}/0</div>},
    {c: 1, n: 1, r: 2, label: 'Squad', bg: 'linear-gradient(150deg, #e0409a, #4d0f3a)', body: <div style={{...row, gap: 0}}>{[me, f.rival.face, f.orbit[2]].map((s0: string, i: number) => <div key={i} style={{marginLeft: i ? -18 : 0, zIndex: 3 - i, borderRadius: '50%', overflow: 'hidden', width: 96, height: 96, boxShadow: `0 0 0 6px ${[GOLD, APP.cyan, '#fff'][i]}, 0 0 0 10px ${INK}`}}><Img src={staticFile(s0)} style={{width: 96, height: 96}} /></div>)}</div>},
    {c: 2, n: 1, r: 2, label: 'Counters', bg: 'linear-gradient(150deg, #ff8a3d, #5c2208)', body: <div style={row}>{face(f.counter.list[0].face, 92, APP.win)}<span style={{fontFamily: HEAD, fontSize: 50, color: '#fff'}}>&gt;</span>{face(f.counter.target.face, 92, APP.loss)}</div>},
    {c: 0, n: 1, r: 3, label: 'Widgets', bg: 'linear-gradient(150deg, #a8641c, #2f1a08)', body: <div style={{...row, gap: 14}}><Img src={staticFile(plan.leagues.masters)} style={{height: 112}} /><span style={{fontFamily: HEAD, fontSize: 44, color: '#fff'}}>Masters I</span></div>},
    {c: 1, n: 2, r: 3, label: 'Trios', bg: blue, body: <div style={{...row, gap: 18}}>{f.trio.faces.map((s0: string, i: number) => <React.Fragment key={i}>{face(s0, 98)}</React.Fragment>)}<span style={{fontFamily: HEAD, fontSize: 64, color: '#8ff0b8', marginLeft: 14}}>{f.trio.pct}%</span></div>},
    {c: 0, n: 2, r: 4, label: '', bg: 'linear-gradient(150deg, #5b6cff, #1d1a66)', body: <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22}}><span style={{fontFamily: BODY, fontSize: 40, color: '#cfd6ff'}}>Ask</span><span style={{fontFamily: BODY, fontSize: 46, color: '#1A1200', background: GOLD, borderRadius: 28, padding: '12px 30px 16px'}}>{f.ask}</span></div>},
    {c: 2, n: 1, r: 4, label: '', bg: 'linear-gradient(150deg, #1ac9b4, #073d3a)', body: <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: BODY, fontSize: 46, color: '#fff'}}><span style={{fontSize: 70}}>🎁</span>Rewards</div>},
    {c: 0, n: 3, r: 5, label: '', bg: 'linear-gradient(120deg, #ffd768, #ff9a1f)', body: (
      <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', fontFamily: HEAD, fontSize: 58, color: '#241500'}}><span>FREE</span><span style={{opacity: 0.4}}>·</span><span>NO ADS</span><span style={{opacity: 0.4}}>·</span><span>22 LANGUAGES</span></div>)},
  ];
  const p = inOut((frame - pull) / 24);
  const s0 = 1.46, cx0 = x(0) + w(2) / 2, cy0 = y[0] + hs[0] / 2;
  const s = lerp(s0, 1, p), ox = lerp((CX - cx0) * s0, 0, p), oy = lerp((1040 - cy0) * s0 - (1040 - 1040), 0, p);
  return (
    <AbsoluteFill>
      <Studio color="#FFB43D" t={t} cy={1080} floor={1780} />
      <AbsoluteFill style={{transform: `translate(${ox}px, ${oy}px) scale(${s})`, transformOrigin: `${CX}px 1040px`}}>
        <div style={{position: 'absolute', inset: 0, perspective: 2000, perspectiveOrigin: '50% 54%'}}>
          <div style={{position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateX(${10 * (1 - p) + 4 * Math.sin(t)}deg) rotateY(${5 * Math.sin(t * 0.8)}deg)`}}>
            {tiles.map((q, i) => {
              const k = i === 0 ? sp(frame - a, 16) : sp(frame - pull - 1 - i * 2, 17, 0.75);
              if (k <= 0) return null;
              return (
                <div key={i} style={{position: 'absolute', left: x(q.c), top: y[q.r], width: w(q.n), height: hs[q.r], borderRadius: 38, overflow: 'hidden', background: q.bg, opacity: clamp(k * 2),
                  transform: `translateZ(${-700 * (1 - k) + 14 * Math.sin(t * 2.4 + i * 1.3)}px) rotateX(${70 * (1 - clamp(k))}deg) scale(${0.8 + 0.2 * k})`, boxShadow: `0 0 0 4px ${INK}, 0 0 0 7px rgba(255,255,255,0.24), inset 0 4px 0 rgba(255,255,255,0.26), inset 0 -60px 80px rgba(0,0,0,0.18), 0 34px 60px rgba(0,0,0,0.55)`}}>
                  {q.body}
                  {q.label && <div style={{position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', fontFamily: BODY, fontSize: 34, color: 'rgba(255,255,255,0.94)'}}>{q.label}</div>}
                  <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.34) 50%, rgba(255,255,255,0) 60%)', transform: `translateX(${-140 + 290 * clamp((frame - pull - 16 - i * 2.5) / 26)}%)`}} />
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
      <Flash f={frame - a} a={0.5} />
      <Say seg={seg} frame={frame} y={300} />
    </AbsoluteFill>
  );
};

/** The name, and where to get it. */
const Outro: React.FC<P> = ({plan, seg, frame, t, spb}) => {
  const a = hit(seg, 0, spb), b = hit(seg, 1, spb), c = hit(seg, 2, spb);
  const k = sp(frame - a, 18);
  const faces: string[] = plan.film.orbit;
  const y = 900;
  return (
    <AbsoluteFill>
      <Studio color="#FFB43D" t={t} cy={y} floor={1620} />
      {[...Array(18).keys()].map((n) => (
        <div key={n} style={{position: 'absolute', left: CX - 16, top: y - 1200, width: 32, height: 1200, transformOrigin: '50% 100%', transform: `rotate(${n * 20 + t * 14}deg)`, opacity: clamp(k) * 0.55, background: 'linear-gradient(0deg, rgba(255,197,61,0.55), rgba(255,197,61,0))', clipPath: 'polygon(44% 100%, 56% 100%, 100% 0, 0 0)'}} />
      ))}
      <Glow x={CX} y={y} r={720} color={GOLD} a={0.5} />
      {faces.map((src, i) => {
        const ang = (i / faces.length) * Math.PI * 2 + t * 0.7;
        const r = 430 * sp(frame - a - 2, 22, 0.6), depth = (Math.sin(ang) + 1) / 2, size = 104 + 56 * depth;
        return <Img key={i} src={staticFile(src)} style={{position: 'absolute', left: CX + Math.cos(ang) * r - size / 2, top: y + Math.sin(ang) * r * 0.4 - size / 2, width: size, height: size, borderRadius: size * 0.26, zIndex: depth > 0.5 ? 6 : 1, opacity: 0.45 + 0.55 * depth, boxShadow: `0 0 0 4px ${INK}, 0 20px 40px rgba(0,0,0,0.5)`}} />;
      })}
      <div style={{position: 'absolute', left: CX - 170, top: y - 170, width: 340, height: 340, zIndex: 4, transform: `perspective(1200px) rotateY(${(1 - clamp(k)) * 200 + 10 * Math.sin(t * 1.4)}deg) rotateX(${5 * Math.sin(t)}deg) scale(${0.2 + 0.8 * k})`}}>
        <Img src={staticFile('app-icon.png')} style={{width: 340, height: 340, borderRadius: 88, boxShadow: `0 0 0 8px ${INK}, 0 0 0 16px rgba(255,255,255,0.2), 0 60px 110px rgba(0,0,0,0.65)`}} />
        <div style={{position: 'absolute', inset: 0, borderRadius: 88, overflow: 'hidden'}}><div style={{position: 'absolute', inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 60%)', transform: `translateX(${-140 + 290 * clamp((frame - a - 14) / 26)}%)`}} /></div>
      </div>
      <Shock x={CX} y={y} f={frame - a} color={GOLD} r={900} />
      <Sparks x={CX} y={y} f={frame - a - 2} n={34} r={720} len={28} />
      <div style={{position: 'absolute', left: 0, width: W, top: 1150, textAlign: 'center', fontFamily: HEAD, fontSize: 118, lineHeight: 1, color: '#fff', WebkitTextStroke: `12px ${INK}`, paintOrder: 'stroke fill', textShadow: '0 8px 0 #1b2350, 0 24px 50px rgba(0,0,0,0.6)', opacity: clamp(sp(frame - b, 12) * 2), transform: `translateY(${46 * (1 - clamp(sp(frame - b, 14)))}px)`}}>BrawlZone Bubble</div>
      <div style={{position: 'absolute', left: CX, top: 1392, transform: `translate(-50%,-50%) scale(${sp(frame - c, 13) * (1 + 0.025 * Math.sin(t * 6))})`, display: 'flex', alignItems: 'center', gap: 24, padding: '28px 56px 32px', borderRadius: 999, background: 'linear-gradient(180deg, #ffffff, #dfe6fb)', boxShadow: `0 0 0 7px ${INK}, 0 0 0 11px rgba(255,255,255,0.25), 0 26px 60px rgba(0,0,0,0.55)`}}>
        <svg width={70} height={76} viewBox="0 0 64 70"><path d="M4 4 L36 35 L4 66 Z" fill="#00c3ff" /><path d="M4 4 L47 26 L36 35 Z" fill="#00e676" /><path d="M4 66 L47 44 L36 35 Z" fill="#ff3d4f" /><path d="M36 35 L47 26 L62 35 L47 44 Z" fill="#ffc400" /></svg>
        <span style={{fontFamily: BODY, fontSize: 70, color: '#12162e', whiteSpace: 'nowrap'}}>Free on Google Play</span>
      </div>
      <div style={{position: 'absolute', left: 0, width: W, top: 1500, textAlign: 'center', fontFamily: BODY, fontSize: 46, color: '#e6ebff', opacity: clamp(sp(frame - b, 10)) * clamp((frame - c - 8) / 8)}}>Search “BrawlZone Bubble”</div>
      <Flash f={frame - a} a={0.7} />
      <Say seg={seg} frame={frame} />
    </AbsoluteFill>
  );
};

const SCENES: Record<string, React.FC<P>> = {
  a2_hook: Hook, a2_tap: TapIn, a2_bans: Bans, a2_picks: Picks, a2_counter: Counter, a2_more: More, a2_score: Score, a2_season: Season,
  a2_brawlers: Brawlers, a2_squad: Squad, a2_pass: Pass, a2_alerts: Alerts, a2_bento: Bento, a2_outro: Outro,
};

/** How one scene gives way to the next: through the bubble's ring, past it, or around its corner. */
const CUTS: Record<string, 'zoom' | 'left' | 'up' | 'cube'> = {
  a2_tap: 'zoom', a2_bans: 'left', a2_picks: 'cube', a2_counter: 'left', a2_more: 'zoom', a2_score: 'cube', a2_season: 'zoom',
  a2_brawlers: 'up', a2_squad: 'cube', a2_pass: 'zoom', a2_alerts: 'left', a2_bento: 'zoom', a2_outro: 'zoom',
};
const CUT = 11;
const swing = (u: number) => { const x = clamp(u); return x >= 1 ? 1 : 1 - Math.pow(2, -8.5 * x) * (1 - x); };
const move = (kind: string, p: number, out: boolean): React.CSSProperties => {
  if (kind === 'left') return {transform: `translateX(${out ? -W * p : W * (1 - p)}px) skewX(${(out ? -1 : 1) * 7 * Math.sin(p * Math.PI)}deg)`};
  if (kind === 'up') return {transform: `translateY(${out ? -H * p : H * (1 - p)}px)`};
  if (kind === 'cube') return {transform: `perspective(2100px) translateZ(-540px) rotateY(${out ? -90 * p : 90 * (1 - p)}deg) translateZ(540px)`, backfaceVisibility: 'hidden'};
  return out ? {transform: `scale(${1 + 0.35 * p})`} : {};
};
/** The iris opens as the bubble does: a gold ring, the next scene inside it. */
const IRIS = 1240;
const Iris: React.FC<{p: number; t: number}> = ({p, t}) => {
  if (p >= 0.998) return null;
  const r = IRIS * p, b = 16 + 44 * (1 - p);
  return (
    <>
      <div style={{position: 'absolute', left: CX - r - b, top: H * 0.52 - r - b, width: (r + b) * 2, height: (r + b) * 2, borderRadius: '50%', zIndex: 5,
        background: `conic-gradient(from ${t * 140}deg, #FFE37A, #FFC53D, #FFAB00, #FFF3C4, #FFC53D, #FFE37A)`, WebkitMask: `radial-gradient(circle, transparent ${r}px, #000 ${r + 1.5}px)`, mask: `radial-gradient(circle, transparent ${r}px, #000 ${r + 1.5}px)`}} />
      <div style={{position: 'absolute', left: CX - r - b, top: H * 0.52 - r - b, width: (r + b) * 2, height: (r + b) * 2, borderRadius: '50%', zIndex: 5, boxShadow: `0 0 0 5px ${INK}, 0 0 90px 20px rgba(255,197,61,0.5)`}} />
    </>
  );
};
const Streaks: React.FC<{u: number; kind: string}> = ({u, kind}) => {
  if (u <= 0 || u >= 1 || kind === 'cube') return null;
  const a = Math.sin(u * Math.PI);
  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
      {[...Array(16).keys()].map((i) => {
        const r = random(`st${i}`), len = 260 + 520 * random(`sl${i}`);
        if (kind === 'zoom') {
          const ang = (i / 16) * Math.PI * 2 + r, d = 300 + 900 * u * (0.6 + r);
          return <div key={i} style={{position: 'absolute', left: CX + Math.cos(ang) * d, top: H * 0.52 + Math.sin(ang) * d, width: len * 0.5, height: 5, borderRadius: 3, transformOrigin: '0 50%', transform: `rotate(${ang * 57.3}deg)`, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,236,190,0.9))', opacity: a}} />;
        }
        const along = lerp(1.25, -0.6, u) + 0.3 * (r - 0.5);
        return kind === 'left'
          ? <div key={i} style={{position: 'absolute', left: along * W, top: random(`sy${i}`) * H, width: len, height: 4 + 4 * r, borderRadius: 4, background: 'linear-gradient(90deg, rgba(255,236,190,0.9), rgba(255,255,255,0))', opacity: a}} />
          : <div key={i} style={{position: 'absolute', left: random(`sy${i}`) * W, top: along * H, width: 4 + 4 * r, height: len, borderRadius: 4, background: 'linear-gradient(180deg, rgba(255,236,190,0.9), rgba(255,255,255,0))', opacity: a}} />;
      })}
    </AbsoluteFill>
  );
};

const Shot: React.FC<{seg: Segment; plan: any; spb: number; dur: number; Scene: React.FC<P>; into?: string; next?: string}> = ({seg, plan, spb, dur, Scene, into, next}) => {
  const frame = useCurrentFrame() * 30 / plan.fps;
  const t = (seg.start * spb + frame) / 30;
  const inn = into ? swing(frame / CUT) : 1;
  const out = next && frame > dur ? swing((frame - dur) / CUT) : 0;
  const style = inn < 0.999 && into ? move(into, inn, false) : out > 0 && next ? move(next, out, true) : {};
  return (
    <AbsoluteFill style={{zIndex: into && inn < 0.999 ? 2 : 1}}>
      <AbsoluteFill style={into === 'zoom' && inn < 0.998 ? {clipPath: `circle(${IRIS * inn}px at 50% 52%)`} : undefined}>
        <AbsoluteFill style={{...style, overflow: 'hidden', transformOrigin: '50% 52%', ...(into === 'zoom' && inn < 0.998 ? {transform: `scale(${1.22 - 0.22 * inn})`} : {})}}>
          <Scene seg={seg} plan={plan} frame={frame} dur={dur} t={t} spb={spb} />
          <Vignette />
        </AbsoluteFill>
      </AbsoluteFill>
      {into === 'zoom' && <Iris p={inn} t={t} />}
      {into && <Streaks u={frame / CUT} kind={into} />}
    </AbsoluteFill>
  );
};

export const AppFilm: React.FC<{plan: Plan}> = ({plan}) => {
  const spb = plan.step * 30, real = plan.step * plan.fps, over = Math.ceil(CUT * plan.fps / 30);
  const n = plan.segments.length;
  return (
    <AbsoluteFill style={{background: '#04050d'}}>
      {plan.segments.map((seg, i) => {
        const from = Math.round(seg.start * real);
        const dur = Math.round((seg.start + seg.len) * real) - from;
        const Scene = SCENES[seg.kind];
        if (!Scene) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={dur + (i < n - 1 ? over : 0)}>
            <Shot seg={seg} plan={plan} spb={spb} dur={dur * 30 / plan.fps} Scene={Scene} into={i > 0 ? CUTS[seg.kind] : undefined} next={i < n - 1 ? CUTS[plan.segments[i + 1].kind] : undefined} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
