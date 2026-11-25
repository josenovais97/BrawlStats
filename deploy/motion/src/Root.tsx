import React from 'react';
import {Composition} from 'remotion';
import {Countdown} from './Countdown';
import {Drops, Giveaway, Modes, Ranks, Stop} from './Formats';
import {Quiz} from './Quiz';
import {RoastMains} from './Roast';
import {Worlds} from './Worlds';
import {Wrapped} from './Wrapped';
import {Daily} from './Daily';
import {Draw} from './Draw';
import {Broken} from './Broken';
import {NewBrawler} from './NewBrawler';
import {WhatsNew} from './WhatsNew';
import {Story} from './Story';
import {Weekly} from './Weekly';
import {BubblePromo} from './BubblePromo';
import {HiddenOp, HigherLower, PickRow, RankTier, WinRace} from './Arena';
import {Plan, loadFonts} from './theme';

loadFonts();

const empty: Plan = {kind: 'quiz', fps: 30, step: 0.93, beats: 1, duration: 1, period: 0.46, episode: 1, segments: []};
const meta = ({props}: {props: {plan: Plan}}) => ({durationInFrames: Math.max(1, Math.round(props.plan.duration * props.plan.fps)), fps: props.plan.fps});

export const Root: React.FC = () => (
  <>
    <Composition id="Quiz" component={Quiz} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Countdown" component={Countdown} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Modes" component={Modes} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Ranks" component={Ranks} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Stop" component={Stop} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Giveaway" component={Giveaway} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Drops" component={Drops} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="RoastMains" component={RoastMains} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Wrapped" component={Wrapped} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Draw" component={Draw} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Story" component={Story} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Worlds" component={Worlds} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Daily" component={Daily} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="BubblePromo" component={BubblePromo} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Weekly" component={Weekly} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="WhatsNew" component={WhatsNew} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="NewBrawler" component={NewBrawler} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="Broken" component={Broken} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="RankTier" component={RankTier} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="HigherLower" component={HigherLower} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="HiddenOp" component={HiddenOp} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="WinRace" component={WinRace} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
    <Composition id="PickRow" component={PickRow} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{plan: empty}} calculateMetadata={meta} />
  </>
);
