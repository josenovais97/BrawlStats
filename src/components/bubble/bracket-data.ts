'use client';

import type { PanelModeComps } from '@/components/bubble/panel-comps';
import { bracketForRankName, type RankBracket } from '@/lib/rank-brackets';
import type { PanelEntry, PanelMapPick } from '@/components/bubble/panel-tiers';

/** The chosen rank bracket's slug, or "all". Absent until someone chooses. */
export const STORED_BRACKET = 'brawlzone.bubble.bracket';

/** One rank's data, as `/api/bubble/tiers/<bracket>` returns it. */
export interface BracketData {
  lists: Record<string, { days: number; entries: PanelEntry[] }>;
  /** Map picks at this rank, keyed `mode|map`. */
  maps: Record<string, PanelMapPick[]>;
  /** Trios at this rank, per mode, with per-map lists where there are enough. */
  comps: Record<string, PanelModeComps>;
}

/*
 * One request per rank for the life of the page, shared by every tab: the
 * Meta tab and the Team comp tab both want the same rank's data, and a panel
 * floating over a draft should not fetch it twice on mobile data.
 */
const loads = new Map<string, Promise<BracketData>>();

export function loadBracket(slug: string): Promise<BracketData> {
  let load = loads.get(slug);
  if (!load) {
    load = fetch(`/api/bubble/tiers/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Partial<BracketData>) => ({
        lists: data.lists ?? {},
        maps: data.maps ?? {},
        comps: data.comps ?? {},
      }));
    // A failed load is not kept, so the next tab or tap can try again.
    load.catch(() => loads.delete(slug));
    loads.set(slug, load);
  }
  return load;
}

/**
 * A rank as the game names its leagues, in the panel's language: `name` is
 * the panel's game-name lookup (`usePanelI18n().name`).
 */
export function bracketLabel(b: RankBracket, name: (text: string) => string): string {
  if (b.id === 1) return `${name('Diamond')} ↓`;
  if (b.id === 2) return name('Mythic');
  if (b.id === 3) return name('Legendary');
  return `${name('Masters')}+`;
}

/** The rank chosen on the Meta tab, or null for every rank. */
export function storedBracket(): string | null {
  try {
    const saved = window.localStorage.getItem(STORED_BRACKET);
    return saved && saved !== 'all' ? saved : null;
  } catch {
    return null;
  }
}

/**
 * The rank the panel answers for: the one chosen on the Meta tab, "every
 * rank" if that is what was chosen, and otherwise the player's own Ranked rank
 * from their tag -- the default the Meta tab already used, extended to the
 * draft and team-comp tabs on 2026-10-14 so all three agree.
 */
export function panelBracket(ownRankName: string | null): string | null {
  try {
    const saved = window.localStorage.getItem(STORED_BRACKET);
    if (saved !== null) return saved !== 'all' ? saved : null;
  } catch {
    // Storage blocked: fall through to the player's own rank.
  }
  return bracketForRankName(ownRankName)?.slug ?? null;
}
