"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { TIER_COLOR, TIER_ORDER } from "@/lib/tiers";
import type { Tier } from "@/types/stats";

import { ClassIcon } from "@/components/game-icons";
import { brawlerPath } from "@/lib/slugs";

/** Only what the grid renders — keeps the client payload small. */
export interface BrawlerCardData {
  id: number;
  name: string;
  imageUrl: string;
  /** Null when no source knows it — rendered as nothing, never as "Unknown". */
  className: string | null;
  rarityName: string | null;
  rarityColor: string;
  /** "legacy" brawlers are kept for their history but are not playable. */
  status: "current" | "legacy";
  /**
   * Ranked tier and meta score, or null below the sample floor.
   *
   * This index used to show rarity and class and nothing else — both printed in
   * the game itself — so the page a visitor lands on from "brawl stars
   * brawlers" was a catalogue they could have got from the wiki. The tier is
   * the one thing here nobody else computes, and it belongs on the card that
   * sends people to the brawler.
   */
  tier: Tier | null;
  metaScore: number | null;
}

/** Ordered by in-game progression so the filter row reads naturally. */
const RARITY_ORDER = [
  "Common",
  "Rare",
  "Super Rare",
  "Epic",
  "Mythic",
  "Legendary",
  "Ultra Legendary",
];

/**
 * Sorts built from data the page already has.
 *
 * Ids are release order, which is the one ordering people ask for by name
 * ("what came out last"), and rarity and meta score are both on every card.
 * Unrated brawlers sort last under "Strongest" rather than as zero — "we have
 * not measured this" is not the same claim as "this is bad".
 */
const SORTS = {
  meta: {
    label: "Strongest",
    compare: (a: BrawlerCardData, b: BrawlerCardData) =>
      (b.metaScore ?? -1) - (a.metaScore ?? -1) || a.id - b.id,
  },
  release: {
    label: "Release order",
    compare: (a: BrawlerCardData, b: BrawlerCardData) => a.id - b.id,
  },
  newest: {
    label: "Newest first",
    compare: (a: BrawlerCardData, b: BrawlerCardData) => b.id - a.id,
  },
  name: {
    label: "Name A–Z",
    compare: (a: BrawlerCardData, b: BrawlerCardData) =>
      a.name.localeCompare(b.name),
  },
  rarity: {
    label: "Rarest first",
    compare: (a: BrawlerCardData, b: BrawlerCardData) =>
      rarityRank(b.rarityName) - rarityRank(a.rarityName) || a.id - b.id,
  },
} as const;

type SortKey = keyof typeof SORTS;

/** Unknown rarities sort below every known one rather than above Common. */
function rarityRank(rarity: string | null): number {
  const index = rarity ? RARITY_ORDER.indexOf(rarity) : -1;
  return index === -1 ? -1 : index;
}

/**
 * The brawler index, as a browser rather than as a stack of loose controls.
 *
 * The search box, the two filter rows and the result count used to be four
 * separate things drifting down the page, and the count sat below the panel
 * where it read as a caption for the grid instead of as feedback from the
 * filters. They are one toolbar now: query and sort on top, filters in the
 * middle, and what the filters produced in the footer next to the control that
 * undoes them.
 */
