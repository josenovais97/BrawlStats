// What every format shares around its scenes: segments as sequences on the
// beat grid, a punch-in at each cut, and the swipe across the big cuts.
import React from 'react';
import {AbsoluteFill, Sequence, random, useCurrentFrame} from 'remotion';
import {Swipe} from './fx';
import {Plan, Segment} from './theme';

export type SceneProps = {seg: Segment; plan: Plan; frame: number; beat: number; t: number; spb: number};

export const Stage: React.FC<{plan: Plan; scenes: Record<string, React.FC<SceneProps>>; swipeInto: string[]}> = ({plan, scenes, swipeInto}) => {
  const frame = useCurrentFrame();
  const spb = plan.step * plan.fps; // frames per beat step
  const cuts = plan.segments.map((s) => ({at: Math.round(s.start * spb), kind: s.kind}));
  let swipe = 0;
  for (let i = 1; i < cuts.length; i++) {
    const d = frame - cuts[i].at;
    if (d > -6 && d < 6 && swipeInto.includes(cuts[i].kind) && cuts[i].kind !== cuts[i - 1].kind + '_') swipe = (d + 6) / 12;
  }
  return (
    <AbsoluteFill style={{background: '#000'}}>
      {plan.segments.map((seg, i) => {
        const from = Math.round(seg.start * spb);
        const dur = Math.round((seg.start + seg.len) * spb) - from;
        const Scene = scenes[seg.kind];
        if (!Scene) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Shot seg={seg} plan={plan} spb={spb} Scene={Scene} />
          </Sequence>
        );
      })}
      <Swipe p={swipe} />
    </AbsoluteFill>
  );
};

const Shot: React.FC<{seg: Segment; plan: Plan; spb: number; Scene: React.FC<SceneProps>}> = ({seg, plan, spb, Scene}) => {
  const frame = useCurrentFrame();
  const beat = frame / spb;
  const t = (seg.start * spb + frame) / plan.fps;
  // a punch-in and a short shake on the cut
  const k = Math.max(0, 1 - frame / 9);
  const shake = k * 18;
  const dx = (random(`x${seg.start}-${frame}`) - 0.5) * shake;
  const dy = (random(`y${seg.start}-${frame}`) - 0.5) * shake;
  return (
    <AbsoluteFill style={{transform: `translate(${dx}px, ${dy}px) scale(${1 + 0.05 * k})`}}>
      <Scene seg={seg} plan={plan} frame={frame} beat={beat} t={t} spb={spb} />
    </AbsoluteFill>
  );
};
