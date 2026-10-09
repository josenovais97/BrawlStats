'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * A brawler's most-owned build, as a card under whatever was tapped.
 *
 * Shared by the Meta tab and Team comp: tap a brawler in a tier strip, a map
 * pick or a trio, and the same card opens with the same numbers. Fetched per
 * brawler rather than shipped with the page, and cached for the life of the
 * panel, because the same few names get tapped again and again in one draft.
 */

/** What the card needs to name the brawler it is about. */
export interface BuildBrawler {
  brawlerId: number;
  brawlerName: string;
  imageUrl: string;
}

interface BuildItem {
  itemId: number;
  name: string;
  imageUrl: string | null;
  share: number;
}

interface BuildResponse {
  brawlerId: number;
  owners: number;
  gears: BuildItem[];
  starPower: BuildItem | null;
  gadget: BuildItem | null;
}

/**
 * Which brawler's build is open, its fetched build, and a ref that brings the
 * card into view.
 *
 * The card renders under everything else, which in a 375dp-tall landscape
 * window is well below the fold: a tap that lit a ring and showed nothing
 * looked like a tap that did nothing. So it scrolls into view on open, and
 * again once the fetch turns a one-line placeholder into the full card.
 */
export function useBuildCard<T extends BuildBrawler>() {
  const [open, setOpen] = useState<T | null>(null);
  const [builds, setBuilds] = useState<Record<number, BuildResponse | 'error'>>({});
  const cardRef = useRef<HTMLElement | null>(null);

  const openId = open?.brawlerId ?? null;
  const loaded = openId !== null && builds[openId] !== undefined;

  useEffect(() => {
    if (openId === null) return;
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [openId, loaded]);

  const toggle = (entry: T) => {
    setOpen((prev) => (prev?.brawlerId === entry.brawlerId ? null : entry));
    if (builds[entry.brawlerId]) return;

    fetch(`/api/v1/brawler-build/${entry.brawlerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: BuildResponse) => setBuilds((prev) => ({ ...prev, [entry.brawlerId]: data })))
      .catch(() => setBuilds((prev) => ({ ...prev, [entry.brawlerId]: 'error' })));
  };

  return {
    open,
    build: open ? builds[open.brawlerId] : undefined,
    cardRef,
    toggle,
    close: () => setOpen(null),
  };
}

export function BuildCard({
  ref,
  entry,
  build,
}: {
  ref: React.Ref<HTMLElement>;
  entry: BuildBrawler;
  build: BuildResponse | 'error' | undefined;
}) {
  return (
    <section ref={ref} className="bz-panel mt-2 overflow-hidden scroll-mt-2">
      <header className="flex items-center gap-2 border-b border-border px-2.5 py-2">
        <Image
          src={entry.imageUrl}
          alt=""
          width={28}
          height={28}
          className="size-7 shrink-0 rounded-md bg-surface-2"
          unoptimized
        />
        <span className="min-w-0 flex-1 truncate text-sm font-bold capitalize">
          {entry.brawlerName.toLowerCase()}
        </span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Most owned
        </span>
      </header>

      {build === undefined ? (
        <p className="px-2.5 py-3 text-xs text-muted">Reading builds…</p>
      ) : build === 'error' || build.owners === 0 ? (
        <p className="px-2.5 py-3 text-xs leading-relaxed text-muted">
          No sampled player owns this brawler yet, so there is nothing to measure.
        </p>
      ) : (
        <div className="space-y-1.5 p-2.5">
          {build.starPower ? <BuildRow item={build.starPower} kind="Star power" /> : null}
          {build.gadget ? <BuildRow item={build.gadget} kind="Gadget" /> : null}
          {build.gears.map((gear) => (
            <BuildRow key={gear.itemId} item={gear} kind="Gear" />
          ))}

          {build.gears.length === 0 && !build.starPower && !build.gadget ? (
            <p className="text-xs leading-relaxed text-muted">
              Nothing unlocked on this brawler across the sampled pool yet.
            </p>
          ) : null}

          {/*
            The caveat has to travel with the numbers.

            Owners tend to hold both star powers and both gadgets, so those two
            rows usually sit near 50% — which is the honest reading of a pair
            everybody owns, not a recommendation. The share is printed rather
            than the row being hidden, so a tie looks like a tie. Gears are the
            genuine choice: two from nineteen, paid for in coins.
          */}
          <p className="pt-1 text-[10px] leading-relaxed text-muted">
            Across {build.owners.toLocaleString('en-US')} sampled owners. Ownership, not
            usage — the game publishes no record of what was taken into a match, so a
            near-50% share means owners hold both.
          </p>
        </div>
      )}
    </section>
  );
}

function BuildRow({ item, kind }: { item: BuildItem; kind: string }) {
  return (
    <div className="flex items-center gap-2">
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt=""
          width={24}
          height={24}
          className="size-6 shrink-0"
          unoptimized
        />
      ) : (
        <span className="size-6 shrink-0 rounded bg-surface-2" />
      )}
      <span className="min-w-0 flex-1">
        {/* The official catalogue publishes gear names in caps ("DAMAGE"),
            which reads as shouting next to sentence-case ability names. */}
        <span className="block truncate text-xs font-semibold capitalize">
          {item.name.toLowerCase()}
        </span>
        <span className="block text-[10px] text-muted">{kind}</span>
      </span>
      <span className="shrink-0 text-xs font-bold tabular-nums text-brand">
        {Math.round(item.share * 100)}%
      </span>
    </div>
  );
}

