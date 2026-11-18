// Tier badges shared by broken, newbrawler and whatsnew (2026-11-18).
import React from 'react';
import {InlineTitle, Label} from './fx';
import {DEEP, INK, TIER, W, mix, outBack, shade} from './theme';

/** A tier as the tier list shows it: a square with the letter, "TIER" under it. */
export const TierBadge: React.FC<{tier: string; size?: number}> = ({tier, size = 170}) => {
  const c = TIER[tier] || '#9669ff';
  return (
    <div style={{width: size, height: size, borderRadius: size * 0.22, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(180deg, ${mix(c, '#fff', 0.4)} 0%, ${c} 50%, ${shade(c, 0.7)} 100%)`,
      boxShadow: `0 0 0 ${size * 0.045}px ${INK}, 0 ${size * 0.08}px 0 ${size * 0.045}px ${DEEP}, inset 0 ${size * 0.04}px 0 rgba(255,255,255,0.4)`}}>
      <InlineTitle text={tier} size={size * 0.62} />
      <div style={{marginTop: -size * 0.02}}><Label text="TIER" size={size * 0.17} /></div>
    </div>
  );
};

/** Last week's tier, an arrow, this week's; or the one tier if it held. u in frames since it starts. */
export const TierChange: React.FC<{was: string; now: string; f: number; y: number; size?: number}> = ({was, now, f, y, size = 190}) => {
  if (f < 0) return null;
  const k = (at: number, len = 9, s = 2) => outBack((f - at) / len, s);
  if (was === now) {
    return <div style={{position: 'absolute', left: W / 2, top: y, transform: `translate(-50%,-50%) scale(${k(0)})`}}><TierBadge tier={now} size={size} /></div>;
  }
  const big = f >= 18 ? 1 + 0.5 * (1 - outBack((f - 18) / 10, 1.4)) : 0;
  return (
    <>
      <div style={{position: 'absolute', left: W / 2 - 270, top: y, transform: `translate(-50%,-50%) scale(${0.85 * k(0)})`, opacity: f > 18 ? 0.75 : 1}}><TierBadge tier={was} size={size} /></div>
      {f > 9 && <svg width={150} height={110} viewBox="0 0 120 110" style={{position: 'absolute', left: W / 2 - 75, top: y - 55, transform: `scale(${k(9, 7)})`}}>
        <path d="M6 30 H60 V4 L114 55 L60 106 V80 H6 Z" fill="#fff" stroke={INK} strokeWidth="8" strokeLinejoin="round" />
      </svg>}
      {f >= 18 && <div style={{position: 'absolute', left: W / 2 + 270, top: y, transform: `translate(-50%,-50%) scale(${big})`}}><TierBadge tier={now} size={size} /></div>}
    </>
  );
};
