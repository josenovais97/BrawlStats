import { ArrowRight, CalendarClock, Map, Medal, Podium, Target, User } from 'lucide-react';
import Link from 'next/link';

/**
 * What the site is for, stated once, near the top.
 *
 * Each card carries its own accent so the row reads as four distinct
 * destinations rather than four identical grey boxes, but the accent is
 * confined to the icon and the hover edge — a fully tinted card would turn
 * this strip into the loudest thing on the page.
 *
 * The copy names what is *different* here rather than the category. Every
 * Brawl Stars site has player stats, a tier list, events and a leaderboard, so
 * a row of category names tells a first-time visitor nothing about whether to
 * stay. Each line below points at something this site has that the game API
 * does not hand out for free.
 */
const PROPS = [
  {
    href: '/#search',
    icon: User,
    title: 'Player stats',
    body: 'Skill score out of 10, your roster read against the meta, and trophy history over time.',
    accent: '#ffc53d',
  },
  {
    href: '/tier-list/ranked',
    icon: Podium,
    title: 'Two tier lists',
    body: 'Ranked and trophy ladder scored separately — they are different games, and the answers differ.',
    accent: '#ff5c72',
  },
  {
    href: '/leaderboard?type=ranked',
    icon: Medal,
    title: 'Ranked elo board',
    body: 'The game publishes no Ranked leaderboard. This one is built from our own daily samples.',
    accent: '#8b6bff',
  },
  {
    href: '/events',
    icon: CalendarClock,
    title: 'Live events',
    body: 'What is in rotation right now, with the best brawlers for each map in the Ranked pool.',
    accent: '#35d0ff',
  },
  {
    href: '/draft',
    icon: Target,
    title: 'Draft helper',
    body: 'Pick the map, name what the enemy took, and the list reorders around both.',
    accent: '#35d07f',
  },
  {
    href: '/maps',
    icon: Map,
    title: 'Every map',
    body: 'Live events, the Ranked pool and the full catalogue — each map ranking the brawlers that win on it.',
    accent: '#ffab00',
  },
];

export function HomeValueProps() {
  return (
    <section className="reveal" aria-labelledby="what-you-get">
      <div className="max-w-2xl">
        <p className="eyebrow">Why BrawlZone</p>
        <h2 id="what-you-get" className="display mt-2.5 text-2xl uppercase sm:text-3xl">
          Stats the game does not give you
        </h2>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {PROPS.map(({ href, icon: Icon, title, body, accent }) => (
          <li key={title}>
            {/*
              A row on a phone and a tile from `sm` up. Six stacked tiles is
              more than a phone screen spent on navigation the visitor has not
              asked for yet; six rows is a glanceable list.
            */}
            <Link
              href={href}
              className="card card-interactive group relative flex h-full items-center gap-4 overflow-hidden p-4 sm:flex-col sm:items-stretch sm:gap-0 sm:p-5"
              style={{ '--vp-accent': accent } as React.CSSProperties}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-200 group-hover:opacity-30"
                style={{ background: accent }}
              />

              <span
                className="relative grid size-11 shrink-0 place-items-center rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                  color: accent,
                }}
              >
                <Icon className="size-5" />
              </span>

              <span className="relative min-w-0 flex-1 sm:mt-4 sm:flex sm:flex-col">
                <h3 className="display text-lg leading-tight">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted sm:flex-1">
                  {body}
                </p>

                <span
                  aria-hidden
                  className="mt-4 hidden items-center gap-1.5 text-sm font-semibold text-muted transition-colors group-hover:text-[color:var(--vp-accent)] sm:inline-flex"
                >
                  Open
                  <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </span>

              <ArrowRight
                aria-hidden
                className="relative size-4 shrink-0 text-muted transition-colors group-hover:text-[color:var(--vp-accent)] sm:hidden"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
