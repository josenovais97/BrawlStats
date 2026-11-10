import Image from 'next/image';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { RANK_ELO_FLOORS } from '@/lib/ranked-elo';
import type { BABrawler } from '@/types/brawlapi';

type T = (text: string, vars?: Record<string, string | number>) => string;

/** "MYTHIC II" -> "Mythic II" in the page's language (numeral kept). */
export function rankLabel(name: string | null | undefined, t: T): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  const numeral = parts.length > 1 && /^[IV]+$/i.test(parts[parts.length - 1]) ? parts.pop()!.toUpperCase() : null;
  const word = parts.join(' ').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return numeral ? `${t(word)} ${numeral}` : t(word);
}

/** 1-22 for a rank name ("Mythic II"), or null. */
export function rankNumber(name: string | null | undefined): number | null {
  if (!name) return null;
  const i = RANK_ELO_FLOORS.findIndex(([n]) => n === name.trim().toUpperCase());
  return i >= 0 ? i + 1 : null;
}

/** Text colour for a win rate: green from 55%, red under 45%. */
export function rateTone(rate: number): string {
  return rate >= 0.55 ? 'text-victory' : rate < 0.45 ? 'text-defeat' : 'text-foreground';
}

/** Bar colour likewise. */
export function rateFill(rate: number): string {
  return rate >= 0.55 ? 'bg-victory' : rate < 0.45 ? 'bg-defeat' : 'bg-brand';
}

export function BrawlerFace({
  id,
  meta,
  size = 40,
  className = '',
  bare = false,
}: {
  id: number;
  meta: Map<number, BABrawler>;
  size?: number;
  className?: string;
  /** No frame, for a face inside a frame of its own. */
  bare?: boolean;
}) {
  const b = meta.get(id);
  return (
    <Image
      src={b?.imageUrl ?? brawlerIconUrl(id)}
      alt=""
      width={size}
      height={size}
      unoptimized
      className={`shrink-0 bg-surface-3 object-cover ${bare ? '' : 'rounded-xl border-2 border-ink'} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function brawlerName(id: number, meta: Map<number, BABrawler>): string {
  const name = meta.get(id)?.name;
  return name ? name.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase()) : `#${id}`;
}

/** A game-panel heading inside the tab, matching Panel's title. */
export function SeasonHeading({ title, aside }: { title: string; aside?: string | null }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="display text-xl leading-none sm:text-2xl">{title}</h3>
      {aside ? <span className="text-xs text-muted">{aside}</span> : null}
    </div>
  );
}

/** Win/loss split bar. */
export function WinLossBar({ wins, games, className = 'h-2' }: { wins: number; games: number; className?: string }) {
  const share = games > 0 ? (wins / games) * 100 : 0;
  return (
    <div className={`flex overflow-hidden rounded-full bg-surface-3 ${className}`}>
      <div className="bg-victory" style={{ width: `${share}%` }} />
      <div className="bg-defeat" style={{ width: `${games > 0 ? 100 - share : 0}%` }} />
    </div>
  );
}
