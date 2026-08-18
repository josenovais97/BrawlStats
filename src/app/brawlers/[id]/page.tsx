import type { Metadata } from 'next';
import { ArrowLeft, BarChart3, Sparkles, Trophy, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

import { BrawlerLeaderboard } from '@/components/brawlers/brawler-leaderboard';
import { PopularBuild } from '@/components/brawlers/popular-build';
import { ErrorState } from '@/components/ui/error-state';
import { StatCard } from '@/components/ui/stat-card';
import { TableSkeleton } from '@/components/ui/skeletons';
import { GadgetIcon, StarPowerIcon } from '@/components/game-icons';
import { getBrawler } from '@/lib/brawlapi';
import { formatNumber, formatPercent } from '@/lib/format';
import { getOfficialBrawlers } from '@/lib/bs-api';
import {
  MIN_SAMPLE_FOR_TIER,
  TIER_COLOR,
  assignTier,
  getBrawlerBuild,
  getBrawlerStat,
  normalizeWinRate,
} from '@/lib/stats';
import type { BAAccessory } from '@/types/brawlapi';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Rendered on demand and cached for a day, rather than pre-rendering all ~90
 * brawlers at build time — each page makes a ranking call, and doing that once
 * per brawler during a build risks tripping the API rate limit.
 */
export const revalidate = 86400;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const brawler = await getBrawler(Number(id)).catch(() => undefined);
  if (!brawler) return { title: 'Brawler' };

  return {
    // The brawler's name alone loses to every wiki and fan site. People search
    // "shelly brawl stars", so the title carries both.
    title: `${brawler.name} — Brawl Stars stats and build`,
    description: brawler.description,
    alternates: { canonical: `/brawlers/${id}` },
  };
}

export default async function BrawlerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const brawlerId = Number(id);

  if (!Number.isFinite(brawlerId)) {
    return (
      <ErrorState
        code="notFound"
        title="Unknown brawler"
        detail="That brawler id is not valid."
        backHref="/brawlers"
        backLabel="Back to brawlers"
      />
    );
  }

  const brawler = await getBrawler(brawlerId).catch(() => undefined);

  if (!brawler) {
    return (
      <ErrorState
        code="notFound"
        title="Brawler not found"
        detail="No brawler exists with that id."
        backHref="/brawlers"
        backLabel="Back to brawlers"
      />
    );
  }

  // Sequential database reads keep the page to a single connection.
  const stat = await getBrawlerStat(brawlerId);
  const build = await getBrawlerBuild(brawlerId);

  // Gear names live only in the official catalogue, not in the artwork source.
  const gearNames = await getOfficialBrawlers()
    .then((r) => {
      const entry = r.items.find((b) => b.id === brawlerId);
      return new Map((entry?.gears ?? []).map((g) => [g.id, g.name]));
    })
    .catch(() => new Map<number, string>());
  const normalizedWinRate = stat
    ? normalizeWinRate(stat.winRate, stat.baselineWinRate, stat.decidedSampleSize)
    : null;
  const tier =
    stat && stat.decidedSampleSize >= MIN_SAMPLE_FOR_TIER
      ? assignTier(normalizedWinRate)
      : null;
  const accent = brawler.rarity?.color ?? '#8b95b8';

  return (
    <div className="space-y-8">
      <Link
        href="/brawlers"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All brawlers
      </Link>

      <header className="card card-glow overflow-hidden">
        <span className="block h-1 w-full" style={{ background: accent }} />
        <div className="flex flex-wrap items-center gap-6 p-6">
          <Image
            src={brawler.imageUrl}
            alt={brawler.name}
            width={144}
            height={144}
            className="size-32 shrink-0 object-contain sm:size-36"
            priority
            unoptimized
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
                style={{
                  background: `color-mix(in srgb, ${accent} 20%, transparent)`,
                  color: accent,
                }}
              >
                {brawler.rarity?.name ?? 'Unknown'}
              </span>
              <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
                {brawler.class?.name ?? 'Unknown'}
              </span>
              {tier ? (
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: `color-mix(in srgb, ${TIER_COLOR[tier]} 20%, transparent)`,
                    color: TIER_COLOR[tier],
                  }}
                >
                  {tier} tier
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-4xl font-black capitalize tracking-tight">
              {brawler.name.toLowerCase()}
            </h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted">
              {brawler.description}
            </p>
          </div>
        </div>
      </header>

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Performance</h2>
        {stat ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={BarChart3}
              label="Win rate"
              value={formatPercent(normalizedWinRate)}
              hint={`${formatNumber(stat.decidedSampleSize)} battles`}
              tone="text-victory"
            />
            <StatCard
              icon={Users}
              label="Pick rate"
              value={formatPercent(stat.usageRate)}
              hint="Last 7 days"
              tone="text-accent"
            />
            <StatCard
              icon={Trophy}
              label="Avg trophies"
              value={
                stat.avgTrophies === null ? '—' : formatNumber(Math.round(stat.avgTrophies))
              }
              hint="Across tracked players"
            />
            <StatCard
              icon={Sparkles}
              label="Avg rank"
              value={stat.avgRank === null ? '—' : stat.avgRank.toFixed(1)}
              hint="Across tracked players"
            />
          </div>
        ) : (
          <p className="card p-6 text-sm text-muted">
            Not enough data for this brawler yet.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Popular build</h2>
        <PopularBuild build={build} meta={brawler} gearNames={gearNames} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <AccessoryList
          title="Star powers"
          node={<StarPowerIcon className="size-5" />}
          items={brawler.starPowers}
          emptyLabel="No star powers released."
        />
        <AccessoryList
          title="Gadgets"
          node={<GadgetIcon className="size-5" />}
          items={brawler.gadgets}
          emptyLabel="No gadgets released."
        />
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">
          Top players with {brawler.name.toLowerCase()}
        </h2>
        <Suspense fallback={<TableSkeleton rows={5} />}>
          <BrawlerLeaderboard brawlerId={brawlerId} />
        </Suspense>
      </section>
    </div>
  );
}

function AccessoryList({
  title,
  node,
  items,
  emptyLabel,
}: {
  title: string;
  node: React.ReactNode;
  items: BAAccessory[];
  emptyLabel: string;
}) {
  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-2xl font-bold tracking-tight">
        {node}
        {title}
      </h2>

      {items.length === 0 ? (
        <p className="card p-6 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="card flex gap-4 p-4">
              <Image
                src={item.imageUrl}
                alt=""
                width={48}
                height={48}
                className="size-12 shrink-0 object-contain"
                unoptimized
              />
              <div className="min-w-0">
                <p className="font-bold capitalize">{item.name.toLowerCase()}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {/* Descriptions carry inline markup tokens; the plain text field is safe to render as-is. */}
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
