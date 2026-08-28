'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Check, Link2, RotateCcw, Sparkles } from 'lucide-react';

import { decodeBoard, decodeOrder, encodeBoard } from '@/lib/tier-board';
import { TIER_COLOR, TIER_ORDER } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

export interface MakerBrawler {
  id: number;
  name: string;
  imageUrl: string;
  /** Where the live Ranked list puts it, for the "start from the meta" button. */
  metaTier: Tier | null;
}

/**
 * Build your own tier list.
 *
 * The site's own tier lists are measured — they come from sampled battles and
 * you cannot argue with them. This is the other half: what *you* think, which
 * is the thing people actually want to post and argue about. Both being on the
 * same site is the point, since the measured one is right there to disagree
 * with.
 *
 * Three constraints shaped it.
 *
 * The whole state lives in the URL. That is what makes a tier list shareable
 * without an account, a database row or a single byte of server storage — the
 * link *is* the tier list, so a finished one costs nothing to keep and nothing
 * to serve, and it still works when someone pastes it into a club chat a year
 * from now.
 *
 * Placement is a tap, not a drag. HTML5 drag-and-drop does not exist on touch,
 * and this is a game whose players are overwhelmingly on phones — so selecting
 * a brawler and then tapping a tier is the primary interaction, and dragging is
 * added on top for people with a mouse who will reach for it anyway.
 *
 * And it opens empty rather than pre-filled. Starting from the live meta is one
 * button away, but starting there by default would make this a page that shows
 * you someone else's answer and invites you to nudge it, which is a different
 * and much less interesting thing than a blank sheet.
 */

/** The pool is a tier too, internally: "not placed yet". */
type Slot = Tier | 'pool';

const ROW_LABEL: Record<Tier, string> = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
};