export function BrawlerBrowser({ brawlers }: { brawlers: BrawlerCardData[] }) {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [brawlerClass, setBrawlerClass] = useState("all");
  const [tier, setTier] = useState("all");
  /*
   * Strongest by default, changed 2026-08-28.
   *
   * Release order is a real ordering people ask for by name, but it is not
   * what anyone opens this page to find out — it put Shelly, Colt and Bull in
   * the first row and buried every brawler worth picking four screens down.
   * The default should answer the question the page is for.
   */
  const [sort, setSort] = useState<SortKey>("meta");
  /* Mobile only. Four pill rows is most of a phone screen before a single
     brawler is visible, and the grid is what people came for. */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchId = useId();
  const filtersId = useId();

  const rarities = useMemo(() => {
    const present = new Set(
      brawlers.map((b) => b.rarityName).filter((r): r is string => Boolean(r)),
    );
    const known = RARITY_ORDER.filter((r) => present.has(r));
    const extra = [...present].filter((r) => !RARITY_ORDER.includes(r)).sort();
    return [...known, ...extra];
  }, [brawlers]);

  const classes = useMemo(
    () =>
      [
        ...new Set(
          brawlers
            .map((b) => b.className)
            .filter((c): c is string => Boolean(c)),
        ),
      ].sort(),
    [brawlers],
  );

  const tiers = useMemo(
    () => TIER_ORDER.filter((t) => brawlers.some((b) => b.tier === t)),
    [brawlers],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return brawlers
      .filter(
        (b) =>
          (!q || b.name.toLowerCase().includes(q)) &&
          (rarity === "all" || b.rarityName === rarity) &&
          (brawlerClass === "all" || b.className === brawlerClass) &&
          (tier === "all" || b.tier === tier),
      )
      .sort(SORTS[sort].compare);
  }, [brawlers, query, rarity, brawlerClass, tier, sort]);

  const filtered =
    query.trim() !== "" ||
    rarity !== "all" ||
    brawlerClass !== "all" ||
    tier !== "all";

  /* The heading counts current brawlers and the footer counted every row, so
     the page showed 106 and 107 a few centimetres apart with nothing saying
     why. Reconciled here rather than by hiding one of them: both numbers are
     true and the difference is the withdrawn brawlers. */
  const playable = brawlers.filter((b) => b.status !== "legacy").length;
  const legacy = brawlers.length - playable;

  /* Only the pill rows count — the search box stays visible, so it would read
     as an uncounted filter. */
  const activeFilters = [rarity, brawlerClass, tier].filter(
    (v) => v !== "all",
  ).length;

  const reset = () => {
    setQuery("");
    setRarity("all");
    setBrawlerClass("all");
    setTier("all");
  };

  return (
    <div>
      <div className="card overflow-hidden">
        {/* Query and sort. The field is the loudest control in the toolbar
            because typing a name is what almost everyone does here. */}
        <div className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="group relative min-w-0 flex-1">
            <label htmlFor={searchId} className="sr-only">
              Search brawlers by name
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted transition-colors group-focus-within:text-brand"
            />
            <input
              id={searchId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brawlers"
              type="search"
              autoComplete="off"
              className="min-h-12 w-full rounded-xl border border-border-strong/70 bg-surface-2 py-2 pl-11 pr-10 text-base outline-none transition-colors placeholder:text-muted/60 focus:border-brand/70"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-t border-border p-3 sm:p-4">
          <FilterRow
            label="Sort"
            options={Object.keys(SORTS)}
            value={sort}
            onChange={(next) => setSort(next as SortKey)}
            includeAll={false}
            labelFor={(key) => SORTS[key as SortKey].label}
          />
          {/* Phones only: desktop has the room and hiding controls there would
              be worse than the height they cost. */}
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls={filtersId}
            className="inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-border-strong/70 bg-surface-2 px-3 text-sm font-semibold transition-colors hover:border-brand/60 sm:hidden"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal aria-hidden className="size-4 text-muted" />
              Filters
              {activeFilters > 0 ? (
                <span className="rounded-full bg-brand px-1.5 text-xs font-bold tabular-nums text-black">
                  {activeFilters}
                </span>
              ) : null}
            </span>
            <ChevronDown
              aria-hidden
              className={`size-4 text-muted duration-200 motion-safe:transition-transform ${
                filtersOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <div
            id={filtersId}
            className={`space-y-2 ${filtersOpen ? "block" : "hidden"} sm:block`}
          >
            {tiers.length > 0 ? (
              <FilterRow
                label="Tier"
                options={tiers}
                value={tier}
                onChange={setTier}
                renderIcon={(option) => (
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: TIER_COLOR[option as Tier] }}
                  />
                )}
              />
            ) : null}
            <FilterRow
              label="Rarity"
              options={rarities}
              value={rarity}
              onChange={setRarity}
            />
            <FilterRow
              label="Class"
              options={classes}
              value={brawlerClass}
              onChange={setBrawlerClass}
              /* The class marks are distinctive enough to be recognised before
                 the word is read, which is most of the point of a filter row. */
              renderIcon={(option) => (
                <ClassIcon name={option} className="size-4" />
              )}
            />
          </div>
        </div>

        {/* Feedback from the filters, next to the control that undoes them. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border bg-surface-2/40 px-3 py-2.5 sm:px-4">
          <p className="text-sm text-muted">
            <strong className="font-bold tabular-nums text-foreground">
              {visible.length}
            </strong>{" "}
            {visible.length === 1 ? "brawler" : "brawlers"}
            {filtered ? ` of ${brawlers.length}` : null}
            {!filtered && legacy > 0 ? (
              <>
                {" "}
                &middot; {playable} currently playable, {legacy} withdrawn
              </>
            ) : null}
          </p>
          {filtered ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-sm text-muted">No brawlers match those filters.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-muted transition-colors hover:border-brand/50 hover:text-foreground"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((brawler, index) => (
            <li key={brawler.id}>
              {/* Ten covers the first two rows at every breakpoint. Below that
                  the browser's own lazy loading is right — the roster is 107
                  portraits and fetching them all on load is worse than the
                  wait it saves. */}
              <BrawlerCard brawler={brawler} eager={index < 10} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One brawler.
 *
 * The portrait and the name are the card; everything else is one quiet line
 * underneath. Star power and gadget counts used to sit below that, and they
 * are the same two numbers on almost every brawler — three lines of chrome
 * that pushed the portrait down and made a two-column phone layout tall enough
 * to fit four cards on a screen.
 */
function BrawlerCard({
  brawler,
  eager,
}: {
  brawler: BrawlerCardData;
  eager: boolean;
}) {
  // Not prefetched: the full roster is 106 links on one grid. See the map
  // catalogue for the same reasoning at more length.
  return (
    <Link
      href={brawlerPath(brawler.id, brawler.name)}
      prefetch={false}
      className="card card-interactive group relative flex h-full flex-col overflow-hidden p-2.5 sm:p-3"
      style={{
        borderColor: `color-mix(in srgb, ${brawler.rarityColor} 32%, transparent)`,
      }}
    >
      {/* The rarity reads off the plate behind the portrait as well as off the
          label, so a Legendary is recognisable before anything is read. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-70"
        style={{
          background: `radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, ${brawler.rarityColor} 22%, transparent), transparent 70%)`,
        }}
      />

      {brawler.status === "legacy" ? (
        <span
          className="absolute left-2 top-2 z-10 rounded-md bg-surface-3/90 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted"
          title="No longer available in the game. Kept for its history."
        >
          Legacy
        </span>
      ) : null}

      <Image
        src={brawler.imageUrl}
        alt={brawler.name}
        width={140}
        height={140}
        sizes="(max-width: 640px) 45vw, 180px"
        className="relative mx-auto aspect-square w-full max-w-[7rem] object-contain duration-200 group-hover:scale-105 motion-safe:transition-transform"
        /* The cards above the fold used to come in blank for a second or two:
           `next/image` lazy-loads by default, and the portrait IS the card. */
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        unoptimized
      />

      <p className="relative mt-1.5 truncate text-center font-bold capitalize">
        {brawler.name.toLowerCase()}
      </p>

      {/*
        Rarity carries the colour, class stays quiet — but on two lines rather
        than one. Squeezed side by side, "Super Rare · Damage Dealer" did not
        fit a five-across cell and truncated to "Super Ra… Damage Deal…", which
        is the wrong way round: the *widest* layout was the one that could not
        show its labels. Wrapping costs a line of height and lets every label
        say what it is at every breakpoint.
      */}
      {brawler.tier ? (
        /* Corner chip, matching the profile grid and the tier list, so the
           same letter always means the same thing across the site. */
        <span
          className="absolute right-1.5 top-1.5 z-10 grid size-5 place-items-center rounded-md text-[0.625rem] font-black"
          style={{
            background: `color-mix(in srgb, ${TIER_COLOR[brawler.tier]} 18%, transparent)`,
            color: TIER_COLOR[brawler.tier],
          }}
          title={`${brawler.tier} tier in Ranked${
            brawler.metaScore !== null
              ? `, meta score ${brawler.metaScore.toFixed(1)}`
              : ""
          }`}
        >
          {brawler.tier}
        </span>
      ) : null}

      <div className="relative mt-1 flex min-w-0 flex-col items-center gap-0.5 text-xs">
        {brawler.rarityName ? (
          <span
            className="max-w-full truncate font-semibold"
            style={{ color: brawler.rarityColor }}
          >
            {brawler.rarityName}
          </span>
        ) : null}
        {/* Omitted rather than shown as a placeholder when unknown. */}
        {brawler.className ? (
          <span className="inline-flex max-w-full min-w-0 items-center gap-1 text-muted">
            <ClassIcon name={brawler.className} className="size-3.5 shrink-0" />
            <span className="truncate">{brawler.className}</span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * A labelled row of pills, used for every control on this page.
 *
 * `includeAll` and `labelFor` are what let sort join the row rather than stay a
 * native select: sort has no "all", and its values are keys that need friendly
 * labels. Four sort options fit in a pill row comfortably, and the page then
 * has one control idiom instead of two.
 */
function FilterRow({
  label,
  options,
  value,
  onChange,
  renderIcon,
  includeAll = true,
  labelFor,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
  /** Optional artwork for a pill. Returning null just leaves the label. */
  renderIcon?: (option: string) => React.ReactNode;
  /** Filters lead with "All"; a one-of-N choice like sort does not. */
  includeAll?: boolean;
  /** Maps a value to its pill text, for options that are keys. */
  labelFor?: (option: string) => string;
}) {
  return (
    /* The label sits above the pills on a phone: a fixed label column plus a
       scrolling pill row left roughly 250px for the pills at 320px wide, which
       is two of them. */
    <div className="sm:flex sm:items-center sm:gap-3">
      <span
        id={`filter-${label}`}
        className="block shrink-0 text-xs font-semibold uppercase tracking-wide text-muted sm:w-12"
      >
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`filter-${label}`}
        className="-mx-3 mt-1.5 flex items-center gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:mt-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
      >
        {(includeAll ? ["all", ...options] : options).map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
                active
                  ? "bg-brand text-brand-ink"
                  : "border border-border bg-surface-2/60 text-muted hover:border-border-strong hover:text-foreground"
              }`}
            >
              {option === "all" ? null : renderIcon?.(option)}
              {option === "all" ? "All" : (labelFor?.(option) ?? option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
