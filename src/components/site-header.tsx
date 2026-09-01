'use client';

import {
  ChevronDown,
  Menu,
  Newspaper,
  Swords,
  ScrollText,
  Search,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { BrandMark } from '@/components/brand-mark';
import {
  BrawlersIcon,
  ClubIcon,
  CosmeticsIcon,
  CompareIcon,
  DraftIcon,
  EventsIcon,
  LeaderboardIcon,
  MapsIcon,
  RankedIcon,
  StarrDropIcon,
  TierListIcon,
} from '@/components/game-icons';

interface NavItem {
  href: string;
  /** Overrides `href` for the active check, when an entry links into a section. */
  match?: string;
  label: string;
  /*
   * Structural rather than a lucide type: the game-artwork icons are our own
   * components, not lucide forwardRefs, and a `className` is all the two share.
   */
  icon: (props: { className?: string }) => React.ReactNode;
}

/**
 * The desktop bar fits six labelled items beside the wordmark and the search
 * button, and not one more: at ten it wrapped "Tier List" and "Release Notes"
 * onto two lines each and pushed the bar to double height.
 *
 * So the bar is curated rather than complete. These six are the destinations
 * worth a permanent slot — the ones people arrive looking for.
 */
const NAV: NavItem[] = [
  { href: '/brawlers', label: 'Brawlers', icon: BrawlersIcon },
  // Points straight at the Ranked list so the nav does not bounce through the
  // /tier-list redirect, but stays highlighted on the trophy list too.
  { href: '/tier-list/ranked', match: '/tier-list', label: 'Tier List', icon: TierListIcon },
  { href: '/ranked', label: 'Ranked', icon: RankedIcon },
  { href: '/maps', label: 'Maps', icon: MapsIcon },
  { href: '/draft', label: 'Draft', icon: DraftIcon },
  { href: '/leaderboard', label: 'Leaderboard', icon: LeaderboardIcon },
];

/**
 * Everything else, behind "More".
 *
 * Not a junk drawer: each of these is either reached from somewhere more
 * relevant (a map page links to the Ranked map board, a brawler page to a
 * comparison) or is a page people come back to rather than look for.
 */
const MORE: NavItem[] = [
  // Team comps answers a question people ask before a match rather than after
  // one, so it would earn a permanent slot if there were a seventh. There is
  // not — see above — and the draft helper is the main bar's entry point into
  // the same question.
  { href: '/comps', label: 'Team Comps', icon: Swords },
  { href: '/meta', label: 'Meta Report', icon: Newspaper },
  // Events is the one demotion that costs something: it is a page people do
  // come back to. It goes here rather than Ranked because the rotation is also
  // surfaced on the home page, while the Ranked board has no other entry point.
  { href: '/events', label: 'Events', icon: EventsIcon },
  /*
   * Clubs had full pages and no way in from anywhere but a profile's club
   * chip. The board is the honest destination: there is no club index to point
   * at, and the leaderboard's Clubs tab is the closest thing to one.
   *
   * Player rows elsewhere still show club names as plain text, and that is not
   * an oversight — the game's ranking payload carries `club.name` with no tag,
   * so there is no URL to link to. Only a profile knows its club's tag.
   */
  { href: '/leaderboard/clubs', match: '/club', label: 'Clubs', icon: ClubIcon },
  { href: '/compare', label: 'Compare', icon: CompareIcon },
  { href: '/tier-list/maker', label: 'Tier List Maker', icon: TierListIcon },
  { href: '/starr-drops', label: 'Starr Drops', icon: StarrDropIcon },
  { href: '/cosmetics', label: 'Cosmetics', icon: CosmeticsIcon },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/release-notes', label: 'Release Notes', icon: ScrollText },
];

/** The mobile panel has room for the lot, so it never hides anything. */
const ALL_NAV: NavItem[] = [...NAV, ...MORE];

/** `match` overrides `href` when a nav entry links into a section. */
function isActive(pathname: string, href: string, match?: string) {
  const prefix = match ?? href;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Any route change closes both panels, including a browser back that no link
  // handler ever sees. Adjusting during render rather than in an effect keeps
  // the closed panel out of the committed frame.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
    setMoreOpen(false);
  }

  const moreActive = MORE.some((item) => isActive(pathname, item.href, item.match));

  return (
    <header className="sticky top-0 z-40">
      {/* The bar's surface is a layer rather than the header's own background,
          so it can fade in on scroll while the nav sitting on it never moves.
          See `header-veil` in globals.css. */}
      <span
        aria-hidden
        className="header-veil pointer-events-none absolute inset-0 -z-10 border-b border-border/70 bg-background/85 backdrop-blur-md"
      />

      <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label="BrawlZone home"
        >
          <BrandMark className="size-9 shrink-0 transition-transform duration-200 group-hover:-rotate-6" />
          <span className="display text-xl uppercase leading-none tracking-wide">
            Brawl<span className="text-brand">Zone</span>
          </span>
        </Link>

        {/*
          Icons are dropped from the desktop bar on purpose: six labelled items
          plus a brand plus a button is already the full width, and the icons
          were what pushed it into overflow between 768px and 1100px.

          `whitespace-nowrap` is the backstop. Without it a label that no longer
          fits breaks across two lines rather than overflowing, which doubles the
          height of the whole bar and is far harder to notice in review than a
          crowded one.
        */}
        <nav aria-label="Main" className="ml-auto hidden items-center lg:flex">
          {NAV.map(({ href, match, label }) => {
            const active = isActive(pathname, href, match);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active ? 'text-brand' : 'text-muted hover:text-foreground'
                }`}
              >
                {label}
                {/* Underline marks the current page more clearly than a tint. */}
                <span
                  aria-hidden
                  className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand transition-opacity ${
                    active ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </Link>
            );
          })}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              className={`relative flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                moreActive || moreOpen ? 'text-brand' : 'text-muted hover:text-foreground'
              }`}
            >
              More
              <ChevronDown
                className={`size-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
              />
              <span
                aria-hidden
                className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand transition-opacity ${
                  moreActive ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>

            {moreOpen ? (
              <>
                {/* Catches the click that should dismiss the menu. Sits under
                    the panel and over everything else, which is the cheapest
                    correct way to do outside-click without a global listener. */}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => setMoreOpen(false)}
                  className="fixed inset-0 z-0 cursor-default"
                />
                <ul className="absolute right-0 z-10 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-surface shadow-lg shadow-black/40">
                  {MORE.map(({ href, match, label, icon: Icon }) => {
                    const active = isActive(pathname, href, match);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                            active
                              ? 'bg-brand/10 text-brand'
                              : 'text-muted hover:bg-surface-2 hover:text-foreground'
                          }`}
                        >
                          <Icon className="size-4 shrink-0" />
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </div>

          <Link
            href="/#search"
            className="ml-3 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-brand px-3.5 py-2 text-sm font-bold text-brand-ink shadow-[0_2px_0_0_#b87d00] transition-colors hover:bg-brand-strong"
          >
            <Search className="size-4" />
            Search
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <Link
            href="/#search"
            aria-label="Search a player or club"
            className="grid size-10 place-items-center rounded-lg bg-brand text-brand-ink shadow-[0_2px_0_0_#b87d00]"
          >
            <Search className="size-5" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="grid size-10 place-items-center rounded-lg border border-border text-muted transition-colors hover:text-foreground"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-border/70 bg-surface/95 backdrop-blur-md lg:hidden"
        >
          {/*
            One column below 380px: "Release Notes" and "Leaderboard" both get
            clipped in a two-column grid on the narrowest phones.
          */}
          <ul className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-2 px-4 py-4 min-[380px]:grid-cols-2 sm:px-6">
            {ALL_NAV.map(({ href, match, label, icon: Icon }) => {
              const active = isActive(pathname, href, match);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                      active
                        ? 'border-brand/40 bg-brand/10 text-brand'
                        : 'border-border bg-surface-2/60 text-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