export function TierMaker({ brawlers }: { brawlers: MakerBrawler[] }) {
  /*
   * The shared board is read here rather than passed down from the page.
   *
   * It used to be decoded on the server, which meant the route read
   * `searchParams` and so was re-rendered per request — a page whose whole
   * state is in the URL, whose board is client-side either way, and which
   * therefore had nothing to gain from being dynamic. Reading it in the
   * browser is what lets the page itself be served from cache.
   */
  const searchParams = useSearchParams();
  const known = useMemo(
    () => new Set(brawlers.map((brawler) => brawler.id)),
    [brawlers],
  );

  const [placed, setPlaced] = useState<Record<number, Tier>>(() =>
    decodeBoard(searchParams, known),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const byId = useMemo(
    () => new Map(brawlers.map((brawler) => [brawler.id, brawler])),
    [brawlers],
  );

  /*
   * Order within a tier is meaningful — the leftmost is the best — so rows
   * keep placement order rather than catalogue order. `placed` is a map, and
   * object key order for integer-like keys is numeric, so the order is carried
   * separately.
   */
  const [order, setOrder] = useState<number[]>(() => decodeOrder(searchParams, known));

  const rows = useMemo(() => {
    const out: Record<Tier, MakerBrawler[]> = { S: [], A: [], B: [], C: [], D: [] };
    for (const id of order) {
      const tier = placed[id];
      const brawler = byId.get(id);
      if (tier && brawler) out[tier].push(brawler);
    }
    return out;
  }, [byId, order, placed]);

  const pool = useMemo(
    () => brawlers.filter((brawler) => !placed[brawler.id]),
    [brawlers, placed],
  );

  const place = useCallback((id: number, tier: Slot) => {
    setPlaced((current) => {
      const next = { ...current };
      if (tier === 'pool') delete next[id];
      else next[id] = tier;
      return next;
    });
    setOrder((current) => [...current.filter((existing) => existing !== id), id]);
    setSelected(null);
    setCopied(false);
  }, []);

  const reset = useCallback(() => {
    setPlaced({});
    setOrder([]);
    setSelected(null);
    setCopied(false);
    // The URL is the document; clearing the board has to clear that too.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const fromMeta = useCallback(() => {
    const next: Record<number, Tier> = {};
    const ids: number[] = [];
    for (const brawler of brawlers) {
      if (!brawler.metaTier) continue;
      next[brawler.id] = brawler.metaTier;
      ids.push(brawler.id);
    }
    setPlaced(next);
    setOrder(ids);
    setSelected(null);
    setCopied(false);
  }, [brawlers]);

  /** Writes the board into the URL and puts that URL on the clipboard. */
  const share = useCallback(async () => {
    const query = encodeBoard(rows);

    const url = query
      ? `${window.location.origin}${window.location.pathname}?${query}`
      : `${window.location.origin}${window.location.pathname}`;

    window.history.replaceState(null, '', url);

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the URL bar now holds it either way.
      setCopied(false);
    }
  }, [rows]);

  const placedCount = Object.keys(placed).length;

  return (
    <div className="space-y-4">
      {/* Controls first: on a phone the board is tall, and a control under it
          is a control nobody finds. */}
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <button
          type="button"
          onClick={share}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink transition-colors hover:bg-brand-strong"
        >
          {copied ? <Check aria-hidden className="size-4" /> : <Link2 aria-hidden className="size-4" />}
          {copied ? 'Link copied' : 'Copy share link'}
        </button>

        <button
          type="button"
          onClick={fromMeta}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3.5 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
        >
          <Sparkles aria-hidden className="size-4" />
          Start from the live meta
        </button>

        <button
          type="button"
          onClick={reset}
          disabled={placedCount === 0}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-semibold text-muted transition-colors enabled:hover:border-brand/50 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:text-muted/40"
        >
          <RotateCcw aria-hidden className="size-4" />
          Clear
        </button>

        <p className="ml-auto text-xs text-muted">
          <span className="font-bold tabular-nums text-foreground">{placedCount}</span>
          {' of '}
          <span className="tabular-nums">{brawlers.length}</span> placed
        </p>
      </div>

      {selected !== null ? (
        <p className="rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2.5 text-sm text-foreground">
          <span className="font-bold capitalize">
            {byId.get(selected)?.name.toLowerCase()}
          </span>{' '}
          selected — now tap a tier to place it.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border">
        {TIER_ORDER.map((tier) => (
          <TierRow
            key={tier}
            tier={tier}
            brawlers={rows[tier]}
            selected={selected}
            onSelect={setSelected}
            onPlace={place}
          />
        ))}
      </div>

      <div>
        <p className="eyebrow mb-2.5">
          Unranked{pool.length > 0 ? ` · ${pool.length}` : ''}
        </p>
        <PoolArea
          brawlers={pool}
          selected={selected}
          onSelect={setSelected}
          onPlace={place}
        />
      </div>
    </div>
  );
}

function TierRow({
  tier,
  brawlers,
  selected,
  onSelect,
  onPlace,
}: {
  tier: Tier;
  brawlers: MakerBrawler[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  onPlace: (id: number, tier: Slot) => void;
}) {
  const [over, setOver] = useState(false);
  const color = TIER_COLOR[tier];

  return (
    <div className="flex border-b border-border last:border-b-0">
      {/* The letter is the drop target as well as the label, so tapping the
          obvious thing does the obvious thing. */}
      <button
        type="button"
        onClick={() => selected !== null && onPlace(selected, tier)}
        aria-label={`Place the selected brawler in ${tier} tier`}
        className="display grid w-14 shrink-0 place-items-center text-2xl transition-opacity sm:w-16 sm:text-3xl"
        style={{
          background: `color-mix(in srgb, ${color} 22%, transparent)`,
          color,
        }}
      >
        {ROW_LABEL[tier]}
      </button>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const id = Number(event.dataTransfer.getData('text/plain'));
          if (Number.isFinite(id) && id > 0) onPlace(id, tier);
        }}
        onClick={() => selected !== null && onPlace(selected, tier)}
        className={`flex min-h-[4.5rem] flex-1 flex-wrap content-start gap-1.5 p-2 transition-colors ${
          over ? 'bg-surface-2' : 'bg-surface/40'
        }`}
      >
        {brawlers.map((brawler) => (
          <Tile
            key={brawler.id}
            brawler={brawler}
            selected={selected === brawler.id}
            onSelect={onSelect}
            // A brawler already in a tier goes back to the pool when tapped
            // twice, which is the only way out of a row.
            onReturn={() => onPlace(brawler.id, 'pool')}
          />
        ))}
      </div>
    </div>
  );
}

function PoolArea({
  brawlers,
  selected,
  onSelect,
  onPlace,
}: {
  brawlers: MakerBrawler[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  onPlace: (id: number, tier: Slot) => void;
}) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const id = Number(event.dataTransfer.getData('text/plain'));
        if (Number.isFinite(id) && id > 0) onPlace(id, 'pool');
      }}
      className={`flex min-h-[5rem] flex-wrap content-start gap-1.5 rounded-2xl border border-border p-2 transition-colors ${
        over ? 'bg-surface-2' : 'bg-surface/40'
      }`}
    >
      {brawlers.length === 0 ? (
        <p className="p-3 text-sm text-muted">
          Every brawler is placed. Tap one in a row to send it back here.
        </p>
      ) : (
        brawlers.map((brawler) => (
          <Tile
            key={brawler.id}
            brawler={brawler}
            selected={selected === brawler.id}
            onSelect={onSelect}
          />
        ))
      )}
    </div>
  );
}

function Tile({
  brawler,
  selected,
  onSelect,
  onReturn,
}: {
  brawler: MakerBrawler;
  selected: boolean;
  onSelect: (id: number | null) => void;
  /** Present only for tiles already in a tier. */
  onReturn?: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', String(brawler.id));
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(event) => {
        // The row underneath is itself a drop target; a tap on a tile is about
        // the tile, not the row.
        event.stopPropagation();
        if (selected) {
          if (onReturn) onReturn();
          else onSelect(null);
          return;
        }
        onSelect(brawler.id);
      }}
      title={
        onReturn
          ? `${brawler.name}: tap to select, tap again to unrank`
          : `${brawler.name}: tap to select, then tap a tier`
      }
      aria-pressed={selected}
      className={`relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-2 transition-transform sm:size-14 ${
        selected ? 'ring-2 ring-brand' : 'hover:-translate-y-0.5'
      }`}
    >
      <Image
        src={brawler.imageUrl}
        alt={brawler.name}
        width={56}
        height={56}
        className="size-full object-cover"
        loading="lazy"
        unoptimized
        draggable={false}
      />
    </button>
  );
}
