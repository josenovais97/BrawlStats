'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { BuildCard, useBuildCard } from '@/components/bubble/panel-build';
import { ModeMapChips, remember, STORED_MAP, STORED_MODE } from '@/components/bubble/panel-chips';
import { panelTrack } from '@/lib/panel-telemetry';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { canField } from '@/lib/bubble-account';
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
  /** Share of this map's sampled battles. How likely it is to be taken. */
  pickRate: number;
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
  /**
   * The mode's own icon, or null for the combined list.
   *
   * On the mode chips, not the map chips. A map layout shrunk to chip size is
   * a smudge nobody can match against the draft screen, while a mode icon is
   * the one picture every player already reads at a glance -- it is the badge
   * the game itself shows in the corner of the draft.
   */
  icon: string | null;
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

/**
 * Map picks shown before "show more".
 *
 * Ten is the useful answer almost always; the rest matter when a draft has
 * eaten the top of the list, which is rare enough that it should not cost
 * everyone else a longer scroll in a panel floating over the game.
 */
const SHOWN_MAP_PICKS = 10;


export function PanelTiers({
  modes,
  windowDays,
}: {
  modes: PanelMode[];
  windowDays: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [map, setMap] = useState<string | null>(null);

  /*
   * Whose roster to filter for, configured in the Android app.
   *
   * Null when nobody has set a tag, which is the state the overlay shipped in:
   * every list then renders exactly as it always did.
   */
  const account = useBubbleAccount();
  const fieldable = (id: number) =>
    account.owned === null || canField(account.owned, id, account.filter);
  /* Only ever true with an account configured, so the unconfigured panel is
     untouched by the setting. */
  const hiding = account.owned !== null && account.hide;

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
    if (name) panelTrack('panel_map', { tab: 'meta', mode: active ?? 'all', map: name });
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
  const { open, build, cardRef, toggle } = useBuildCard<PanelEntry>();
  const show = (entry: PanelEntry) => {
    if (open?.brawlerId !== entry.brawlerId) {
      panelTrack('panel_build', { tab: 'meta', brawler: entry.brawlerName });
    }
    toggle(entry);
  };
  const openId = open?.brawlerId ?? null;

  const byTier = new Map<Tier, PanelEntry[]>();
  for (const entry of current.entries) {
    const bucket = byTier.get(entry.tier) ?? [];
    bucket.push(entry);
    byTier.set(entry.tier, bucket);
  }

  return (
    <>
      {/* Belongs to this view, not to the panel: the draft board is not a
          seven-day average of anything, and the heading said so anyway. */}
      <p className="display px-1 pb-2 text-[13px] uppercase tracking-normal [word-spacing:0.18em] text-foreground">
        Ranked meta <span className="text-[11px] text-muted">· last {windowDays} days</span>
      </p>

      {/* Shared with Team comp, so both tabs keep the same mode and map. A
          mode is too coarse to draft on -- Ranked hands you one map out of
          its pool -- which is why the maps appear once a mode is chosen. */}
      <ModeMapChips
        modes={modes}
        mode={current}
        map={currentMap?.mapName ?? null}
        onMode={choose}
        onMap={chooseMap}
      />

      {currentMap ? (
        <MapPicks
          key={currentMap.mapName}
          map={currentMap}
          onPick={show}
          openId={openId}
          fieldable={fieldable}
          filtering={account.owned !== null}
          hiding={hiding}
        />
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
                fieldable={fieldable}
                hiding={hiding}
              />
            );
          })}
        </ul>
      )}

      {open ? <BuildCard ref={cardRef} entry={open} build={build} /> : null}
    </>
  );
}

