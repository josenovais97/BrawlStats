import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import {
  BrawlersIcon,
  CompareIcon,
  DraftIcon,
  LeaderboardIcon,
  MapsIcon,
  RankedIcon,
  TierListIcon,
} from '@/components/game-icons';
import { getTopMetaBrawlers } from '@/lib/home-meta';
import { TIER_COLOR } from '@/lib/tiers';

/**
 * The tools, weighted.
 *
 * This was identical cells, which is a navigation table rather than a
 * recommendation — it told a first-time visitor that every tool matters
 * equally, which is not true. Two are worth opening immediately and get room
 * plus a real preview; the rest are a compact grid underneath.
 *
 * The tier-list preview uses the same cached ranking as the meta snapshot, so
 * showing it here costs nothing upstream.
 */
const SECONDARY = [
  {
    href: '/ranked',
    icon: RankedIcon,
    title: 'Ranked Maps',
    body: 'Best picks per map',
  },
  {
    href: '/compare',
    icon: CompareIcon,
    title: 'Compare',
    body: 'Two players, side by side',
  },
  {
    href: '/leaderboard',
    icon: LeaderboardIcon,
    title: 'Leaderboards',
    body: 'Trophies and Ranked elo',
  },
  { href: '/maps', icon: MapsIcon, title: 'Maps', body: 'Every map, ranked' },
  {
    href: '/brawlers',
    icon: BrawlersIcon,
    title: 'Brawlers',
    body: 'Stats, builds, matchups',
  },
  {
    href: '/tier-list/maker',
    icon: TierListIcon,
    title: 'Tier list maker',
    body: 'Build and share your own',
  },
];

export async function HomeTools() {
  const top = await getTopMetaBrawlers(3).catch(() => []);

  return (
    <section className="reveal" aria-labelledby="tools">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2.5">
            <span aria-hidden className="rule h-4" />
            <span className="eyebrow">Everything else</span>
          </p>
          <h2 id="tools" className="display mt-2.5 text-2xl uppercase sm:text-4xl">
            Tools
          </h2>
        </div>
        <p className="text-sm text-muted">All of it from our own sampled battles.</p>
      </div>

      {/* Two featured, then four compact. The proportions are the hierarchy. */}
      <div className="reveal-row grid gap-4 md:grid-cols-2">
        <Featured
          href="/tier-list/ranked"
          icon={<TierListIcon className="size-6" />}
          title="Tier lists"
          body="Ranked and trophy ladder scored separately. They are different games, and the answers differ."
          cta="Open the Ranked list"
        >
          {top.length > 0 ? (
            <ul className="flex gap-2">
              {top.map((brawler) => (
                <li
                  key={brawler.brawlerId}
                  className="flex min-w-0 flex-1 flex-col items-center rounded-xl bg-surface-2/60 p-2"
                >
                  <Image
                    src={brawler.imageUrl}
                    alt=""
                    width={44}
                    height={44}
                    className="size-11 rounded-lg"
                    loading="lazy"
                    unoptimized
                  />
                  <span
                    className="display mt-1.5 text-base leading-none tabular-nums"
                    style={{ color: TIER_COLOR[brawler.tier] }}
                  >
                    {brawler.score.toFixed(1)}
                  </span>
                  <span className="mt-1 w-full truncate text-center text-xs capitalize text-muted">
                    {brawler.name.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Featured>

        <Featured
          href="/draft"
          icon={<DraftIcon className="size-6" />}
          title="Draft helper"
          body="Pick the map, name what the enemy took, and the list reorders around both."
          cta="Open the draft helper"
        >
          {/* The tool's own shape: your side, their side, and the gap you are
              filling. No match data, because none of it would be real. */}
          <div className="flex items-center gap-2">
            <Slots label="Your team" tone="var(--accent-2)" filled={2} />
            <span className="display shrink-0 text-xs uppercase text-muted">vs</span>
            <Slots label="Enemy" tone="var(--defeat)" filled={3} />
          </div>
        </Featured>
      </div>

      {/*
        Six, in one, two or three columns — all of which divide evenly, so the
        hole that the last item used to stretch across never opens. It was five
        until the tier-list maker joined them; the maker had been reachable
        only from the header menu, which is the one place nobody looks for a
        tool they do not already know exists.
      */}
      <ul className="reveal-row mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {SECONDARY.map(({ href, icon: Icon, title, body }) => (
          <li key={href} className="bg-surface">
            {/*
              A row on a phone, a card from `lg`. The strip used to be a row at
              every width, which at full width is five lines of small text
              pretending to be navigation — the same five destinations read as
              tools once each one has a lit tile and room to breathe.
            */}
            <Link
              href={href}
              className="group flex h-full items-center gap-3 p-3.5 transition-colors hover:bg-surface-2 lg:flex-col lg:items-start lg:gap-2.5 lg:p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 transition-colors group-hover:bg-surface-3">
                <Icon className="size-6" />
              </span>
              <span className="min-w-0 flex-1 lg:flex-none">
                <span className="block truncate text-sm font-bold leading-tight transition-colors group-hover:text-brand">
                  {title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted lg:whitespace-normal">
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

/** A featured tool: room for a preview, and a stated way in. */
function Featured({
  href,
  icon,
  title,
  body,
  cta,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="card card-interactive group flex flex-col gap-4 p-5 hover:bg-surface-2/30"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="display text-lg uppercase leading-none">{title}</h3>
          <p className="mt-1.5 text-sm leading-snug text-muted">{body}</p>
        </div>
      </div>

      <div className="flex-1">{children}</div>

      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors group-hover:text-brand">
        {cta}
        <ArrowRight className="size-4 duration-200 group-hover:translate-x-0.5 motion-safe:transition-transform" />
      </span>
    </Link>
  );
}

/** Three draft slots, some taken. Shape only — no brawlers are named. */
function Slots({ label, tone, filled }: { label: string; tone: string; filled: number }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span aria-hidden className="mt-1.5 flex gap-1.5">
        {[0, 1, 2].map((slot) => (
          <span
            key={slot}
            className="h-9 flex-1 rounded-lg border"
            style={
              slot < filled
                ? {
                    background: `color-mix(in srgb, ${tone} 20%, transparent)`,
                    borderColor: `color-mix(in srgb, ${tone} 45%, transparent)`,
                  }
                : {
                    borderColor: 'var(--border)',
                    borderStyle: 'dashed',
                  }
            }
          />
        ))}
      </span>
    </span>
  );
}
