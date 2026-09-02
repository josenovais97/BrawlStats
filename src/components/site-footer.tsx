import { Coffee, ExternalLink, Mail, MessagesSquare, PlayCircle } from 'lucide-react';
import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';
import { AppStoreBadge, GooglePlayBadge } from '@/components/store-badges';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site';

const APP_STORE_URL = 'https://apps.apple.com/app/brawl-stars/id1229016807';
const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.supercell.brawlstars';
const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/josenovais';

/**
 * `?sub_confirmation=1` opens YouTube's subscribe dialog straight away rather
 * than dropping the visitor on the channel to find the button themselves.
 */
const YOUTUBE_URL = 'https://www.youtube.com/@brawlzonenet?sub_confirmation=1';

/**
 * The community server.
 *
 * This one is permanent — verified against Discord's API rather than assumed,
 * because the two invites before it were both created as "never expiring" and
 * both came back with a 30-day expiry.
 *
 * `brawlzone-healthcheck` still queries it every ten minutes. A permanent
 * invite cannot lapse, but it can be revoked, and the channel it points at can
 * be deleted — either of which leaves a dead link on every page of the site
 * with nothing else to notice. The check reads the code out of this file, so
 * changing the constant is all it takes to move it.
 *
 * If you are reading this because that alert fired: make a new invite with no
 * expiry and no use limit, put the code below, and the alert stops on its own.
 */
const DISCORD_URL = 'https://discord.gg/964EMQBBUJ';
const FAN_CONTENT_POLICY_URL = 'https://supercell.com/en/fan-content-policy/';

/**
 * Where every route on the site is reachable from, grouped by what it is for.
 *
 * One list of fifteen links was the problem rather than the styling. Rendered
 * two-up it came out ragged — seven items beside six, with "Release Notes"
 * dangling under an empty cell — and it asked the reader to scan an
 * alphabet-soup of page names for the one they wanted. Three named groups of
 * five are the same links doing an extra job: the headings say what the site
 * actually offers before a single link is read.
 *
 * Only routes that exist are listed. A footer link to a page that 404s is worse
 * than no footer link, and it is the kind of thing that rots quietly.
 */
const LINK_GROUPS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Stats',
    links: [
      { href: '/brawlers', label: 'Brawlers' },
      { href: '/tier-list/ranked', label: 'Tier List' },
      { href: '/ranked', label: 'Ranked Maps' },
      { href: '/maps', label: 'Maps' },
      { href: '/leaderboard', label: 'Leaderboard' },
    ],
  },
  {
    heading: 'Tools',
    links: [
      { href: '/draft', label: 'Draft' },
      { href: '/comps', label: 'Team Comps' },
      { href: '/compare', label: 'Compare' },
      { href: '/daily', label: 'Daily' },
      { href: '/meta', label: 'Meta Report' },
    ],
  },
  {
    heading: 'Game',
    links: [
      { href: '/events', label: 'Events' },
      { href: '/cosmetics', label: 'Cosmetics' },
      { href: '/starr-drops', label: 'Starr Drops' },
      { href: '/news', label: 'News' },
      { href: '/release-notes', label: 'Release Notes' },
    ],
  },
];

/**
 * Where the numbers and the artwork come from. Required attribution.
 *
 * The wiki was missing from this list while supplying class, rarity, every
 * combat stat, ability text, prestige titles and the artwork for brawlers the
 * mirror has not published — which is most of what a brawler page shows.
 * Crediting three of four sources is not crediting the sources.
 */
