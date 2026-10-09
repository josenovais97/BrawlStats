'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { PanelComps, type PanelModeComps } from '@/components/bubble/panel-comps';
import { PanelDraft, type DraftBrawler } from '@/components/bubble/panel-draft';
import { PanelTiers, type PanelMode } from '@/components/bubble/panel-tiers';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { panelTrack, panelTrackOpen } from '@/lib/panel-telemetry';

/**
 * Two views of the same draft, and which one is showing.
 *
 * Meta is the default and stays the default. It is the view that answers a
 * question with no setup — open the bubble, see what is strong — and most
 * openings want exactly that. The draft board is the deeper tool: it needs a
 * map, and it gets better the more of the line-up you feed it, which is work a
 * reader should opt into rather than be handed.
 *
 * The choice is remembered, so someone who drafts with the board every game
 * does not re-select the tab every game, and someone who never opens it never
 * sees it again after the first look.
 *
 * Both tabs mount lazily in the sense that matters: the draft board fetches
 * nothing until a map is chosen, so carrying it costs a component and no
 * requests.
 */

const STORED_TAB = 'brawlzone.bubble.tab';

type Tab = 'meta' | 'comps' | 'draft';

export function PanelShell({
  modes,
  roster,
  windowDays,
  comps,
}: {
  modes: PanelMode[];
  roster: DraftBrawler[];
  windowDays: number;
  comps: Record<string, PanelModeComps>;
}) {
  /*
   * Nothing until the reader chooses.

   * A first opening used to land on Meta with the full tier list already
   * drawn -- a wall of brawlers before anyone had said what they wanted. With
   * no saved choice the panel now asks first; after one tap that choice is
   * remembered, so every later opening goes straight to it.
   */
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORED_TAB);
      if (saved === 'meta' || saved === 'draft' || saved === 'comps') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTab(saved);
      }
    } catch {
      // Private windows and blocked site data both throw. The chooser is a
      // fine outcome; a panel that fails to render is not.
    }
  }, []);

  const choose = (next: Tab) => {
    if (next !== tab) panelTrack('panel_tab', { tab: next });
    setTab(next);
    try {
      window.localStorage.setItem(STORED_TAB, next);
    } catch {
      // ignored
    }
  };

  const account = useBubbleAccount();

  // One open per panel, with the tab it opened on and whether a tag is set --
  // a yes/no, never the tag. Read after the saved tab has been restored.
  const latest = useRef({ tab: tab ?? 'none', hasTag: account.tag !== null });
  useEffect(() => {
    latest.current = { tab: tab ?? 'none', hasTag: account.tag !== null };
  });
  useEffect(() => panelTrackOpen(() => latest.current), []);
  const filterLabel =
    account.filter === 'power11' ? 'Power 11' : account.filter === 'hypercharge' ? 'Hypercharged' : 'Owned';

  return (
    <>
      {/*
        Whose panel this is.

        With a tag set, the player's own icon and name, and the filter in
        force -- the panel marks and hides brawlers on their behalf, and a
        face at the top is how they know it is their roster being read and
        not someone else's. Without one, a single quiet line saying what a tag
        would add, pointing at the app where it is entered. Never a blocker:
        the panel works the same either way.
      */}
      {account.tag ? (
        <div className="bz-panel mx-1 mb-2.5 flex items-center gap-2 px-2 py-1.5">
          {account.iconUrl ? (
            <Image
              src={account.iconUrl}
              alt=""
              width={28}
              height={28}
              className="size-8 shrink-0 rounded-lg border-2 border-brand bg-surface-2"
              unoptimized
            />
          ) : (
            <span className="size-8 shrink-0 rounded-lg border-2 border-brand bg-surface-2" />
          )}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="display block truncate text-sm">{account.name ?? `#${account.tag}`}</span>
            <span className="block truncate text-[10px] text-muted">#{account.tag}</span>
          </span>
          <span className="bz-chip-on shrink-0 px-1.5 py-0.5 text-[10px]">
            {filterLabel}
            {account.hide ? ' · hiding rest' : ''}
          </span>
        </div>
      ) : (
        <p className="mx-1 mb-2 rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] leading-snug text-muted">
          Add your player tag in the BrawlZone app and this panel marks the brawlers you own.
        </p>
      )}

      {/*
        Two tabs, sized like the chips below them rather than like a phone's
        tab bar. A full-width segmented control would cost a row of a window
        that is only ~375dp tall in the orientation the game is played in.
      */}
      <div role="tablist" aria-label="Panel view" className="mb-2.5 flex gap-1.5 px-1">
        {(
          [
            ['meta', 'Meta'],
            ['comps', 'Team comp'],
            ['draft', 'Draft'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => choose(key)}
            className={`flex-1 px-2 py-1.5 text-[13px] leading-tight ${
              tab === key
                ? 'bz-chip-on'
                : 'bz-chip'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === null ? (
        <div className="bz-panel mx-1 px-3 py-3">
          <p className="display text-base uppercase">What do you need?</p>
          <p className="mt-0.5 text-[11px] text-muted">Pick one. The panel remembers it next time.</p>
          <ul className="mt-2.5 space-y-2">
            {(
              [
                ['meta', 'Meta', 'Who is strong in Ranked right now, by mode and map'],
                ['comps', 'Team comp', 'The best three to take together on your map'],
                ['draft', 'Draft', 'Enter bans and picks, get the counter'],
              ] as const
            ).map(([key, label, hint]) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => choose(key)}
                  className="bz-chip flex w-full flex-col items-start px-3 py-2 text-left"
                >
                  <span className="text-[14px] leading-tight">{label}</span>
                  <span className="mt-0.5 font-sans text-[11px] font-normal leading-snug text-muted [text-shadow:none]">
                    {hint}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : tab === 'meta' ? (
        <PanelTiers modes={modes} windowDays={windowDays} />
      ) : tab === 'comps' ? (
        <PanelComps modes={modes} comps={comps} />
      ) : (
        <PanelDraft modes={modes} roster={roster} />
      )}
    </>
  );
}
