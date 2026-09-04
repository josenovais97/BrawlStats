'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { TIER_COLOR, TIER_ORDER } from '@/lib/tiers';
import type { Tier } from '@/types/stats';

/**
 * The panel's tier list, with a mode filter.
 *
 * Every mode's list is rendered by the server and switched here in the client,
 * rather than each filter being its own URL as it is on the site. Two reasons,
 * both particular to an overlay.
 *
 * Reading the mode from `searchParams` would opt the route out of caching
 * entirely — the trap that cost this project a month of Vercel allowance — and
 * one cached URL is the whole reason the panel is cheap to serve.
 *
 * And a filter used mid-draft cannot cost a page load. The reader has seconds
 * and is on mobile data with the game running underneath; a tap that swaps
 * arrays already in memory is the difference between a tool and a nuisance.
 * The payload is trimmed to what the panel draws — id, name, score, art — so
 * carrying every mode at once costs tens of kilobytes, not hundreds.
 */

export interface PanelEntry {
  brawlerId: number;
  brawlerName: string;
  metaScore: number | null;
  tier: Tier;
  imageUrl: string;
}

/** One brawler's record on one Ranked map. */
export interface PanelMapPick {
  brawlerId: number;
  brawlerName: string;
  imageUrl: string;
  /** Baseline-adjusted, shrunk. What the ordering uses. */
  score: number;
  /** The same brawler's form across all Ranked maps, for the delta. */
  overallScore: number;
  /** Decided battles sampled on this map. */
  battles: number;
}

export interface PanelMap {
  mapName: string;
  mode: string;
  picks: PanelMapPick[];
}

export interface PanelMode {
  /** The API's mode key, or `null` for the combined list. */
  key: string | null;
  label: string;
  entries: PanelEntry[];
  /** Ranked maps in this mode. Empty on the combined list. */
  maps: PanelMap[];
}

/**
 * Brawlers drawn per tier.
 *
 * Eight fits one row at the panel's landscape width and two in portrait, which
 * keeps every tier visible in a window only ~370dp tall when the phone is held
 * the way the game is played. D holds forty-odd; drawing them all would push S
 * off the top of the screen to show the brawlers nobody is choosing.
 */
const SHOWN_PER_TIER = 8;

/** Where the last-used mode is kept between openings. */
const STORED_MODE = 'brawlzone.bubble.mode';
const STORED_MAP = 'brawlzone.bubble.map';

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

/** Writes a preference, or clears it, and never lets storage break the panel. */
function remember(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked site data both throw. Keeping a choice
    // between openings is a convenience, never a requirement.
  }
}

