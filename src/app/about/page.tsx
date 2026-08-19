import type { Metadata } from 'next';
import {
  ArrowRight,
  Coffee,
  Database,
  ExternalLink,
  Lock,
  RefreshCw,
  Search,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

import { PageHeading, SectionHeading } from '@/components/ui/section-heading';

export const metadata: Metadata = {
  alternates: { canonical: '/about' },
  title: 'About',
  description:
    'What Brawl Zone is, where its data comes from, and what it can and cannot tell you.',
};

const SOURCES = [
  {
    icon: Shield,
    title: 'Official Brawl Stars API',
    href: 'https://developer.brawlstars.com',
    body: 'Players, clubs, battle logs, leaderboards and the event rotation. Everything about a specific account comes from here, live.',
  },
  {
    icon: Database,
    title: 'Brawlify CDN',
    href: 'https://brawlify.com',
    body: 'Brawler portraits, star power and gadget art, gears, ranked badges, maps and game mode icons.',
  },
  {
    icon: RefreshCw,
    title: 'Supercell news & release notes',
    href: 'https://supercell.com/en/games/brawlstars/blog/',
    body: 'Official announcements and the full text of each update, resolved automatically as new posts go live.',
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-12">
      <PageHeading
        title="About Brawl Zone"
        subtitle="A fast, honest stats site for Brawl Stars. Built for players who want to know exactly where they stand."
      />

      <section>
        <SectionHeading title="What it does" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            icon={Search}
            title="Look anyone up"
            body="Search any player or club tag for trophies, ranked tiers, world rankings, progression and recent form. Save the profiles you follow and they stay one tap away."
          />
          <Card
            icon={Database}
            title="Track the meta"
            body="Tier lists and per-map picks aggregated from thousands of sampled battles, refreshed daily. Plus upgrade-ownership rates, release notes and news in one place."
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Where the data comes from" />
        <div className="grid gap-4 lg:grid-cols-3">
          {SOURCES.map(({ icon: Icon, title, href, body }) => (
            <a
              key={title}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="card card-interactive group p-5"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-surface-2 text-brand">
                <Icon className="size-5" />
              </span>
              <h3 className="display mt-4 flex items-center gap-1.5 text-lg">
                {title}
                <ExternalLink className="size-3.5 text-muted" />
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </a>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="What we can't tell you"
          subtitle="Being straight about the limits is more useful than pretending they don't exist."
        />
        <ul className="card divide-y divide-border p-0">
          {[
            [
              'Battle history only goes back ~25 matches',
              'That is everything the API keeps. Anything labelled “recent” genuinely is. There is no career match history to show.',
            ],
            [
              'Leaderboards stop at 200',
              'The API refuses to return more, so top-200 is the deepest placement that exists. There is no top-500.',
            ],
            [
              'Loadouts are not published',
              'The API reports which star powers, gadgets and gears a player owns, and nothing about what they took into a match. No endpoint exposes an equipped loadout. So the brawler pages show upgrade ownership, never a usage or pick rate. A gear owned by 78% of a brawler\u2019s owners is exactly that: owned by 78%. Ownership usually tracks usage, but it is not a measurement of it.',
            ],
            [
              'Tier list percentages are adjusted',
              'Our sample skews toward high-trophy players, who win more with anything. Win rates are re-centred on that baseline so the comparison between brawlers stays fair.',
            ],
            [
              'Coins, power points and playtime are estimates',
              'Derived from published upgrade costs and victory counts. Bling is not exposed by the API at all, so we do not show it.',
            ],
          ].map(([title, body]) => (
            <li key={title} className="p-5">
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading
          title="Reading the map pages"
          subtitle="Four different things get called “maps”, and they mean different things."
        />
        <ul className="card divide-y divide-border">
          {[
            [
              'Live now',
              'The maps in the event rotation this minute, straight from the game API. This is the only list that is literally “right now”.',
            ],
            [
              'Ranked pool',
              'The competitive map pool for the current Ranked season, published per season. Fixed until the season turns over.',
            ],
            [
              'Full catalogue',
              'Every map still in the game. Around four hundred. This is deliberately not called a rotation: the artwork source publishes no last-played date, so nothing in it can say which of those maps are actually live today.',
            ],
            [
              'Map picks vs mode picks',
              'A map page ranks brawlers from battles played on that map. When a map has too few sampled battles to say anything, it falls back to the mode’s picks and says so on the page. A recommendation is never presented as map-specific when it is not.',
            ],
            [
              'Confidence labels',
              'Thin sample, Building and Well sampled describe how many battles are behind a map’s ranking. Nothing more. A thin map is not hidden; it is labelled, because a caveat you can read beats a number you cannot check.',
            ],
          ].map(([title, body]) => (
            <li key={title} className="p-5">
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading title="Privacy" />
        <div className="card flex gap-4 p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-victory">
            <Lock className="size-5" />
          </span>
          <div className="space-y-2 text-sm leading-relaxed text-muted">
            <p>
              There is no account system, so there is nothing to sign up for and no
              password to store. Your recent searches and saved profiles live in your
              own browser&apos;s local storage and are never sent to us. Clearing your
              browser data removes them for good.
            </p>
            <p>
              {/* Previously this said "no tracking", which was not true while
                  Vercel Analytics is enabled. Stating it plainly is the point
                  of this page. */}
              The site does use Vercel&apos;s privacy-friendly analytics to count page
              views. It records no cookies and does not build a profile of you or follow
              you across other sites. It is a visit counter, not ad tracking.
            </p>
            <p>
              Looking up a tag is a public action: the same data is available to anyone
              through the official API.
            </p>
          </div>
        </div>
      </section>

      <section className="card card-glow relative overflow-hidden p-8 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            background: 'radial-gradient(30rem 14rem at 50% 0%, #ffc53d, transparent 70%)',
          }}
        />
        <div className="relative">
          <Coffee className="mx-auto size-8 text-brand" />
          <h2 className="display mt-4 text-2xl uppercase sm:text-3xl">
            Built by one person
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">
            Brawl Zone is free, ad-free and has no paywall. If it saved you some time,
            a coffee goes a long way.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://buymeacoffee.com/josenovais"
              target="_blank"
              rel="noreferrer"
              className="btn-game inline-flex items-center gap-2 bg-brand px-6 py-3 uppercase text-[#1a1200] hover:bg-brand-strong"
            >
              <Coffee className="size-4" />
              Buy me a coffee
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
            >
              <ArrowRight className="size-4" />
              Start searching
            </Link>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-muted/80">
        This material is unofficial and is not endorsed by Supercell. For more information
        see Supercell&apos;s Fan Content Policy.
      </p>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Search;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-6">
      <span className="grid size-11 place-items-center rounded-xl bg-surface-2 text-brand">
        <Icon className="size-5" />
      </span>
      <h3 className="display mt-4 text-lg">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
