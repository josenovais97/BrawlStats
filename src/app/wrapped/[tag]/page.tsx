import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { WrappedCard } from '@/components/player/wrapped-card';
import { PageHeading } from '@/components/ui/section-heading';

import { getGameModeMap } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { computeBattleInsights } from '@/lib/battle-insights';
import { getBattleLog, getPlayer } from '@/lib/bs-api';
import { displayTag, normalizeTag } from '@/lib/tags';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';

interface PageProps {
  params: Promise<{ tag: string }>;
}

/**
 * A shareable summary of a player's recent run.
 *
 * Scoped to the battle log — the last twenty-five games — and says so, because
 * that is the honest unit. A "week in review" would be the obvious framing and
 * we cannot back it: the game API has no history endpoint, so the only per-day
 * record this site holds is the trophy count captured when someone happens to
 * open a profile. For a player nobody looks up, a weekly total would be
 * invented.
 *
 * What the log does support is real and specific: how the last twenty-five went,
 * which brawler carried them, which mode paid. That is enough for a card worth
 * screenshotting, and every number on it is measured.
 *
 * `noindex` for the same reason as `/player`: one URL per tag in existence,
 * none of them enumerable, each costing an upstream call to render.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  return {
    title: `${displayTag(tag)} — recent run`,
    description: 'A shareable summary of a Brawl Stars player’s last twenty-five battles.',
    robots: { index: false, follow: true },
  };
}

export default async function WrappedPage({ params }: PageProps) {
  const { tag } = await params;

  const player = await getPlayer(tag).catch(() => null);
  if (!player) notFound();

  const [log, brawlerMeta, modeMeta] = await Promise.all([
    getBattleLog(tag)
      .then((r) => r.items)
      .catch(() => []),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
  ]);

  const insights = computeBattleInsights(log, player.tag);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={
          <Link
            href={`/player/${normalizeTag(player.tag)}`}
            className="transition-colors hover:text-foreground"
          >
            {player.name}
          </Link>
        }
        title="Recent run"
        subtitle="The last twenty-five battles, summed up. Built to screenshot."
      />

      <WrappedCard
        player={player}
        insights={insights}
        brawlerMeta={brawlerMeta}
        modeMeta={modeMeta}
      />

      <p className="text-xs leading-relaxed text-muted">
        Everything here is measured from the battle log the game exposes, which holds roughly the
        last twenty-five games and no further. There is no history endpoint, so this is a snapshot
        of a run rather than a season — open it again after playing and it will have moved.
      </p>
    </div>
  );
}
