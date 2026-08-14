import { Suspense } from 'react';
import type { Metadata } from 'next';
import { after } from 'next/server';

import { BattleLog } from '@/components/player/battle-log';
import { PlayerBrawlers } from '@/components/player/player-brawlers';
import { PlayerHeader } from '@/components/player/player-header';
import { PlayerStats } from '@/components/player/player-stats';
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
  getPlayerBrawlerPlacements,
  getReleasedBuffieCount,
  getTrophyPercentile,
  recordLookup,
} from '@/lib/stats';
import { displayTag, normalizeTag } from '@/lib/tags';

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
  after(() => recordLookup(normalizeTag(player.tag), player.name, player.trophies));

  // Artwork metadata is a separate, keyless source. If it is unavailable the
  // page still renders — brawler cards just fall back to CDN-pattern URLs.
  // The official catalogue supplies the per-brawler totals that progression
  // needs (gears and hypercharges are not in the brawlapi payload).
  const normalizedTag = normalizeTag(player.tag);

  const [brawlerMeta, catalogue, globalRank] = await Promise.all([
    getBrawlerMap().catch(() => new Map()),
    getOfficialBrawlers()
      .then((r) => r.items)
      .catch(() => []),
    // The global board only goes 200 deep, so most players are simply absent.
    getPlayerRankings('global', 200)
      .then((r) => r.items.find((p) => normalizeTag(p.tag) === normalizedTag)?.rank ?? null)
      .catch(() => null),
  ]);

  // Database reads run one at a time so the page never needs more than one
  // connection, and each degrades to null/empty on its own.
  const placements = await getPlayerBrawlerPlacements(normalizedTag);
  const standing = await getTrophyPercentile(player.trophies);
  const releasedBuffies = await getReleasedBuffieCount();

  const progression = computeProgression(player, catalogue, releasedBuffies);
  const playtime = estimatePlaytime(player);

  return (
    <div className="space-y-8">
      <RecentSearchRecorder
        kind="player"
        tag={normalizedTag}
        name={player.name}
      />
      <PlayerHeader player={player} />
      <PlayerPlacements
        placements={placements}
        iconFor={(id) => brawlerMeta.get(id)?.imageUrl}
      />
      <PlayerStats player={player} />
      <PlayerRanked player={player} globalRank={globalRank} standing={standing} />

      <Suspense fallback={<InsightsSkeleton />}>
        <PlayerInsights tag={tag} playerTag={player.tag} brawlerMeta={brawlerMeta} />
      </Suspense>
      <PlayerProgression progression={progression} playtime={playtime} />

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
              { imageUrl: b.imageUrl, rarityColor: b.rarity.color, rarityName: b.rarity.name },
            ]),
          )}
        />
      </section>
    </div>
  );
}
