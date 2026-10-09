'use client';

import { useEffect, useState } from 'react';

import {
  type CachedRoster,
  type OwnedBrawler,
  type OwnedFilter,
  isStale,
  readFilter,
  readRoster,
  readHide,
  readTag,
  writeRoster,
} from '@/lib/bubble-account';

/**
 * The configured account, if there is one.
 *
 * Settings come from the Android app, which writes them into this WebView's
 * storage before the page loads. Nothing here asks for them, and nothing here
 * fails without them: `owned` stays null and every caller falls back to the
 * global list, which is exactly how the overlay behaved before.
 *
 * The roster is cached for a day and refreshed in the background. A stale
 * cache is served immediately rather than awaited, because the panel is opened
 * mid-draft and a spinner in front of the tier list is worse than a roster
 * that is a few hours behind — the thing it decides is whether you own a
 * brawler, which does not change on the timescale of a match.
 */
export interface BubbleAccount {
  tag: string | null;
  name: string | null;
  /** The player's in-game icon URL, once a roster is known. */
  iconUrl: string | null;
  filter: OwnedFilter;
  /** Remove what cannot be fielded instead of dimming it. */
  hide: boolean;
  /** Null until a roster is known — and permanently null with no tag set. */
  owned: Map<number, OwnedBrawler> | null;
}

const NONE: BubbleAccount = {
  tag: null,
  name: null,
  iconUrl: null,
  filter: 'all',
  hide: false,
  owned: null,
};

function toMap(roster: CachedRoster): Map<number, OwnedBrawler> {
  return new Map(roster.brawlers.map((b) => [b.id, b]));
}

export function useBubbleAccount(): BubbleAccount {
  const [account, setAccount] = useState<BubbleAccount>(NONE);

  useEffect(() => {
    const tag = readTag();
    if (!tag) return;

    const filter = readFilter();
    const hide = readHide();
    const cached = readRoster(tag);

    /*
     * Show what we have first. Correctness here is "do they own it", and a
     * day-old answer to that is right far more often than a blank one.
     *
     * Hydrating from a browser-only store, so it must happen after mount:
     * localStorage does not exist on the server and reading it during render
     * would make the two disagree. The rule below is aimed at state derived
     * from props, which this is not.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccount(
      cached
        ? { tag, name: cached.name, iconUrl: cached.iconUrl ?? null, filter, hide, owned: toMap(cached) }
        : { tag, name: null, iconUrl: null, filter, hide, owned: null },
    );
    if (cached && !isStale(cached)) return;

    let cancelled = false;
    fetch(`/api/bubble/roster?tag=${encodeURIComponent(tag)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { tag: string; name: string; iconUrl?: string; brawlers: OwnedBrawler[] } | null) => {
        if (cancelled || !data?.brawlers) return;
        const roster: CachedRoster = { ...data, fetchedAt: Date.now() };
        writeRoster(roster);
        setAccount({
          tag,
          name: data.name,
          iconUrl: data.iconUrl ?? null,
          filter,
          hide,
          owned: toMap(roster),
        });
      })
      .catch(() => {
        /* Keep whatever was cached. A failed refresh is not a reason to stop
           filtering with yesterday's perfectly good answer. */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return account;
}
