import { ArrowRight, CalendarClock, Newspaper, Podium, Swords, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { HomeLiveEvents } from '@/components/home/home-live-events';
import { HomeTopBrawlers } from '@/components/home/home-top-brawlers';
import { FavoritesList } from '@/components/favorites-list';
import { SearchBar } from '@/components/search-bar';
import { TopPlayersPreview } from '@/components/home/top-players-preview';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton, TableSkeleton } from '@/components/ui/skeletons';

const SHORTCUTS = [
  {
    href: '/brawlers',
    icon: Swords,
    title: 'Brawler database',
    body: 'Stats, star powers, gadgets and popular builds.',
  },
  {
    href: '/tier-list',
    icon: Podium,
    title: 'Tier list',
    body: 'Win and pick rates, refreshed daily.',
  },
  {
    href: '/release-notes',
    icon: Newspaper,
    title: 'Release notes',
    body: 'The latest official update, in full.',
  },
  {
    href: '/events',
    icon: CalendarClock,
    title: 'Events',
    body: 'Live and upcoming maps across every slot.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden px-4 pb-2 pt-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(46rem 22rem at 20% 0%, color-mix(in srgb, #8b6bff 22%, transparent), transparent 70%), radial-gradient(38rem 20rem at 85% 10%, color-mix(in srgb, #ffc53d 14%, transparent), transparent 70%)',
          }}
        />

        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand backdrop-blur">
            <span className="size-1.5 rounded-full bg-victory" />
            Live Brawl Stars data
          </span>

          <h1 className="mt-6 text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Know exactly where
            <br />
            <span className="bg-gradient-to-r from-brand via-brand-strong to-accent bg-clip-text text-transparent">
              you stand.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-balance text-lg leading-relaxed text-muted">
            Trophies, world rankings, recent form and full progression — for any player
            or club, in one search.
          </p>
        </div>

        <div className="mx-auto mt-9 max-w-2xl">
          <div className="card card-glow p-4 sm:p-5">
            <SearchBar autoFocus showRecent />
          </div>
        </div>
      </section>

      <FavoritesList />

      {/* What you get */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map(({ href, icon: Icon, title, body }) => (
            <Link key={href} href={href} className="card card-interactive group p-5">
              <span className="grid size-11 place-items-center rounded-xl bg-surface-2 text-brand transition-colors group-hover:bg-brand group-hover:text-[#1a1200]">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 font-bold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                Open
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Live now */}
      <section>
        <SectionHeading
          title="Live now"
          subtitle="Maps currently in rotation."
          aside={
            <Link href="/events" className="font-medium text-brand hover:underline">
              All events
            </Link>
          }
        />
        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-40 rounded-2xl" />
              ))}
            </div>
          }
        >
          <HomeLiveEvents />
        </Suspense>
      </section>

      {/* Meta + leaderboard, side by side */}
      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeading
            title="Top of the meta"
            subtitle="Highest win rates right now."
            aside={
              <Link href="/tier-list" className="font-medium text-brand hover:underline">
                Tier list
              </Link>
            }
          />
          <Suspense fallback={<TableSkeleton rows={5} />}>
            <HomeTopBrawlers />
          </Suspense>
        </div>

        <div>
          <SectionHeading
            title="Top players"
            subtitle="Global trophy leaderboard."
            aside={
              <Link href="/leaderboard" className="font-medium text-brand hover:underline">
                Full board
              </Link>
            }
          />
          <Suspense fallback={<TableSkeleton rows={5} />}>
            <TopPlayersPreview />
          </Suspense>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="card card-glow relative overflow-hidden p-8 text-center sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            background:
              'radial-gradient(30rem 14rem at 50% 0%, #ffc53d, transparent 70%)',
          }}
        />
        <div className="relative">
          <Trophy className="mx-auto size-8 text-brand" />
          <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
            Find your tag, track your climb.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Your tag is on your in-game profile, just below your name.
          </p>
          <Link
            href="/#search"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-bold text-[#1a1200] transition-colors hover:bg-brand-strong"
          >
            Search a player
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
