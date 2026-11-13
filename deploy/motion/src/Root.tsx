import React from 'react';
import {Composition} from 'remotion';
import {Countdown} from './Countdown';
import {Quiz} from './Quiz';
import {Plan, loadFonts} from './theme';

loadFonts();

const empty: Plan = {kind: 'quiz', fps: 30, step: 0.93, beats: 1, duration: 1, period: 0.46, episode: 1, segments: []};
const meta = ({props}: {props: {plan: Plan}}) => ({durationInFrames: Math.max(1, Math.round(props.plan.duration * props.plan.fps)), fps: props.plan.fps});

export const Root: React.FC = () => (
  <>
    <Composition id="Quiz" component={Quiz} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Countdown" component={Countdown} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
  </>
);
