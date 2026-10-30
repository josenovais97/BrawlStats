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
import Image from 'next/image';
import Link from 'next/link';

import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { CONTACT_EMAIL } from '@/lib/site';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

export const metadata: Metadata = {
  alternates: { canonical: '/about' },
  title: 'About',
  description:
    'What BrawlZone is, where its data comes from, and what it can and cannot tell you.',
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
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  return (
    <div className="space-y-12">
      <PageHeading
        title={t('About BrawlZone')}
        subtitle={t('A fast, honest stats site for Brawl Stars. Built for players who want to know exactly where they stand.')}
      />

      {/*
        States the name in prose, which is the other half of the site-name
        signal `alternateName` carries in the homepage schema.

        Worth one sentence because "brawl zone" as two words is genuinely
        ambiguous: it already resolves to Brawl Stars' Hot Zone mode, an older
        Android game of the same name and a Bakugan product, all with years of
        history. Written as a sentence a person would read rather than a list
        of spellings, since a page that reads like it is talking to a crawler
        is the wrong trade for a paragraph nobody needed.
      */}
      <p className="max-w-prose leading-relaxed text-muted">{t('BrawlZone — often written')}{' '}<strong className="text-foreground">{t('Brawl Zone')}</strong>{' '}{t('— is an independent Brawl Stars statistics site covering player and club lookups, Ranked analysis and brawler tier lists. It lives at')}{' '}
        <a href="https://brawlzone.net" className="text-brand hover:underline">{t('brawlzone.net')}</a>{' '}{t('and is not affiliated with Supercell.')}</p>

      {/* Who is behind it (2026-10-30): a named publisher is part of what
          AdSense reviewers look for, and the same name is on Google Play. */}
      <p className="max-w-prose leading-relaxed text-muted">{t('BrawlZone is made and run by')}{' '}<strong className="text-foreground">Novais Labs</strong>{t(', a one-person studio in Portugal that also develops the BrawlZone Bubble app for Android. Questions go to the address below.')}</p>

      <section>
        <SectionHeading title={t('What it does')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            icon={Search}
            title={t('Look anyone up')}
            body={t('Search any player or club tag for trophies, ranked tiers, world rankings, progression and recent form. Save the profiles you follow and they stay one tap away.')}
          />
          <Card
            icon={Database}
            title={t('Track the meta')}
            body={t('Tier lists and per-map picks aggregated from thousands of sampled battles, refreshed daily. Plus upgrade-ownership rates, release notes and news in one place.')}
          />
        </div>
      </section>

      <section>
        <SectionHeading title={t('Where the data comes from')} />
        <div className="grid gap-4 lg:grid-cols-3">
          {SOURCES.map(({ icon: Icon, title, href, body }) => (
            <a
              key={title}
              href={lp(href)}
              target="_blank"
              rel="noreferrer"
              className="card card-interactive group p-5"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-surface-2 text-brand">
                <Icon className="size-5" />
              </span>
              <h3 className="display mt-4 flex items-center gap-1.5 text-lg">
                {t(title)}
                <ExternalLink className="size-3.5 text-muted" />
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(body)}</p>
            </a>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title={t('What we can\'t tell you')}
          subtitle={t('Being straight about the limits is more useful than pretending they don\'t exist.')}
        />
        <ul className="card divide-y divide-border p-0">
          {[
            [
              t('Battle history only goes back ~25 matches'),
              t('That is everything the API keeps. Anything labelled “recent” genuinely is. There is no career match history to show.'),
            ],
            [
              t('Leaderboards stop at 200'),
              t('The API refuses to return more, so top-200 is the deepest placement that exists. There is no top-500.'),
            ],
            [
              t('Loadouts are not published'),
              t('The API reports which star powers, gadgets and gears a player owns, and nothing about what they took into a match. No endpoint exposes an equipped loadout. So the brawler pages show upgrade ownership, never a usage or pick rate. A gear owned by 78% of a brawler\u2019s owners is exactly that: owned by 78%. Ownership usually tracks usage, but it is not a measurement of it.'),
            ],
            [
              t('Tier list percentages are adjusted'),
              t('Our sample skews toward high-trophy players, who win more with anything. Win rates are re-centred on that baseline so the comparison between brawlers stays fair.'),
            ],
            [
              t('Coins, power points and playtime are estimates'),
              t('Derived from published upgrade costs and victory counts. Bling is not exposed by the API at all, so we do not show it.'),
            ],
          ].map(([title, body]) => (
            <li key={title} className="p-5">
              <p className="font-semibold">{t(title)}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(body)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading
          title={t('Reading the map pages')}
          subtitle={t('Four different things get called “maps”, and they mean different things.')}
        />
        <ul className="card divide-y divide-border">
          {[
            [
              'Live now',
              t('The maps in the event rotation this minute, straight from the game API. This is the only list that is literally “right now”.'),
            ],
            [
              'Ranked pool',
              t('The competitive map pool for the current Ranked season, published per season. Fixed until the season turns over.'),
            ],
            [
              'Full catalogue',
              t('Every map still in the game. Around four hundred. This is deliberately not called a rotation: the artwork source publishes no last-played date, so nothing in it can say which of those maps are actually live today.'),
            ],
            [
              t('Map picks vs mode picks'),
              t('A map page ranks brawlers from battles played on that map. When a map has too few sampled battles to say anything, it falls back to the mode’s picks and says so on the page. A recommendation is never presented as map-specific when it is not.'),
            ],
            [
              'Confidence labels',
              t('Thin sample, Building and Well sampled describe how many battles are behind a map’s ranking. Nothing more. A thin map is not hidden; it is labelled, because a caveat you can read beats a number you cannot check.'),
            ],
          ].map(([title, body]) => (
            <li key={title} className="p-5">
              <p className="font-semibold">{t(title)}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t(body)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionHeading title={t('Privacy')} />
        <div className="card flex gap-4 p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-victory">
            <Lock className="size-5" />
          </span>
          <div className="space-y-2 text-sm leading-relaxed text-muted">
            <p>{t('There is no account system, so there is nothing to sign up for and no password to store. Your recent searches and saved profiles live in your own browser\'s local storage and are never sent to us. Clearing your browser data removes them for good.')}</p>
            <p>
              {/* Previously this said "no tracking", which was not true while
                  Analytics (Umami, self-hosted) is enabled. Stating it plainly is the point
                  of this page. */}{t('The site counts page views with Umami, a privacy-friendly analytics tool that runs on our own server. It records no cookies and does not build a profile of you or follow you across other sites. It is a visit counter, not ad tracking.')}</p>
            <p>{t('Looking up a tag is a public action: the same data is available to anyone through the official API.')}</p>
          </div>
        </div>
      </section>

      {/*
        Contact lives here rather than on a page of its own.
        
        A `/contact` route holding a single address is the thinnest kind of page
        there is, and this site's whole approach is pages with something on
        them. It also belongs next to "built by one person": the reason to write
        in is that a person reads it, and that context is on this page already.
      */}
      <section>
        <SectionHeading
          title={t('Get in touch')}
          subtitle={t('Ideas, corrections, or just to say hello.')}
        />
        <div className="card p-6">
          {/* Alt is empty on purpose: the artwork repeats what the heading and
              the address next to it already say, so a screen reader announcing
              it would only add noise. */}
          <Image
            src="/art/contact-bubble.png"
            alt=""
            width={430}
            height={397}
            className="h-auto w-20 sm:w-24"
          />
          <a
            href={lp(`mailto:${CONTACT_EMAIL}`)}
            className="display mt-4 inline-block text-lg text-brand hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">{t('Is there a feature you would like to see on BrawlZone? Something that looks wrong, or a page you wish existed? Send it over — ideas for what this site should do next are the most useful thing you can put in my inbox.')}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t('One person reads every message, so a reply can take a few days.')}</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted/80">
            {/* Kept, and kept last: without it this address collects &ldquo;unban
                me&rdquo; mail, which is neither answerable here nor a good use of
                anyone&apos;s time. */}{t('Account help, bans and purchases are Supercell\'s — this site only reads the public API and cannot change anything about your account.')}</p>
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
          <h2 className="display text-game-stroke mt-4 text-2xl sm:text-3xl">{t('Built by one person')}</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted">{t('BrawlZone is free and has no paywall; a few ads on the website pay for the server. If it saved you some time, a coffee goes a long way.')}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://buymeacoffee.com/josenovais"
              target="_blank"
              rel="noreferrer"
              className="btn-game inline-flex items-center gap-2 bg-brand px-6 py-3 uppercase text-[#1a1200] hover:bg-brand-strong"
            >
              <Coffee className="size-4" />{t('Buy me a coffee')}</a>
            <Link
              href={lp('/')}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
            >
              <ArrowRight className="size-4" />{t('Start searching')}</Link>
          </div>
        </div>
      </section>

      <p className="text-center text-xs text-muted/80">{t('This material is unofficial and is not endorsed by Supercell. For more information see Supercell\'s Fan Content Policy.')}</p>
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
  const t = getT(requestLocale());
  return (
    <div className="card p-6">
      <span className="grid size-11 place-items-center rounded-xl bg-surface-2 text-brand">
        <Icon className="size-5" />
      </span>
      <h3 className="display mt-4 text-lg">{t(title)}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{t(body)}</p>
    </div>
  );
}
