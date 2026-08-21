import { Suspense } from 'react';
import type { Metadata } from 'next';
import { after } from 'next/server';

import { BattleLog } from '@/components/player/battle-log';
import { LastOnline } from '@/components/player/last-online';
import { PlayerBrawlers } from '@/components/player/player-brawlers';
import { PlayerHeader } from '@/components/player/player-header';
import { PlayerNav } from '@/components/player/player-nav';
import { PlayerProgress } from '@/components/player/player-progress';
import { SinceLastVisit } from '@/components/player/since-last-visit';
import { PlayerMetaFit } from '@/components/player/player-meta-fit';
import { PlayerRecords, PlayerStats } from '@/components/player/player-stats';
import { PlayerSkillScore } from '@/components/player/player-skill-score';
import { PlayerUpgradeGap } from '@/components/player/player-upgrade-gap';
import { ErrorState } from '@/components/ui/error-state';
import { BattleLogSkeleton, InsightsSkeleton } from '@/components/ui/skeletons';
import { SectionHeading } from '@/components/ui/section-heading';
import { PlayerProgression } from '@/components/player/player-progression';
import { RecentSearchRecorder } from '@/components/recent-search-recorder';
import { RosterRecorder } from '@/components/player/roster-recorder';
import { PlayerInsights } from '@/components/player/player-insights';
import { PlayerPlacements } from '@/components/player/player-placements';
import { PlayerRanked } from '@/components/player/player-ranked';
import { getOfficialBrawlers, getPlayer, getPlayerRankings } from '@/lib/bs-api';
import { getBrawlerMap } from '@/lib/brawlapi';
import { coinsToMaxFrom, computeProgression, estimatePlaytime } from '@/lib/progression';
import { computeSkillScore } from '@/lib/skill-score';
import { toApiError } from '@/lib/errors';
import {
  getMetaIndex,
  getPlayerBrawlerPlacements,
  getReleasedBuffieCount,
  getTrophyHistory,
  getTrophyPercentile,
  recordLookup,
} from '@/lib/stats';
import { displayTag, normalizeTag } from '@/lib/tags';
import type { BSPlayer } from '@/types/brawlstars';

interface PageProps {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  try {
    const player = await getPlayer(tag);
    return {
      title: `${player.name} (${displayTag(player.tag)})`,
      description: `${player.name} has ${player.trophies.toLocaleString('en-US')} trophies and ${player.brawlers.length} brawlers.`,
      // Normalised, so #ABC, %23ABC and abc all resolve to one indexable URL
      // rather than three competing ones.
      alternates: { canonical: `/player/${normalizeTag(player.tag)}` },
      // Indexable pages must be a deliberate set. This one is not: the
      // combinations are effectively unbounded, and a crawler walking them costs
      // real API and function budget for pages nobody searched for. `follow` is
      // kept so the links out of them still pass value to the pages that matter.
      robots: { index: false, follow: true },
    };
  } catch {
    return { title: `Player ${displayTag(tag)}` };
  }
}

