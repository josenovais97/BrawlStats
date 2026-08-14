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
      <section className="card card-glow relative overflow-hidden p-6 sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full opacity-[0.14] blur-3xl"
          style={{ background: 'radial-gradient(circle, #ffc53d, transparent 65%)' }}
        />

        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand">
            Brawl Zone
          </span>
          <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Every stat,
            <br />
            <span className="bg-gradient-to-r from-brand via-brand-strong to-accent bg-clip-text text-transparent">
              one search away.
            </span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Trophies, progression, world rankings, recent form and club rosters — pulled
            live from the official Brawl Stars API.
          </p>
        </div>

        <div className="relative mt-8 max-w-2xl">
          <SearchBar autoFocus showRecent />
        </div>
      </section>

      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ href, icon: Icon, title, body }) => (
            <Link
              key={href}
              href={href}
              className="card card-interactive group p-5"
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
