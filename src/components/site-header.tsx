'use client';

import {
  CalendarClock,
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
  { href: '/release-notes', label: 'Release Notes', icon: ScrollText },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/events', label: 'Events', icon: CalendarClock },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <BrandMark className="size-9 shrink-0" />
          <span className="display text-xl uppercase tracking-wide">
            Brawl<span className="text-brand">Zone</span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-surface-2 text-brand'
                    : 'text-muted hover:bg-surface hover:text-foreground'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
          <Link
            href="/#search"
            className="ml-2 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
          >
            <Search className="size-4" />
            Search
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="ml-auto grid size-10 place-items-center rounded-lg border border-border text-muted md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <nav className="border-t border-border/70 bg-surface px-4 py-2 md:hidden">
          {[{ href: '/', label: 'Search', icon: Search }, ...NAV].map(
            ({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-foreground"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ),
          )}
        </nav>
      ) : null}
    </header>
  );
}
