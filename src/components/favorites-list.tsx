'use client';

import { Shield, Star, User, X } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import {
  clearFavorites,
  readFavorites,
  removeFavorite,
  serverFavorites,
  subscribeFavorites,
} from '@/lib/favorites';

/**
 * Saved players and clubs. Renders nothing until mounted and nothing when
 * empty, so the homepage does not show a hollow section to first-time users.
 */
export function FavoritesList() {
  const entries = useSyncExternalStore(
    subscribeFavorites,
    readFavorites,
    serverFavorites,
  );

  if (entries.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rule mt-1" aria-hidden />
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Saved</h2>
            <p className="mt-1 text-sm text-muted">
              Profiles you keep an eye on, stored on this device.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearFavorites}
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          Clear all
        </button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => {
          const Icon = entry.kind === 'player' ? User : Shield;
          return (
            <li key={`${entry.kind}:${entry.tag}`} className="group relative">
              <Link
                href={`/${entry.kind}/${entry.tag}`}
                className="card card-interactive flex items-center gap-3 p-3 pr-10"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 ${
                    entry.kind === 'player' ? 'text-brand' : 'text-accent'
                  }`}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {entry.name || `#${entry.tag}`}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted">
                    #{entry.tag}
                  </span>
                </span>
                <Star className="size-4 shrink-0 fill-current text-brand" />
              </Link>

              <button
                type="button"
                aria-label={`Remove ${entry.name || entry.tag} from favourites`}
                onClick={() => removeFavorite(entry.kind, entry.tag)}
                className="absolute right-2 top-2 grid size-6 place-items-center rounded-md text-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