const SOURCES = [
  { href: 'https://developer.brawlstars.com', label: 'Brawl Stars API' },
  { href: 'https://docs.royaleapi.com/proxy.html', label: 'RoyaleAPI proxy' },
  { href: 'https://brawlify.com', label: 'Brawlify artwork' },
  { href: 'https://brawlstars.fandom.com', label: 'Brawl Stars Wiki' },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-16 border-t border-border/70 bg-background sm:mt-20">
      {/*
        A single hairline of brand light along the top edge, which is what ties
        the footer to the page above it rather than letting it read as a
        detached slab.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--brand) 45%, transparent), color-mix(in srgb, var(--accent) 35%, transparent), transparent)',
        }}
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/*
          Four columns rather than three, and the link groups carry their own
          headings. The old layout put the brand in one column and everything
          else in two, which left three hundred pixels of dead space under the
          store badges while the right-hand column ran on past it — the reason
          the whole block read as unbalanced.
        */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))] lg:gap-8">
          <div className="min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 rounded-lg font-black tracking-tight"
            >
              <BrandMark className="size-7" />
              <span className="display text-xl uppercase">{SITE_NAME}</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
              Brawl Stars stats that show where you stand. Player and club lookups,
              tier lists and map picks, from battles we sample ourselves.
            </p>

            {/*
              One row of equal-weight links, not three stacked buttons.

              They used to be a filled brand pill above two outlined ones, which
              read as three unrelated calls to action of descending importance —
              and put a donation button at the visual top of the stack. They are
              three ways to follow the same project, so they now look like it.
              The coffee link keeps a warm tint because it is an offer rather
              than a destination, but never the solid brand fill: that belongs
              to the search button, and a donation should not be the loudest
              control on a page about looking up players.
            */}
            <p className="eyebrow mt-7">Follow and support</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3.5 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
              >
                {/* Generic speech marks rather than Discord's own wordmark:
                    it is a trademark, licensed only for unmodified use. */}
                <MessagesSquare aria-hidden className="size-4" />
                Discord
              </a>
              <a
                href={YOUTUBE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface-2/50 px-3.5 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
              >
                {/* lucide dropped its brand icons, so this is the generic play
                    mark rather than YouTube's own, for the same reason. */}
                <PlayCircle aria-hidden className="size-4" />
                YouTube
              </a>
              <a
                href={BUY_ME_A_COFFEE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand/35 bg-brand/10 px-3.5 text-sm font-bold text-brand transition-colors hover:border-brand/60 hover:bg-brand/15"
              >
                <Coffee aria-hidden className="size-4" />
                Buy me a coffee
              </a>
            </div>
            <p className="mt-2.5 text-xs text-muted/80">Free, ad-free, no paywall.</p>

          </div>

          {LINK_GROUPS.map((group) => (
            <nav key={group.heading} aria-label={group.heading} className="min-w-0">
              <p className="eyebrow">{group.heading}</p>
              <ul className="mt-3 space-y-0.5">
                {group.links.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-flex min-h-9 items-center text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/*
          About, contact and attribution together on one quiet line.

          Sources used to sit in a column of navigation styled exactly like it,
          which made "RoyaleAPI proxy" look like a page on this site. They are
          credit, not destinations, so they belong with the disclaimer that is
          also credit.
        */}
        <div className="mt-10 space-y-4 border-t border-border/70 pt-6 text-xs leading-relaxed text-muted">
          {/*
            The store badges close the footer rather than sitting in the brand
            column. Up there they made that column half again as tall as the
            three beside it, so the block ended in a wide empty rectangle; down
            here they balance the attribution line and read as what they are —
            a link out, next to the other links out.
          */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Both badges are locked to one height so they read as a pair
                  rather than as two pieces of borrowed artwork. */}
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Download Brawl Stars on the App Store (opens in a new tab)"
                className="rounded transition-opacity hover:opacity-80"
              >
                <AppStoreBadge className="h-9 w-auto" />
              </a>
              <a
                href={GOOGLE_PLAY_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Download Brawl Stars on Google Play (opens in a new tab)"
                className="rounded transition-opacity hover:opacity-80"
              >
                <GooglePlayBadge className="h-9 w-auto" />
              </a>
            </div>
            <p className="text-muted/80">Get Brawl Stars &mdash; free on iOS and Android</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-t border-border/50 pt-4">
            <Link
              href="/about"
              className="transition-colors hover:text-foreground"
            >
              About {SITE_NAME}
            </Link>
            <Dot />
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Mail aria-hidden className="size-3.5 shrink-0" />
              Contact
            </a>
            <Dot />
            <span className="text-muted/80">Data and artwork from</span>
            {SOURCES.map((source, index) => (
              <span key={source.href} className="inline-flex items-center gap-1">
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  {source.label}
                  <ExternalLink aria-hidden className="size-3 shrink-0" />
                </a>
                {index < SOURCES.length - 1 ? <Dot /> : null}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl">
              This material is unofficial and is not endorsed by Supercell. For more
              information see{' '}
              <a
                href={FAN_CONTENT_POLICY_URL}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-brand"
              >
                Supercell&rsquo;s Fan Content Policy
              </a>
              .
            </p>
            <p className="shrink-0 text-muted/80">
              {SITE_NAME} &middot; not affiliated with Supercell
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** The separator between attribution links, so they read as one sentence. */
function Dot() {
  return (
    <span aria-hidden className="px-0.5 text-muted/40">
      &middot;
    </span>
  );
}