function TierStrip({
  tier,
  entries,
  onPick,
  openId,
  fieldable,
  hiding,
}: {
  tier: Tier;
  entries: PanelEntry[];
  onPick: (entry: PanelEntry) => void;
  openId: number | null;
  /** True when this account can field the brawler under the current filter. */
  fieldable: (brawlerId: number) => boolean;
  /** Remove what cannot be fielded rather than dimming it. */
  hiding: boolean;
}) {
  const color = TIER_COLOR[tier];

  /*
   * Hiding filters the row, and the count beside the tier letter counts what
   * is drawn. A count that still said forty over a row of six would be the
   * panel contradicting itself on the same line.
   */
  const visible = hiding ? entries.filter((e) => fieldable(e.brawlerId)) : entries;
  if (visible.length === 0) return null;

  return (
    <li className="bz-panel overflow-hidden">
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
            className="display text-2xl leading-none"
            style={{ color, textShadow: `0 0 18px color-mix(in srgb, ${color} 60%, transparent)` }}
          >
            {tier}
          </span>
          <span className="text-[10px] font-bold tabular-nums text-muted">{visible.length}</span>
        </div>

        <div className="flex flex-1 flex-wrap content-start gap-x-1.5 gap-y-1 p-1.5">
          {visible.slice(0, SHOWN_PER_TIER).map((entry) => (
            <button
              key={entry.brawlerId}
              type="button"
              onClick={() => onPick(entry)}
              aria-pressed={openId === entry.brawlerId}
              className="w-10 text-center"
            >
              {/* Dimmed, not removed, and the order never changes.
                  Hiding would make the tier counts lie, and a reader who knows
                  the meta would think the panel was broken. Someone also
                  levels brawlers between drafts, so what they cannot field
                  today is a thing they might want to see. */}
              <Image
                src={entry.imageUrl}
                alt={entry.brawlerName}
                width={40}
                height={40}
                className={`size-10 rounded-lg bg-surface-2 transition-shadow ${
                  openId === entry.brawlerId ? 'ring-2 ring-brand' : ''
                } ${fieldable(entry.brawlerId) ? '' : 'opacity-25 grayscale'}`}
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

          {visible.length > SHOWN_PER_TIER ? (
            <span className="self-center px-1 text-[10px] font-semibold text-muted">
              +{visible.length - SHOWN_PER_TIER}
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
  fieldable,
  filtering,
  hiding,
}: {
  map: PanelMap;
  onPick: (entry: PanelEntry) => void;
  openId: number | null;
  fieldable: (brawlerId: number) => boolean;
  /** Whether an account is configured at all, so the banner can stay quiet. */
  filtering: boolean;
  /** Remove what cannot be fielded rather than dimming it. */
  hiding: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  /*
   * Picks is filtered to what you can take; Bans is not.
   *
   * You ban what the enemy might pick, which has nothing to do with your own
   * roster — a ban list narrowed to brawlers you own would be answering a
   * different question from the one it is named after.
   */
  const [tab, setTab] = useState<'picks' | 'bans'>('picks');

  if (map.picks.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs leading-relaxed text-muted">
        No brawler is clearly above average on {map.mapName} yet. It fills in as the sampler
        works through more battles here.
      </p>
    );
  }

  /*
   * Bans are never filtered by what you own, and never hidden. The enemy's
   * options are the enemy's options.
   */
  const source =
    tab === 'bans' || !hiding ? map.picks : map.picks.filter((p) => fieldable(p.brawlerId));
  const shown = expanded ? source : source.slice(0, SHOWN_MAP_PICKS);
  const hidden = source.length - shown.length;

  /*
   * The best pick this account can actually take, which is the answer someone
   * with eight seconds wants. Found across the WHOLE list rather than the ten
   * shown: the point of the line is that it saves you scrolling, and it cannot
   * do that if it only looks at what is already on screen.
   */
  const best =
    filtering && tab === 'picks' ? map.picks.find((p) => fieldable(p.brawlerId)) : undefined;

  return (
    <>
    {/* Two questions, not two views of one. Picks answers "what do I take",
        which depends on your roster; Bans answers "what do I take away",
        which depends on theirs. */}
    <div className="mb-1.5 flex gap-1">
      {(['picks', 'bans'] as const).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => {
            setTab(key);
            setExpanded(false);
          }}
          aria-pressed={tab === key}
          className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-bold capitalize transition-colors ${
            tab === key
              ? 'bg-brand text-[#0b0f1d]'
              : 'bg-surface-2 text-muted hover:text-foreground'
          }`}
        >
          {key === 'bans' ? 'Ban' : 'Pick'}
        </button>
      ))}
    </div>

    {tab === 'bans' ? (
      <p className="mb-1.5 px-1 text-[10px] font-semibold leading-tight text-muted">
        Strongest here, whoever owns them. The pick rate is how often it is
        actually taken — banning something nobody picks spends the ban for nothing.
      </p>
    ) : null}

    {filtering && tab === 'picks' ? (
      <p className="mb-1.5 px-1 text-[10px] font-semibold leading-tight text-muted">
        {best ? (
          <>
            Your best here:{' '}
            <span className="font-black capitalize text-brand">
              {best.brawlerName.toLowerCase()}
            </span>
          </>
        ) : (
          'Nothing on this map matches your filter.'
        )}
      </p>
    ) : null}
    <ol className="bz-panel divide-y divide-border overflow-hidden">
      {shown.map((pick, index) => {
        const edge = pick.score - pick.overallScore;
        const own = tab === 'bans' || fieldable(pick.brawlerId);
        return (
          <li key={pick.brawlerId} className={own ? '' : 'opacity-40'}>
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
                {/* Sample size on Pick, pick rate on Ban.
                    They answer the two different questions the tabs ask: "can
                    I trust this number" when choosing, and "will it even be
                    there" when banning. */}
                <span className="block text-[10px] tabular-nums leading-tight text-muted">
                  {tab === 'bans'
                    ? `${(pick.pickRate * 100).toFixed(1)}% picked here`
                    : `${pick.battles} battles here`}
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

    {hidden > 0 ? (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="bz-chip mt-2 w-full px-2 py-1.5 text-[12px]"
      >
        Show {hidden} more
      </button>
    ) : null}
    </>
  );
}
