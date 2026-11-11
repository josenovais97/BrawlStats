import Image from 'next/image';
import type { CSSProperties } from 'react';

import type { RankCell } from '@/components/brawlers/brawler-by-rank';
import { SectionHeading } from '@/components/ui/section-heading';
import { rankLabel } from '@/lib/i18n';
import { bracketIconUrl } from '@/lib/rank-brackets';
import { getT } from '@/lib/t';
import { TIER_COLOR } from '@/lib/tiers';
import { requestLocale } from '@/lib/request-locale';

/**
 * The two brawlers' places at each Ranked rank, side by side (2026-11-11):
 * the better place at each rank is lit. From the same precomputed per-rank
 * lists as the brawler pages' By rank panel.
 */
export function CompareByRank({
  nameA,
  nameB,
  left,
  right,
  colorA,
  colorB,
}: {
  nameA: string;
  nameB: string;
  left: RankCell[] | null;
  right: RankCell[] | null;
  colorA: string;
  colorB: string;
}) {
  const locale = requestLocale();
  const t = getT(locale);
  if (!left || !right) return null;
  const rows = left
    .map((l) => ({ l, r: right.find((r) => r.bracket.id === l.bracket.id) }))
    .filter((x) => x.r && (x.l.position !== null || x.r.position !== null));
  if (rows.length < 2) return null;
  const winsA = rows.filter(({ l, r }) => l.position !== null && (r!.position === null || l.position < r!.position)).length;
  const winsB = rows.filter(({ l, r }) => r!.position !== null && (l.position === null || r!.position < l.position)).length;
  const subtitle =
    winsA > winsB
      ? t('{name} places higher at {n} of {total} ranks.', { name: nameA, n: winsA, total: rows.length })
      : winsB > winsA
        ? t('{name} places higher at {n} of {total} ranks.', { name: nameB, n: winsB, total: rows.length })
        : t('Even: each places higher at {n} ranks.', { n: winsA });

  const cell = (c: RankCell, better: boolean, color: string, align: 'start' | 'end') => (
    <span className={`flex items-center gap-2 ${align === 'end' ? 'flex-row-reverse text-right' : ''}`}>
      {c.entry?.tier ? (
        <span className="tier-badge tier-badge-sm shrink-0" style={{ '--tier': TIER_COLOR[c.entry.tier] } as CSSProperties}>
          <span className="display text-game-stroke text-lg leading-none">{c.entry.tier}</span>
        </span>
      ) : null}
      <span>
        <span className={`display block text-2xl leading-none ${better ? '' : 'text-muted'}`} style={better ? { color } : undefined}>
          {c.position !== null ? `#${c.position}` : '–'}
        </span>
        <span className="block text-[11px] text-muted">{t('of {n}', { n: c.of })}</span>
      </span>
    </span>
  );

  return (
    <section>
      <SectionHeading title={t('By rank')} subtitle={subtitle} />
      <div className="card divide-y divide-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2 text-xs font-bold">
          <span style={{ color: colorA }}>{nameA}</span>
          <span />
          <span className="text-right" style={{ color: colorB }}>{nameB}</span>
        </div>
        {rows.map(({ l, r }) => {
          const aBetter = l.position !== null && (r!.position === null || l.position < r!.position);
          const bBetter = r!.position !== null && (l.position === null || r!.position < l.position);
          return (
            <div key={l.bracket.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
              {cell(l, aBetter, colorA, 'start')}
              <span className="flex w-24 flex-col items-center gap-1 text-center sm:w-32">
                <Image src={bracketIconUrl(l.bracket)} alt="" width={30} height={30} unoptimized className="size-[30px] object-contain" />
                <span className="text-[11px] font-bold leading-tight text-muted">{rankLabel(l.bracket, locale)}</span>
              </span>
              {cell(r!, bBetter, colorB, 'end')}
            </div>
          );
        })}
      </div>
    </section>
  );
}
