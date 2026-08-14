import { Suspense } from 'react';
import type { Metadata } from 'next';
import { after } from 'next/server';

import { BattleLog } from '@/components/player/battle-log';
import { PlayerBrawlers } from '@/components/player/player-brawlers';
import { PlayerHeader } from '@/components/player/player-header';
import { PlayerStats } from '@/components/player/player-stats';
import { ErrorState } from '@/components/ui/error-state';
import { BattleLogSkeleton } from '@/components/ui/skeletons';
import { PlayerProgression } from '@/components/player/player-progression';
import { RecentSearchRecorder } from '@/components/recent-search-recorder';
import { getOfficialBrawlers, getPlayer } from '@/lib/bs-api';
import { getBrawlerMap } from '@/lib/brawlapi';
import { computeProgression } from '@/lib/progression';
import { toApiError } from '@/lib/errors';
import { recordLookup } from '@/lib/stats';
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
  const [brawlerMeta, catalogue] = await Promise.all([
    getBrawlerMap().catch(() => new Map()),
    getOfficialBrawlers()
      .then((r) => r.items)
      .catch(() => []),
  ]);

  const progression = computeProgression(player, catalogue);

  return (
    <div className="space-y-8">
      <RecentSearchRecorder
        kind="player"
        tag={normalizeTag(player.tag)}
        name={player.name}
      />
      <PlayerHeader player={player} />
      <PlayerStats player={player} />
      <PlayerProgression progression={progression} />

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Recent battles</h2>
        <Suspense fallback={<BattleLogSkeleton />}>
          <BattleLog tag={tag} playerTag={player.tag} brawlerMeta={brawlerMeta} />
        </Suspense>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Brawlers</h2>
          <p className="text-sm text-muted">
            {player.brawlers.length} unlocked
          </p>
        </div>
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
