import { Coffee, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';
import { AppStoreBadge, GooglePlayBadge } from '@/components/store-badges';
import { SITE_NAME } from '@/lib/site';

const APP_STORE_URL = 'https://apps.apple.com/app/brawl-stars/id1229016807';
const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.supercell.brawlstars';
const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/josenovais';
const FAN_CONTENT_POLICY_URL = 'https://supercell.com/en/fan-content-policy/';

/**
 * Where every route on the site is reachable from, and where the attribution
 * lives.
 *
 * Three groups rather than two loose blocks: the old footer paired a "get the
 * game" panel with a full-brand yellow "buy me a coffee" button and nothing
 * else, so the loudest thing under a page about looking up players was a
 * donation link, and the site's own pages were not linked at all.
 *
 * Only routes that exist are listed. A footer link to a page that 404s is
 * worse than no footer link, and it is the kind of thing that rots quietly.
 */
const EXPLORE = [
  { href: '/brawlers', label: 'Brawlers' },
  { href: '/tier-list/ranked', label: 'Tier List' },
  { href: '/ranked', label: 'Ranked Maps' },
  { href: '/maps', label: 'Maps' },
  { href: '/draft', label: 'Draft' },
  { href: '/compare', label: 'Compare' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/events', label: 'Events' },
];

/** Where the numbers and the artwork come from. Required attribution. */
const SOURCES = [
  { href: 'https://developer.brawlstars.com', label: 'Brawl Stars API' },
  { href: 'https://docs.royaleapi.com/proxy.html', label: 'RoyaleAPI proxy' },
  { href: 'https://brawlify.com', label: 'Brawlify artwork' },
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

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          {/* Brand */}
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

            <p className="eyebrow mt-6">Get the game</p>
            {/* Both badges are locked to one height so they read as a pair
                rather than as two pieces of borrowed artwork. */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Download Brawl Stars on the App Store (opens in a new tab)"
                className="rounded transition-opacity hover:opacity-80"
              >
                <AppStoreBadge className="h-10 w-auto" />
              </a>
              <a
                href={GOOGLE_PLAY_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Download Brawl Stars on Google Play (opens in a new tab)"
                className="rounded transition-opacity hover:opacity-80"
              >
                <GooglePlayBadge className="h-10 w-auto" />
              </a>
            </div>
          </div>

          {/* Explore */}
          <nav aria-labelledby="footer-explore" className="min-w-0">
            <p id="footer-explore" className="eyebrow">
              Explore
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 sm:grid-cols-1">
              {EXPLORE.map(({ href, label }) => (
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

          {/* About and data */}
          <div className="min-w-0">
            <p className="eyebrow">About and data</p>
            <ul className="mt-3 space-y-0.5">
              <li>
                <Link
                  href="/about"
                  className="inline-flex min-h-9 items-center text-sm text-muted transition-colors hover:text-foreground"
                >
                  About {SITE_NAME}
                </Link>
              </li>
              {SOURCES.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
                  >
                    {label}
                    <ExternalLink aria-hidden className="size-3 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>

            {/* Support, deliberately quiet: it is a thank-you, not the thing
                the site is for. The page's own call to action is the search. */}
            <a
              href={BUY_ME_A_COFFEE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-brand"
            >
              <Coffee aria-hidden className="size-4" />
              Buy me a coffee
            </a>
          </div>
        </div>

        {/* Required disclaimer, on its own quiet line. */}
        <div className="mt-9 flex flex-col gap-2 border-t border-border/70 pt-5 text-xs leading-relaxed text-muted sm:flex-row sm:items-center sm:justify-between">
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
    </footer>
  );
}
