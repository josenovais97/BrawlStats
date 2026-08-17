'use client';

import {
  CalendarClock,
  Medal,
  Menu,
  Newspaper,
  Podium,
  ScrollText,
  Search,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { BrandMark } from '@/components/brand-mark';

const NAV = [
  { href: '/brawlers', label: 'Brawlers', icon: Swords },
  { href: '/tier-list', label: 'Tier List', icon: Podium },
  { href: '/ranked', label: 'Ranked', icon: Medal },
  { href: '/release-notes', label: 'Release Notes', icon: ScrollText },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/events', label: 'Events', icon: CalendarClock },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Any route change closes the panel, including a browser back that no link
  // handler ever sees. Adjusting during render rather than in an effect keeps
  // the closed panel out of the committed frame.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
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
        */}
        <nav aria-label="Main" className="ml-auto hidden items-center lg:flex">
          {NAV.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
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

          <Link
            href="/#search"
            className="ml-3 inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-bold text-brand-ink shadow-[0_2px_0_0_#b87d00] transition-colors hover:bg-brand-strong"
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
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
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
