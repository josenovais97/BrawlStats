import { CalendarClock, Crown, Swords, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { SearchBar } from '@/components/search-bar';
import { TopPlayersPreview } from '@/components/home/top-players-preview';
import { TableSkeleton } from '@/components/ui/skeletons';

const FEATURES = [
  {
    href: '/brawlers',
    icon: Swords,
    title: 'Brawler database',
    body: 'Every brawler with stats, star powers, gadgets and rarity.',
  },
  {
    href: '/tier-list',
    icon: Crown,
    title: 'Tier list',
    body: 'Aggregated win and usage rates from daily snapshots.',
  },
  {
    href: '/events',
    icon: CalendarClock,
    title: 'Event rotation',
    body: 'Live and upcoming maps across every game mode slot.',
  },
  {
    href: '/leaderboard',
    icon: Trophy,
    title: 'Leaderboards',
    body: 'Top players and clubs by trophies, filterable by region.',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="card card-glow overflow-hidden p-6 sm:p-10">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand">
            Brawl Stars stats
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Look up any player or club.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Trophies, brawler progression, battle history and club rosters — pulled live
            from the official Brawl Stars API.
          </p>
        </div>

        <div className="mt-8 max-w-2xl">
          <SearchBar autoFocus />
        </div>
      </section>

      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ href, icon: Icon, title, body }) => (
            <Link
              key={href}
              href={href}
              className="card group p-5 transition-colors hover:border-brand/40"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-surface-2 text-brand transition-colors group-hover:bg-brand group-hover:text-[#1a1200]">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 font-bold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Top players worldwide</h2>
            <p className="mt-1 text-sm text-muted">Global trophy leaderboard.</p>
          </div>
          <Link
            href="/leaderboard"
            className="shrink-0 text-sm font-medium text-brand hover:underline"
          >
            View all
          </Link>
        </div>

        <Suspense fallback={<TableSkeleton rows={5} />}>
          <TopPlayersPreview />
        </Suspense>
      </section>
    </div>
  );
}
