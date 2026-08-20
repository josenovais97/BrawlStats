import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import {
  BrawlersIcon,
  CompareIcon,
  DraftIcon,
  LeaderboardIcon,
  MapsIcon,
  TierListIcon,
} from '@/components/game-icons';

/**
 * The tools, as a toolbar rather than as six more cards.
 *
 * This replaced a row of six full "why BrawlZone" cards that between them took
 * most of a phone screen to say what six links say. Navigation the visitor has
 * not asked for yet does not need a paragraph each: it needs to be findable
 * and out of the way, so the live data below it gets the space instead.
 *
 * One panel with hairline cells, not six separate cards — otherwise every
 * section on this page is the same grid of tiles and nothing has a hierarchy.
 * The hairlines are a 1px grid gap over a border-coloured background, which
 * costs no extra borders to reconcile at three breakpoints.
 */
const TOOLS = [
  {
    href: '/tier-list/ranked',
    icon: TierListIcon,
    title: 'Tier lists',
    body: 'Ranked and trophy, scored apart',
    accent: '#ff5c72',
  },
  {
    href: '/draft',
    icon: DraftIcon,
    title: 'Draft helper',
    body: 'Counter what the enemy took',
    accent: '#35d07f',
  },
  {
    href: '/maps',
    icon: MapsIcon,
    title: 'Maps',
    body: 'Best picks map by map',
    accent: '#ffab00',
  },
  {
    href: '/compare',
    icon: CompareIcon,
    title: 'Compare',
    body: 'Two players, side by side',
    accent: '#35d0ff',
  },
  {
    href: '/leaderboard',
    icon: LeaderboardIcon,
    title: 'Leaderboards',
    body: 'Trophies, and our Ranked elo',
    accent: '#8b6bff',
  },
  {
    href: '/brawlers',
    icon: BrawlersIcon,
    title: 'Brawlers',
    body: 'Stats, builds and matchups',
    accent: '#ffc53d',
  },
];

export function HomeTools() {
  return (
    <section className="reveal" aria-labelledby="tools">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="tools" className="display text-2xl uppercase">
          Tools
        </h2>
        <p className="text-sm text-muted">
          Everything here runs on our own sampled battles.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        {TOOLS.map(({ href, icon: Icon, title, body, accent }) => (
          <li key={href} className="bg-surface">
            <Link
              href={href}
              className="group flex h-full flex-col gap-2 p-3 transition-colors hover:bg-surface-2 sm:gap-2.5 sm:p-4"
            >
              <span
                className="grid size-9 place-items-center rounded-lg"
                style={{
                  background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                  color: accent,
                }}
              >
                <Icon className="size-4.5" />
              </span>
              <span className="min-w-0">
                {/* The arrow is held back until there is room for it: at 320px
                    a two-column cell has about 120px of text, and "Leaderboards"
                    plus a chevron does not fit in it. */}
                <span className="flex min-w-0 items-center gap-1 text-sm font-bold leading-tight sm:text-base">
                  <span className="truncate">{title}</span>
                  <ArrowRight
                    aria-hidden
                    className="hidden size-3.5 shrink-0 text-muted duration-200 group-hover:translate-x-0.5 motion-safe:transition-transform sm:block"
                  />
                </span>
                <span className="mt-1 block text-xs leading-snug text-muted">
                  {body}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