export default async function PlayerPage({ params }: PageProps) {
  const { tag } = await params;

  let player;
  try {
    player = await getPlayer(tag);
  } catch (err) {
    const apiError = toApiError(err);
    return (
      <ErrorState
        code={apiError.code}
        title={apiError.code === 'notFound' ? 'Player not found' : undefined}
        detail={
          apiError.code === 'notFound'
            ? `No player exists with the tag ${displayTag(tag)}. Check it in-game under your profile.`
            : undefined
        }
      />
    );
  }

  // Every successful lookup widens the sampling pool the tier list draws on.
  // `after` runs it once the response is sent, so it never delays the page.
  after(() =>
    recordLookup({
      tag: normalizeTag(player.tag),
      name: player.name,
      trophies: player.trophies,
      highestTrophies: player.highestTrophies,
      brawlerCount: player.brawlers.length,
      iconId: player.icon?.id,
      rankedElo: player.rankedElo,
      rankedRankName: player.rankedRankName,
      highestRankedElo: player.highestAllTimeRankedElo,
      highestRankedRankName: player.highestAllTimeRankedRankName,
    }),
  );

  // Artwork metadata is a separate, keyless source. If it is unavailable the
  // page still renders — brawler cards just fall back to CDN-pattern URLs.
  // The official catalogue supplies the per-brawler totals that progression
  // needs (gears and hypercharges are not in the brawlapi payload).
  const normalizedTag = normalizeTag(player.tag);

  const [brawlerMeta, catalogue] = await Promise.all([
    getBrawlerMap().catch(() => new Map()),
    getOfficialBrawlers()
      .then((r) => r.items)
      .catch(() => []),
  ]);

  // Database reads run one at a time so the page never needs more than one
  // connection, and each degrades to null/empty on its own.
  const placements = await getPlayerBrawlerPlacements(normalizedTag);
  const standing = await getTrophyPercentile(player.trophies);
  const releasedBuffies = await getReleasedBuffieCount();
  const trophyHistory = await getTrophyHistory(normalizedTag);
  // The trophy tier list, joined against this roster below and onto every tile
  // in the grid. Empty without a database, which every consumer handles.
  const metaIndex = await getMetaIndex('trophy', 7);

  const progression = computeProgression(player, catalogue, releasedBuffies);
  const playtime = estimatePlaytime(player);
  // Pure function over the payload we already have — no database, no extra
  // call. The catalogue length is passed so roster-completeness scales as
  // Supercell adds brawlers instead of being pinned to today's count.
  const skill = computeSkillScore(player, catalogue.length || undefined);

  return (
    <div className="space-y-8">
      <RecentSearchRecorder
        kind="player"
        tag={normalizedTag}
        name={player.name}
        icon={player.icon?.id}
      />
      {/* Remembers the roster on this device so the draft helper can offer to
          recommend only from brawlers this account owns. Nothing leaves the
          browser — see `lib/roster`. */}
      <RosterRecorder
        tag={normalizedTag}
        name={player.name}
        owned={player.brawlers.map((b) => b.id)}
        power11={player.brawlers.filter((b) => b.power >= 11).map((b) => b.id)}
      />
      <PlayerHeader
        player={player}
        lastOnline={
          <Suspense fallback={null}>
            <LastOnline tag={tag} />
          </Suspense>
        }
      />
      {/* High in the page on purpose: a returning visitor's first question is
          "what changed", and it costs nothing to answer. Every number here is
          already on screen below. */}
      <SinceLastVisit
        tag={normalizedTag}
        trophies={player.trophies}
        brawlers={player.brawlers.length}
        power11={player.brawlers.filter((b) => b.power >= 11).length}
        hyperCharges={player.brawlers.reduce(
          (sum, b) => sum + (b.hyperCharges?.length ?? 0),
          0,
        )}
        skill={skill.score}
      />
      <PlayerNav />

      {/*
       * Ordered by the questions a visitor actually arrives with.
       *
       * The header answers "who is this". These two answer "how strong is the
       * account" and "where do they stand", which is what someone opening a
       * profile wants before anything else, and both used to sit below a grid
       * of lifetime counters. On a phone that meant scrolling past most of a
       * screen of readouts to reach the only two numbers that are judgements.
       *
       * The counters are not demoted for being uninteresting, they are
       * demoted for being reference: you look them up, you do not open a
       * profile to find them.
       */}
      <PlayerSkillScore skill={skill} />
      <Suspense fallback={<PlayerRanked player={player} standing={standing} />}>
        <RankedWithBoard player={player} standing={standing} tag={normalizedTag} />
      </Suspense>

      <div id="stats" className="scroll-anchor-nav space-y-8">
        <PlayerStats player={player} />
        <PlayerRecords player={player} />
        {/* Only ever populated for the couple of hundred players holding a
            global brawler placement, so it sits with the other reference
            readouts rather than above them. */}
        <PlayerPlacements
          placements={placements}
          iconFor={(id) => brawlerMeta.get(id)?.imageUrl}
        />
      </div>
      <div id="progress" className="scroll-anchor-nav space-y-8">
        <PlayerProgress points={trophyHistory} playerName={player.name} />
        <PlayerProgression progression={progression} playtime={playtime} />

        {/* Immediately after Progression, because it is the same subject read
            the other way round: Progression says how much of the account is
            finished and what finishing the rest costs, this names the specific
            brawlers worth finishing first. It used to sit near the top of the
            page, half a screen of its own, where nothing around it explained
            what the coins were for. Renders nothing on a maxed account rather
            than carrying an empty prompt. */}
        <PlayerUpgradeGap
          brawlers={player.brawlers}
          brawlerMeta={brawlerMeta}
          coinsPerLevel={coinsToMaxFrom}
        />
      </div>

      <PlayerMetaFit
        brawlers={player.brawlers}
        meta={metaIndex}
        brawlerMeta={brawlerMeta}
      />

      <Suspense fallback={<InsightsSkeleton />}>
        <PlayerInsights tag={tag} playerTag={player.tag} brawlerMeta={brawlerMeta} />
      </Suspense>

      <section id="battles" className="scroll-anchor-nav">
        <SectionHeading title="Recent battles" />
        <Suspense fallback={<BattleLogSkeleton />}>
          <BattleLog tag={tag} playerTag={player.tag} brawlerMeta={brawlerMeta} />
        </Suspense>
      </section>

      <section id="brawlers" className="scroll-anchor-nav">
        <SectionHeading
          title="Brawlers"
          aside={`${player.brawlers.length} unlocked`}
        />
        <PlayerBrawlers
          brawlers={player.brawlers}
          meta={Object.fromEntries(
            [...brawlerMeta.entries()].map(([id, b]) => [
              id,
              {
                imageUrl: b.imageUrl,
                rarityColor: b.rarity.color,
                rarityName: b.rarity.name,
                // `tier` is undefined below the sample floor, which the tile
                // renders as no chip rather than as a bottom-tier one.
                tier: metaIndex.get(id)?.tier ?? undefined,
                metaScore: metaIndex.get(id)?.metaScore ?? undefined,
              },
            ]),
          )}
        />
      </section>
    </div>
  );
}

/**
 * The global top-200 board, streamed rather than blocking the page.
 *
 * It resolves to a rank for 200 players worldwide and to null for everyone
 * else, so awaiting it before first paint made every profile wait on an answer
 * that is almost always "not on the board". The fallback is the same section
 * without the rank, so nothing shifts when it arrives.
 */
async function RankedWithBoard({
  player,
  standing,
  tag,
}: {
  player: BSPlayer;
  standing: Awaited<ReturnType<typeof getTrophyPercentile>>;
  tag: string;
}) {
  const globalRank = await getPlayerRankings('global', 200)
    .then((r) => r.items.find((p) => normalizeTag(p.tag) === tag)?.rank ?? null)
    .catch(() => null);

  return <PlayerRanked player={player} globalRank={globalRank} standing={standing} />;
}
