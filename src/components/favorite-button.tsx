'use client';

import { Star } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import {
  readFavorites,
  serverFavorites,
  subscribeFavorites,
  toggleFavorite,
  type FavoriteKind,
} from '@/lib/favorites';

interface Props {
  kind: FavoriteKind;
  tag: string;
  name: string;
}

/**
 * Save toggle for a player or club.
 *
 * `useSyncExternalStore` is the right tool here: localStorage is an external
 * store, and this keeps the server snapshot (empty) separate from the client
 * one so hydration matches without any state-setting effect.
 */
export function FavoriteButton({ kind, tag, name }: Props) {
  const favorites = useSyncExternalStore(
    subscribeFavorites,
    readFavorites,
    serverFavorites,
  );
  const saved = favorites.some((f) => f.kind === kind && f.tag === tag);

  return (
    <button
      type="button"
      onClick={() => toggleFavorite({ kind, tag, name })}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      title={saved ? 'Saved — click to remove' : 'Save to favourites'}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
        saved
          ? 'border-brand/50 bg-brand/15 text-brand'
          : 'border-border bg-surface-2 text-muted hover:border-brand/40 hover:text-foreground'
      }`}
    >
      <Star className={`size-4 ${saved ? 'fill-current' : ''}`} />
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}
