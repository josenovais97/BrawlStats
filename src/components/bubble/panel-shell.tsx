'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { PanelComps, type PanelModeComps } from '@/components/bubble/panel-comps';
import { PanelDraft, type DraftBrawler } from '@/components/bubble/panel-draft';
import { PanelTiers, type PanelMode } from '@/components/bubble/panel-tiers';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';

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
  const [tab, setTab] = useState<Tab>('meta');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORED_TAB);
      if (saved === 'draft' || saved === 'comps') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTab(saved);
      }
    } catch {
      // Private windows and blocked site data both throw. Meta is a fine
      // default; a panel that fails to render is not.
    }
  }, []);

  const choose = (next: Tab) => {
    setTab(next);
    try {
      window.localStorage.setItem(STORED_TAB, next);
    } catch {
      // ignored
    }
  };

  const account = useBubbleAccount();
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
        <div className="mb-2 flex items-center gap-2 px-1">
          {account.iconUrl ? (
            <Image
              src={account.iconUrl}
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0 rounded-md border border-border bg-surface-2"
              unoptimized
            />
          ) : (
            <span className="size-7 shrink-0 rounded-md border border-border bg-surface-2" />
          )}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-xs font-bold">{account.name ?? `#${account.tag}`}</span>
            <span className="block truncate text-[10px] text-muted">#{account.tag}</span>
          </span>
          <span className="shrink-0 rounded border border-brand/40 bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">
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
      <div role="tablist" aria-label="Panel view" className="mb-2 flex gap-1 px-1">
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
            className={`rounded-md border px-3 py-1 text-[11px] font-bold leading-tight transition-colors ${
              tab === key
                ? 'border-brand/40 bg-brand/10 text-brand'
                : 'border-border bg-surface text-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'meta' ? (
        <PanelTiers modes={modes} windowDays={windowDays} />
      ) : tab === 'comps' ? (
        <PanelComps modes={modes} comps={comps} />
      ) : (
        <PanelDraft modes={modes} roster={roster} />
      )}
    </>
  );
}
