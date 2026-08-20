'use client';

import { Clock, X } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import { ClubIcon, PlayersIcon } from '@/components/game-icons';
import {
  clearRecentSearches,
  readRecentSearches,
  removeRecentSearch,
  serverRecentSearches,
  subscribeRecentSearches,
} from '@/lib/recent-searches';

/**
 * Shows tags looked up on this device. Renders nothing until mounted so the
 * server-rendered HTML and the first client render agree — localStorage is not
 * available during SSR.
 */
export function RecentSearches() {
  const entries = useSyncExternalStore(
    subscribeRecentSearches,
    readRecentSearches,
    serverRecentSearches,
  );

  if (entries.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <Clock className="size-4 text-muted" />
        <span className="text-sm font-medium text-muted">Recent</span>
        <button
          type="button"
          onClick={clearRecentSearches}
          className="ml-auto text-xs text-muted transition-colors hover:text-foreground"
        >
          Clear all
        </button>
      </div>

      <ul className="flex flex-wrap gap-2">
        {entries.map((entry) => {
          const isClub = entry.kind === 'club';
          return (
            <li key={`${entry.kind}:${entry.tag}`} className="group relative">
              <Link
                href={`/${entry.kind}/${entry.tag}`}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1.5 pl-3 pr-8 text-sm transition-colors hover:border-brand/50"
              >
                {isClub ? (
                  <ClubIcon className="size-3.5 shrink-0" />
                ) : (
                  <PlayersIcon className="size-4 shrink-0" />
                )}
                <span className="max-w-[12rem] truncate font-medium">
                  {entry.name || `#${entry.tag}`}
                </span>
                {entry.name ? (
                  <span className="font-mono text-xs text-muted">#{entry.tag}</span>
                ) : null}
              </Link>

              <button
                type="button"
                aria-label={`Remove ${entry.name || entry.tag}`}
                onClick={() => removeRecentSearch(entry.kind, entry.tag)}
                className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
