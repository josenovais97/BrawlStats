'use client';

import Image from 'next/image';
import { useState } from 'react';

import { usePanelI18n } from '@/components/bubble/panel-i18n';
import type { PanelMode } from '@/components/bubble/panel-tiers';

/** Where the last-used mode and map are kept between openings, for every tab. */
export const STORED_MODE = 'brawlzone.bubble.mode';
export const STORED_MAP = 'brawlzone.bubble.map';

/** Writes a preference, or clears it, and never lets storage break the panel. */
export function remember(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked site data both throw. Keeping a choice
    // between openings is a convenience, never a requirement.
  }
}

/** A mode's name in the panel's language: the game's word, or "All". */
export function useModeLabel(): (mode: Pick<PanelMode, 'key' | 'label'>) => string {
  const { t, name } = usePanelI18n();
  return (mode) => (mode.key === null ? t('mode.all') : name(mode.label));
}

/** The saved mode and map, or nulls; never throws. */
export function recall(): { mode: string | null; map: string | null } {
  try {
    return {
      mode: window.localStorage.getItem(STORED_MODE),
      map: window.localStorage.getItem(STORED_MAP),
    };
  } catch {
    return { mode: null, map: null };
  }
}

/**
 * The mode row and, once a mode is chosen, its Ranked maps.
 *
 * Shared by every tab that is about a mode or a map, so they draw the same
 * chips and keep the same choice: pick Belle's Rock on Meta and Team comp
 * opens on Belle's Rock too, which is the map the draft in front of you is on.
 *
 * Wraps rather than scrolling sideways. A horizontal rail inside a vertically
 * scrolling overlay is a drag the wrong axis claims, which is what made the
 * panel feel stuck.
 *
 * Collapses to one line once a map is chosen -- "Belle's Rock · Knockout,
 * Change" -- the pattern the Draft tab proved first. Two rows of chips are a
 * fifth of a 375dp-tall window spent restating a choice already made; the
 * space belongs to the answer.
 */
export function ModeMapChips({
  modes,
  mode,
  map,
  onMode,
  onMap,
  allMapsLabel,
  hasData,
}: {
  modes: PanelMode[];
  mode: PanelMode;
  map: string | null;
  onMode: (key: string | null) => void;
  onMap: (name: string | null) => void;
  allMapsLabel?: string;
  /** Marks maps with no data for this tab, so a chip never opens on nothing. */
  hasData?: (mapName: string) => boolean;
}) {
  const [changing, setChanging] = useState(false);
  const { t, name, lang } = usePanelI18n();
  const modeName = useModeLabel();
  // Alphabetical in the reader's language, so the chips read in order. The
  // server sorts by the English name, which is no order at all in Japanese.
  const maps = [...mode.maps].sort((a, b) => name(a.mapName).localeCompare(name(b.mapName), lang));

  if (map !== null && !changing) {
    return (
      <button
        type="button"
        onClick={() => setChanging(true)}
        className="bz-panel mx-1 mb-2.5 flex w-[calc(100%-0.5rem)] items-center gap-1.5 px-2 py-1.5 text-start text-[11px]"
      >
        {mode.icon ? (
          <Image
            src={mode.icon}
            alt=""
            width={16}
            height={16}
            className="size-4 shrink-0 object-contain"
            unoptimized
          />
        ) : null}
        <span className="display truncate text-[13px] text-[#a3eaff]">{name(map)}</span>
        <span className="shrink-0 text-muted">· {modeName(mode)}</span>
        <span className="bz-chip ms-auto shrink-0 px-2 py-0.5">
          {t('chips.change')}
        </span>
      </button>
    );
  }

  return (
    <>
      <div role="group" aria-label="Game mode" className="flex flex-wrap gap-1 px-1 pb-2 text-[11px]">
        {modes.map((m) => {
          const on = m.key === mode.key;
          return (
            <button
              key={m.key ?? 'all'}
              type="button"
              onClick={() => onMode(m.key)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1 px-2 py-1 leading-tight ${
                on ? 'bz-chip-on' : 'bz-chip'
              }`}
            >
              {m.icon ? (
                <Image
                  src={m.icon}
                  alt=""
                  width={16}
                  height={16}
                  className={`size-4 shrink-0 object-contain ${on ? '' : 'opacity-80'}`}
                  unoptimized
                />
              ) : null}
              {modeName(m)}
            </button>
          );
        })}
      </div>

      {mode.maps.length > 0 ? (
        <div role="group" aria-label="Map" className="flex flex-wrap gap-1 px-1 pb-2 text-[11px]">
          <button
            type="button"
            onClick={() => {
              onMap(null);
              setChanging(false);
            }}
            aria-pressed={map === null}
            className={`px-2 py-1 leading-tight ${
              map === null
                ? 'bz-chip-map-on'
                : 'bz-chip'
            }`}
          >
            {allMapsLabel ?? t('chips.allMaps')}
          </button>

          {maps.map((m) => {
            const on = map === m.mapName;
            const thin = hasData ? !hasData(m.mapName) : false;
            return (
              <button
                key={m.mapName}
                type="button"
                onClick={() => {
                  onMap(m.mapName);
                  setChanging(false);
                }}
                aria-pressed={on}
                title={thin ? t('chips.thinMap') : undefined}
                className={`px-2 py-1 leading-tight ${
                  on
                    ? 'bz-chip-map-on'
                    : `bz-chip ${thin ? 'opacity-55' : ''}`
                }`}
              >
                {name(m.mapName)}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
