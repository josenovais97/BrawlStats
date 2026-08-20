import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { HomeTopBrawlers } from '@/components/home/home-top-brawlers';
import { TopPlayersPreview } from '@/components/home/top-players-preview';
import { LeaderboardIcon, TierListIcon } from '@/components/game-icons';
import { RankedListSkeleton } from '@/components/ui/skeletons';

/**
 * The meta and the leaderboard, as one look at what is happening right now.
 *
 * They were two full sections with two headings, two eyebrows and two blocks
 * of explanation, which is twice the furniture for what a visitor reads as a
 * single glance: who is strong, and who is on top. One heading now, two
 * panels under it, and the prose that used to sit above each list has moved to
 * one line per panel.
 *
 * No new data: both children are the same server components the two sections
 * rendered before, so this costs nothing extra to load.
 */
export function HomeSnapshot() {
  return (
    <section className="reveal min-w-0" aria-labelledby="snapshot">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-victory">
            <span className="live-dot" />
            Updated through the day
          </p>
          <h2 id="snapshot" className="display mt-2.5 text-2xl uppercase sm:text-3xl">
            Where things stand
          </h2>
        </div>
        <p className="max-w-md text-sm text-muted">
          Both from our own sampled battles, not from votes.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          icon={<TierListIcon className="size-5" />}
          title="Top of the meta"
          detail="Highest adjusted win rates in competitive Ranked."
          href="/tier-list/ranked"
          cta="Full tier list"
        >
          <Suspense fallback={<RankedListSkeleton />}>
            <HomeTopBrawlers />
          </Suspense>
        </Panel>

        <Panel
          icon={<LeaderboardIcon className="size-5" />}
          title="Top players"
          detail="The highest trophy counts in the world."
          href="/leaderboard"
          cta="Full leaderboard"
        >
          <Suspense fallback={<RankedListSkeleton />}>
            <TopPlayersPreview />
          </Suspense>
        </Panel>
      </div>
    </section>
  );
}

/** One half of the snapshot: a titled header, the list, and a way out. */
function Panel({
  icon,
  title,
  detail,
  href,
  cta,
  children,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  href: string;
  cta: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="display text-lg uppercase leading-none">{title}</h3>
          <p className="mt-1 truncate text-xs text-muted">{detail}</p>
        </div>
      </div>

      {children}

      <Link
        href={href}
        className="group mt-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand"
      >
        {cta}
        <ArrowRight className="size-4 duration-200 group-hover:translate-x-0.5 motion-safe:transition-transform" />
      </Link>
    </div>
  );
}