export function PanelTiers({ modes }: { modes: PanelMode[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [map, setMap] = useState<string | null>(null);

  /*
   * The choice outlives the panel.
   *
   * Every tap on the bubble builds a fresh WebView, so without this the filter
   * reset to All each time it opened — and someone queueing Knockout all
   * evening would re-pick Knockout on every single draft. Read in an effect
   * rather than in the initial state so the server and client render the same
   * markup on the first pass.
   */
  useEffect(() => {
    try {
      const savedMap = window.localStorage.getItem(STORED_MAP);
      const saved = window.localStorage.getItem(STORED_MODE);
      if (!saved || !modes.some((m) => m.key === saved)) return;

      /*
       * Reading a browser store is the "synchronise with an external system"
       * case effects exist for: the value cannot be known during render, and
       * seeding it into initial state instead would make the server and the
       * client disagree about which chip is pressed. It runs once, so the
       * cascading render the rule guards against is a single extra pass.
       */
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(saved);

      const mode = modes.find((m) => m.key === saved);
      if (savedMap && mode?.maps.some((m) => m.mapName === savedMap)) setMap(savedMap);
    } catch {
      // Private windows and blocked site data both throw on access. A filter
      // that starts on All is a fine outcome; a panel that fails to render is
      // not.
    }
  }, [modes]);

  const choose = (key: string | null) => {
    setActive(key);
    // A map belongs to a mode; carrying it across would show Brawl Ball picks
    // under a Knockout heading.
    setMap(null);
    remember(STORED_MODE, key);
    remember(STORED_MAP, null);
  };

  const chooseMap = (name: string | null) => {
    setMap(name);
    remember(STORED_MAP, name);
  };

  const current = modes.find((m) => m.key === active) ?? modes[0];
  const currentMap = current.maps.find((m) => m.mapName === map) ?? null;

  /*
   * The tapped brawler's build, fetched rather than pre-rendered.
   *
   * Cached per brawler for the life of the panel, because the same few names
   * get tapped repeatedly across a draft and a second request would show a
   * spinner for something already on screen a moment ago.
   */
  const [open, setOpen] = useState<PanelEntry | null>(null);
  const [builds, setBuilds] = useState<Record<number, BuildResponse | 'error'>>({});
  const cardRef = useRef<HTMLElement | null>(null);

  /*
   * Bring the card into view when it opens.
   *
   * It renders under all five tier strips, which in a 375dp-tall landscape
   * window puts it well below the fold: tapping a brawler in S tier lit up the
   * ring and, as far as the reader could tell, did nothing at all. The panel is
   * the one place this matters most — it is glanced at mid-draft, and a result
   * that needs to be scrolled for is a result that is missed.
   *
   * Keyed on the loaded build as well as the id, so it scrolls again once the
   * fetch turns a one-line placeholder into the full card and the target has
   * moved.
   */
  const openId = open?.brawlerId ?? null;
  const loaded = openId !== null && builds[openId] !== undefined;

  useEffect(() => {
    if (openId === null) return;
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [openId, loaded]);

  const show = (entry: PanelEntry) => {
    setOpen((prev) => (prev?.brawlerId === entry.brawlerId ? null : entry));
    if (builds[entry.brawlerId]) return;

    fetch(`/api/v1/brawler-build/${entry.brawlerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: BuildResponse) =>
        setBuilds((prev) => ({ ...prev, [entry.brawlerId]: data })),
      )
      .catch(() => setBuilds((prev) => ({ ...prev, [entry.brawlerId]: 'error' })));
  };

  const byTier = new Map<Tier, PanelEntry[]>();
  for (const entry of current.entries) {
    const bucket = byTier.get(entry.tier) ?? [];
    bucket.push(entry);
    byTier.set(entry.tier, bucket);
  }

  return (
    <>
      {/*
        Wraps rather than scrolling sideways. The site can afford a horizontal
        chip rail because the page scrolls under a finger that started on it;
        here a sideways scroller sits inside a vertically scrolling panel, and
        a drag claimed by the wrong axis is what made the panel feel stuck.
      */}
      <div role="group" aria-label="Game mode" className="flex flex-wrap gap-1 px-1 pb-2 text-[11px]">
        {modes.map((mode) => {
          const on = mode.key === current.key;
          return (
            <button
              key={mode.key ?? 'all'}
              type="button"
              onClick={() => choose(mode.key)}
              aria-pressed={on}
              className={`rounded-md border px-1.5 py-1 font-bold leading-tight transition-colors ${
                on
                  ? 'border-brand/40 bg-brand/10 text-brand'
                  : 'border-border bg-surface text-muted'
              }`}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      {/*
        The map row, and the reason this panel is worth opening mid-draft.

        A mode is too coarse to draft on: Ranked gives you one map out of that
        mode's pool and the answer changes with it, so filtering to Knockout
        still left the reader holding the average of five different maps. The
        maps only appear once a mode is chosen — the full pool is around thirty,
        which is more chips than a 375dp-tall window can show without becoming
        the whole panel.
      */}
      {current.maps.length > 0 ? (
        <div role="group" aria-label="Map" className="flex flex-wrap gap-1 px-1 pb-2 text-[11px]">
          <button
            type="button"
            onClick={() => chooseMap(null)}
            aria-pressed={currentMap === null}
            className={`rounded-md border px-1.5 py-1 font-bold leading-tight transition-colors ${
              currentMap === null
                ? 'border-accent-2/50 bg-accent-2/10 text-accent-2'
                : 'border-border bg-surface text-muted'
            }`}
          >
            All maps
          </button>

          {current.maps.map((m) => {
            const on = currentMap?.mapName === m.mapName;
            return (
              <button
                key={m.mapName}
                type="button"
                onClick={() => chooseMap(m.mapName)}
                aria-pressed={on}
                className={`rounded-md border px-1.5 py-1 font-bold leading-tight transition-colors ${
                  on
                    ? 'border-accent-2/50 bg-accent-2/10 text-accent-2'
                    : 'border-border bg-surface text-muted'
                }`}
              >
                {m.mapName}
              </button>
            );
          })}
        </div>
      ) : null}

      {currentMap ? (
        <MapPicks map={currentMap} onPick={show} openId={openId} />
      ) : current.entries.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-muted">
          Not enough sampled Ranked battles in {current.label.toLowerCase()} yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {TIER_ORDER.map((tier) => {
            const entries = byTier.get(tier) ?? [];
            if (entries.length === 0) return null;
            return (
              <TierStrip
                key={tier}
                tier={tier}
                entries={entries}
                onPick={show}
                openId={openId}
              />
            );
          })}
        </ul>
      )}

      {open ? (
        <BuildCard ref={cardRef} entry={open} build={builds[open.brawlerId]} />
      ) : null}
    </>
  );
}

function TierStrip({
  tier,
  entries,
  onPick,
  openId,
}: {
  tier: Tier;
  entries: PanelEntry[];
  onPick: (entry: PanelEntry) => void;
  openId: number | null;
}) {
  const color = TIER_COLOR[tier];

  return (
    <li className="card overflow-hidden">
      <div className="flex items-stretch">
        {/* The same lit band the site's tier rows use, at panel scale. */}
        <div
          className="flex w-9 shrink-0 flex-col items-center justify-center gap-0.5 py-1.5"
          style={{
            background: `linear-gradient(155deg, color-mix(in srgb, ${color} 52%, transparent) 0%, color-mix(in srgb, ${color} 14%, transparent) 65%, transparent 100%)`,
            boxShadow: `inset -1px 0 0 color-mix(in srgb, ${color} 45%, transparent)`,
          }}
        >
          <span
            className="text-xl font-black leading-none"
            style={{ color, textShadow: `0 0 18px color-mix(in srgb, ${color} 60%, transparent)` }}
          >
            {tier}
          </span>
          <span className="text-[10px] font-bold tabular-nums text-muted">{entries.length}</span>
        </div>

        <div className="flex flex-1 flex-wrap content-start gap-x-1.5 gap-y-1 p-1.5">
          {entries.slice(0, SHOWN_PER_TIER).map((entry) => (
            <button
              key={entry.brawlerId}
              type="button"
              onClick={() => onPick(entry)}
              aria-pressed={openId === entry.brawlerId}
              className="w-10 text-center"
            >
              <Image
                src={entry.imageUrl}
                alt={entry.brawlerName}
                width={40}
                height={40}
                className={`size-10 rounded-lg bg-surface-2 transition-shadow ${
                  openId === entry.brawlerId ? 'ring-2 ring-brand' : ''
                }`}
                loading="lazy"
                unoptimized
              />
              <p className="truncate text-[9px] font-semibold capitalize leading-tight">
                {entry.brawlerName.toLowerCase()}
              </p>
              <p className="text-[10px] font-black tabular-nums leading-none" style={{ color }}>
                {entry.metaScore?.toFixed(1) ?? '–'}
              </p>
            </button>
          ))}

          {entries.length > SHOWN_PER_TIER ? (
            <span className="self-center px-1 text-[10px] font-semibold text-muted">
              +{entries.length - SHOWN_PER_TIER}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * What owners of this brawler have unlocked.
 *
 * Deliberately not called "most used". The game's API publishes what a player
 * *owns* on a brawler and nothing about what they took into a match — there is
 * no usage field anywhere in the player or battle payloads — so a card headed
 * "most used build" would be describing a measurement nobody has.
 *
 * Star power, gadget and two gears — the shape of an actual loadout. The two
 * abilities are usually near 50%, because owners hold both, and the share is
 * printed rather than the row hidden so that reads as the tie it is. Gears are
 * the part that is genuinely a choice: two from nineteen, paid for in coins,
 * so what owners bought is a revealed preference worth ranking.
 */
function BuildCard({
  ref,
  entry,
  build,
}: {
  ref: React.Ref<HTMLElement>;
  entry: PanelEntry;
  build: BuildResponse | 'error' | undefined;
}) {
  return (
    <section ref={ref} className="card mt-2 overflow-hidden scroll-mt-2">
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

/**
 * The best picks on one map, ranked.
 *
 * A list rather than tier bands. Tiers are a way of grouping ninety brawlers
 * into something readable; on a single map there are ten names and an order,
 * and the order is the answer — a reader mid-draft wants "who is best here",
 * not "who is roughly in the same bracket here".
 *
 * The delta against the brawler's own Ranked form is the only genuinely
 * map-specific claim on the row, so it is the thing given colour. A brawler
 * that is strong everywhere is not a map pick; one that is better *here* than
 * it usually is, is.
 */
function MapPicks({
  map,
  onPick,
  openId,
}: {
  map: PanelMap;
  onPick: (entry: PanelEntry) => void;
  openId: number | null;
}) {
  if (map.picks.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs leading-relaxed text-muted">
        No brawler is clearly above average on {map.mapName} yet. It fills in as the sampler
        works through more battles here.
      </p>
    );
  }

  return (
    <ol className="card divide-y divide-border overflow-hidden">
      {map.picks.map((pick, index) => {
        const edge = pick.score - pick.overallScore;
        return (
          <li key={pick.brawlerId}>
            <button
              type="button"
              onClick={() =>
                onPick({
                  brawlerId: pick.brawlerId,
                  brawlerName: pick.brawlerName,
                  metaScore: null,
                  tier: 'S',
                  imageUrl: pick.imageUrl,
                })
              }
              aria-pressed={openId === pick.brawlerId}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
            >
              <span
                aria-hidden
                className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-black tabular-nums ${
                  index === 0
                    ? 'bg-brand text-brand-ink'
                    : index === 1
                      ? 'bg-surface-3 text-foreground'
                      : index === 2
                        ? 'bg-[#8a5a2b] text-[#ffe6c7]'
                        : 'text-muted'
                }`}
              >
                {index + 1}
              </span>

              <Image
                src={pick.imageUrl}
                alt=""
                width={30}
                height={30}
                className={`size-[30px] shrink-0 rounded-md bg-surface-2 ${
                  openId === pick.brawlerId ? 'ring-2 ring-brand' : ''
                }`}
                loading="lazy"
                unoptimized
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold capitalize leading-tight">
                  {pick.brawlerName.toLowerCase()}
                </span>
                {/* Sample size is never hidden: on a per-map split it is the
                    difference between a signal and a coin flip. */}
                <span className="block text-[10px] tabular-nums leading-tight text-muted">
                  {pick.battles} battles here
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span className="block text-[11px] font-black tabular-nums leading-tight text-victory">
                  {(pick.score * 100).toFixed(1)}%
                </span>
                <span
                  className={`block text-[10px] tabular-nums leading-tight ${
                    edge >= 0.005 ? 'text-victory/80' : 'text-muted'
                  }`}
                >
                  {edge >= 0.005 ? '+' : edge <= -0.005 ? '−' : '±'}
                  {Math.abs(edge * 100).toFixed(1)} vs usual
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
