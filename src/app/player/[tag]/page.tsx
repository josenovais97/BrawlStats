import { Suspense } from 'react';
import type { Metadata } from 'next';
import { after } from 'next/server';

import { BattleLog } from '@/components/player/battle-log';
import { LastOnline } from '@/components/player/last-online';
import { PlayerBrawlers } from '@/components/player/player-brawlers';
import { PlayerHeader } from '@/components/player/player-header';
import { PlayerMetaFit } from '@/components/player/player-meta-fit';
import { PlayerRecords, PlayerStats } from '@/components/player/player-stats';
import { PlayerTrophyHistory } from '@/components/player/player-trophy-history';
import { ErrorState } from '@/components/ui/error-state';
import { BattleLogSkeleton, InsightsSkeleton } from '@/components/ui/skeletons';
import { SectionHeading } from '@/components/ui/section-heading';
import { PlayerProgression } from '@/components/player/player-progression';
import { RecentSearchRecorder } from '@/components/recent-search-recorder';
import { PlayerInsights } from '@/components/player/player-insights';
import { PlayerPlacements } from '@/components/player/player-placements';
import { PlayerRanked } from '@/components/player/player-ranked';
import { getOfficialBrawlers, getPlayer, getPlayerRankings } from '@/lib/bs-api';
import { getBrawlerMap } from '@/lib/brawlapi';
import { computeProgression, estimatePlaytime } from '@/lib/progression';
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

  return (
    <div className="space-y-8">
      <RecentSearchRecorder
        kind="player"
        tag={normalizedTag}
        name={player.name}
      />
      <PlayerHeader
        player={player}
        lastOnline={
          <Suspense fallback={null}>
            <LastOnline tag={tag} />
          </Suspense>
        }
      />
      <PlayerPlacements
        placements={placements}
        iconFor={(id) => brawlerMeta.get(id)?.imageUrl}
      />
      <PlayerStats player={player} />
      <Suspense fallback={<PlayerRanked player={player} standing={standing} />}>
        <RankedWithBoard player={player} standing={standing} tag={normalizedTag} />
      </Suspense>
      <PlayerRecords player={player} />
      <PlayerTrophyHistory points={trophyHistory} />
      <PlayerProgression progression={progression} playtime={playtime} />

      <PlayerMetaFit
        brawlers={player.brawlers}
        meta={metaIndex}
        brawlerMeta={brawlerMeta}
      />

      <Suspense fallback={<InsightsSkeleton />}>
        <PlayerInsights tag={tag} playerTag={player.tag} brawlerMeta={brawlerMeta} />
      </Suspense>

      <section>
        <SectionHeading title="Recent battles" />
        <Suspense fallback={<BattleLogSkeleton />}>
          <BattleLog tag={tag} playerTag={player.tag} brawlerMeta={brawlerMeta} />
        </Suspense>
      </section>

      <section>
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
