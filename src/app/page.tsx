import { ArrowRight, CalendarClock, Newspaper, Podium, Swords, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { HomeCoverage } from '@/components/home/home-coverage';
import { HomeHero } from '@/components/home/home-hero';
import { HomeLiveEvents } from '@/components/home/home-live-events';
import { HomeTopBrawlers } from '@/components/home/home-top-brawlers';
import { FavoritesList } from '@/components/favorites-list';
import { TopPlayersPreview } from '@/components/home/top-players-preview';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton, TableSkeleton } from '@/components/ui/skeletons';

/**
 * Each shortcut carries its own accent so the row reads as four distinct
 * destinations rather than four identical grey boxes.
 */
const SHORTCUTS = [
  {
    href: '/brawlers',
    icon: Swords,
    title: 'Brawlers',
    body: 'Stats, star powers, gadgets and popular builds.',
    accent: '#ffc53d',
  },
  {
    href: '/tier-list',
    icon: Podium,
    title: 'Tier list',
    body: 'Win and pick rates, refreshed daily.',
    accent: '#ff5c72',
  },
  {
    href: '/release-notes',
    icon: Newspaper,
    title: 'Release notes',
    body: 'The latest official update, in full.',
    accent: '#8b6bff',
  },
  {
    href: '/events',
    icon: CalendarClock,
    title: 'Events',
    body: 'Live and upcoming maps across every slot.',
    accent: '#35d0ff',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-14">
      <HomeHero />

      <FavoritesList />

      <Suspense fallback={<Skeleton className="h-[6.5rem] rounded-2xl" />}>
        <HomeCoverage />
      </Suspense>

      {/* What you get */}
      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SHORTCUTS.map(({ href, icon: Icon, title, body, accent }) => (
            <Link
              key={href}
              href={href}
              className="card card-interactive group relative overflow-hidden p-5"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: accent }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
                style={{ background: accent }}
              />

              <span
                className="relative grid size-12 place-items-center rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${accent} 18%, transparent)`,
                  color: accent,
                }}
              >
                <Icon className="size-6" />
              </span>

              <h2 className="display relative mt-4 text-lg">{title}</h2>
              <p className="relative mt-1 text-sm leading-relaxed text-muted">{body}</p>
              <span
                className="relative mt-3 inline-flex items-center gap-1 text-sm font-semibold opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: accent }}
              >
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
          <h2 className="display mt-4 text-3xl uppercase sm:text-4xl">
            Find your tag, track your climb
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Your tag is on your in-game profile, just below your name.
          </p>
          <Link
            href="/#search"
            className="btn-game mt-7 inline-flex items-center gap-2 bg-brand px-7 py-3.5 text-lg uppercase text-[#1a1200] hover:bg-brand-strong"
          >
            Search a player
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
