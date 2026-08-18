import { ArrowRight, CalendarClock, Podium, Trophy, User } from 'lucide-react';
import Link from 'next/link';

/**
 * The four things the site is for, stated once, near the top.
 *
 * Each card carries its own accent so the row reads as four distinct
 * destinations rather than four identical grey boxes, but the accent is
 * confined to the icon and the hover edge — a fully tinted card would turn
 * this strip into the loudest thing on the page.
 */
const PROPS = [
  {
    href: '/#search',
    icon: User,
    title: 'Player stats',
    body: 'Trophies, rankings, progression and recent form for any tag.',
    accent: '#ffc53d',
  },
  {
    href: '/tier-list/ranked',
    icon: Podium,
    title: 'Brawler meta',
    body: 'Win rates, pick rates, tier rankings and the builds people run.',
    accent: '#ff5c72',
  },
  {
    href: '/events',
    icon: CalendarClock,
    title: 'Live events',
    body: 'What is in rotation right now, and what comes next.',
    accent: '#35d0ff',
  },
  {
    href: '/leaderboard',
    icon: Trophy,
    title: 'Leaderboards',
    body: 'The best players and clubs, globally and by country.',
    accent: '#8b6bff',
  },
];

export function HomeValueProps() {
  return (
    <section className="reveal" aria-labelledby="what-you-get">
      <div className="max-w-2xl">
        <p className="eyebrow">Why BrawlZone</p>
        <h2 id="what-you-get" className="display mt-2.5 text-2xl uppercase sm:text-3xl">
          Everything you need to track the game
        </h2>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {PROPS.map(({ href, icon: Icon, title, body, accent }) => (
          <li key={title}>
            {/*
              A row on a phone and a tile from `sm` up. Four stacked tiles is
              most of a phone screen spent on navigation the visitor has not
              asked for yet; four rows is a glanceable list.
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
