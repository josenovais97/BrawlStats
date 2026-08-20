import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

import { LeaderboardIcon, TrophyIcon } from '@/components/game-icons';
import { TopPlayersPreview } from '@/components/home/top-players-preview';
import { Skeleton } from '@/components/ui/skeletons';
import { formatPercent } from '@/lib/format';
import { getTopMetaBrawlers } from '@/lib/home-meta';
import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/tiers';

/**
 * One look at what is happening right now.
 *
 * Two five-row tables side by side is what this used to be, and the shape said
 * the two halves were equally important. They are not: which brawler is on top
 * changes how you play tonight, and who holds the world trophy record does
 * not. So the meta gets a featured brawler, real numbers and the width; the
 * leaderboard gets three rows in a narrower column beside it.
 *
 * The ranking is the same cached query the account preview and the tools
 * section read, so the extra prominence costs nothing upstream.
 */
export async function HomeSnapshot() {
  const top = await getTopMetaBrawlers(4).catch(() => []);
  const [leader, ...rest] = top;

  return (
    <section className="reveal min-w-0" aria-labelledby="snapshot">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-victory">
            <span className="live-dot" />
            Live snapshot
          </p>
          <h2 id="snapshot" className="display mt-2.5 text-2xl uppercase sm:text-3xl">
            Where things stand
          </h2>
        </div>
        <p className="max-w-md text-sm text-muted">
          From our own sampled battles, not from votes.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0">
          {leader ? (
            <>
              {/* The one brawler most worth knowing about, at a size that says
                  so. Every figure here is measured. */}
              <Link
                href={brawlerPath(leader.brawlerId, leader.name)}
                className="card card-glow card-interactive relative flex items-center gap-4 overflow-hidden p-4 sm:gap-5 sm:p-5"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: `radial-gradient(110% 90% at 0% 0%, color-mix(in srgb, ${TIER_COLOR[leader.tier]} 18%, transparent), transparent 60%)`,
                  }}
                />
                <Image
                  src={leader.imageUrl}
                  alt=""
                  width={96}
                  height={96}
                  className="relative size-16 shrink-0 rounded-2xl sm:size-24"
                  loading="lazy"
                  unoptimized
                />
                <div className="relative min-w-0 flex-1">
                  <p className="eyebrow">Top of the meta</p>
                  <p className="display mt-1.5 truncate text-2xl capitalize leading-none sm:text-3xl">
                    {leader.name.toLowerCase()}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span
                      className="rounded-lg px-2 py-0.5 text-xs font-black"
                      style={{
                        background: `color-mix(in srgb, ${TIER_COLOR[leader.tier]} 18%, transparent)`,
                        color: TIER_COLOR[leader.tier],
                      }}
                    >
                      {leader.tier} tier
                    </span>
                    {leader.winRate !== null ? (
                      <span className="tabular-nums text-muted">
                        <strong className="font-bold text-victory">
                          {formatPercent(leader.winRate)}
                        </strong>{' '}
                        win
                      </span>
                    ) : null}
                    {leader.pickRate !== null ? (
                      <span className="tabular-nums text-muted">
                        <strong className="font-bold text-foreground">
                          {formatPercent(leader.pickRate)}
                        </strong>{' '}
                        pick
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="relative hidden shrink-0 text-right sm:block">
                  <p
                    className="display text-4xl leading-none tabular-nums"
                    style={{ color: TIER_COLOR[leader.tier] }}
                  >
                    {leader.score.toFixed(1)}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted">
                    Meta score
                  </p>
                </div>
              </Link>

              {/* The chasing pack, deliberately slight. */}
              <ol className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {rest.map((brawler, index) => (
                  <li key={brawler.brawlerId}>
                    <Link
                      href={brawlerPath(brawler.brawlerId, brawler.name)}
                      className="row-interactive flex items-center gap-3 bg-surface px-3 py-2"
                    >
                      <span className="w-4 shrink-0 text-center text-xs font-black tabular-nums text-muted">
                        {index + 2}
                      </span>
                      <Image
                        src={brawler.imageUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 shrink-0 rounded-lg"
                        loading="lazy"
                        unoptimized
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold capitalize">
                        {brawler.name.toLowerCase()}
                      </span>
                      <span
                        className="shrink-0 text-sm font-bold tabular-nums"
                        style={{ color: TIER_COLOR[brawler.tier] }}
                      >
                        {brawler.score.toFixed(1)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="card p-6 text-sm text-muted">
              Rankings are still being collected. Check back shortly.
            </p>
          )}

          <Link
            href="/tier-list/ranked"
            className="group mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand"
          >
            Full Ranked tier list
            <ArrowRight className="size-4 duration-200 group-hover:translate-x-0.5 motion-safe:transition-transform" />
          </Link>
        </div>

        {/* Supporting, not mirroring: three rows, no podium chips, no scores. */}
        <div className="min-w-0">
          <p className="mb-2.5 flex items-center gap-2 text-sm font-bold">
            <LeaderboardIcon className="size-5" />
            Top players
            <TrophyIcon className="ml-auto size-4" />
          </p>
          <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
            <TopPlayersPreview limit={3} />
          </Suspense>
          <Link
            href="/leaderboard"
            className="group mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand"
          >
            Full leaderboard
            <ArrowRight className="size-4 duration-200 group-hover:translate-x-0.5 motion-safe:transition-transform" />
          </Link>
          <p className="mt-2 text-xs leading-relaxed text-muted/80">
            Three of the top 200 worldwide. Our Ranked elo board, which the game API
            does not publish, is on the full leaderboard.
          </p>
        </div>
      </div>
    </section>
  );
}
