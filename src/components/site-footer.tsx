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
  // Added 2026-08-27. These three were live, in the sitemap, and reachable
  // from nowhere on the site -- `npm run crawl:budget` never found them
  // because no page linked to them. A route with no inbound link is a page
  // nobody can arrive at except by typing it.
  { href: '/cosmetics', label: 'Cosmetics' },
  { href: '/news', label: 'News' },
  { href: '/starr-drops', label: 'Starr Drops' },
  { href: '/release-notes', label: 'Release Notes' },
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
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-10">
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
            <ul className="mt-3 grid grid-cols-2 gap-x-4">
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
              {/* Directly above the data sources on purpose: someone who has
                  just read where a number came from is exactly the person who
                  wants to tell us it looks wrong. */}
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
                >
                  <Mail aria-hidden className="size-3.5 shrink-0" />
                  Contact
                </a>
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
            {/*
              Given a warm tint so it reads as an offer rather than as one more
              grey link, but never the solid brand fill — that belongs to the
              search button, and a donation should not be the loudest control
              on a page about looking up players.
            */}
            <a
              href={BUY_ME_A_COFFEE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand/35 bg-brand/10 px-3.5 text-sm font-bold text-brand transition-colors hover:border-brand/60 hover:bg-brand/15"
            >
              <Coffee aria-hidden className="size-4" />
              Buy me a coffee
            </a>
            <p className="mt-2 text-xs text-muted/80">Free, ad-free, no paywall.</p>

            {/* Below the coffee link and styled quieter than it, for the same
                reason that one is quieter than the search: the page is for
                looking up players, and neither of these should outrank it. */}
            <a
              href={YOUTUBE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
            >
              {/* lucide dropped its brand icons, so this is the generic play mark
                  rather than YouTube's own — which is trademarked, and only
                  licensed for use unmodified. */}
              <PlayCircle aria-hidden className="size-4" />
              Subscribe on YouTube
            </a>

            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground sm:mt-3 sm:ml-2"
            >
              {/* Generic speech marks rather than Discord's own wordmark, for
                  the same reason the button above does not carry YouTube's:
                  both are trademarks, licensed only for unmodified use. */}
              <MessagesSquare aria-hidden className="size-4" />
              Join the Discord
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
