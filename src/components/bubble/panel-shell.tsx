'use client';

import { useEffect, useState } from 'react';

import { PanelDraft, type DraftBrawler } from '@/components/bubble/panel-draft';
import { PanelTiers, type PanelMode } from '@/components/bubble/panel-tiers';

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

type Tab = 'meta' | 'draft';

export function PanelShell({
  modes,
  roster,
  windowDays,
}: {
  modes: PanelMode[];
  roster: DraftBrawler[];
  windowDays: number;
}) {
  const [tab, setTab] = useState<Tab>('meta');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORED_TAB);
      if (saved === 'draft') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTab('draft');
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

  return (
    <>
      {/*
        Two tabs, sized like the chips below them rather than like a phone's
        tab bar. A full-width segmented control would cost a row of a window
        that is only ~375dp tall in the orientation the game is played in.
      */}
      <div role="tablist" aria-label="Panel view" className="mb-2 flex gap-1 px-1">
        {(
          [
            ['meta', 'Meta'],
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
      ) : (
        <PanelDraft modes={modes} roster={roster} />
      )}
    </>
  );
}
