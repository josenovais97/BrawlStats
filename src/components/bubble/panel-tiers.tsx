'use client';

import Image from 'next/image';
import { useState } from 'react';

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

export interface PanelMode {
  /** The API's mode key, or `null` for the combined list. */
  key: string | null;
  label: string;
  entries: PanelEntry[];
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

export function PanelTiers({ modes }: { modes: PanelMode[] }) {
  const [active, setActive] = useState<string | null>(null);
  const current = modes.find((m) => m.key === active) ?? modes[0];

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
      <div role="group" aria-label="Game mode" className="flex flex-wrap gap-1 px-1 pb-2">
        {modes.map((mode) => {
          const on = mode.key === current.key;
          return (
            <button
              key={mode.key ?? 'all'}
              type="button"
              onClick={() => setActive(mode.key)}
              aria-pressed={on}
              className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
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

      {current.entries.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-muted">
          Not enough sampled Ranked battles in {current.label.toLowerCase()} yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {TIER_ORDER.map((tier) => {
            const entries = byTier.get(tier) ?? [];
            if (entries.length === 0) return null;
            return <TierStrip key={tier} tier={tier} entries={entries} />;
          })}
        </ul>
      )}
    </>
  );
}

function TierStrip({ tier, entries }: { tier: Tier; entries: PanelEntry[] }) {
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
            <div key={entry.brawlerId} className="w-10 text-center">
              <Image
                src={entry.imageUrl}
                alt={entry.brawlerName}
                width={40}
                height={40}
                className="size-10 rounded-lg bg-surface-2"
                loading="lazy"
                unoptimized
              />
              <p className="truncate text-[9px] font-semibold capitalize leading-tight">
                {entry.brawlerName.toLowerCase()}
              </p>
              <p className="text-[10px] font-black tabular-nums leading-none" style={{ color }}>
                {entry.metaScore?.toFixed(1) ?? '–'}
              </p>
            </div>
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
