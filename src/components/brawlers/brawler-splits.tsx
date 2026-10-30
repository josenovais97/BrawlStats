import Link from 'next/link';

import { formatNumber, formatPercent, humanizeMode } from '@/lib/format';
import { slugify } from '@/lib/slugs';
import type { BrawlerSplit } from '@/lib/stats';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

/**
 * Where a brawler is actually good: its best modes, and its best maps.
 *
 * Each row links onward — a mode to its tier list, a map to its own page —
 * because "Shelly is strong in Brawl Ball" is the beginning of a question, not
 * the end of one.
 *
 * Scores are shown, not raw win rates. Each slice is measured against its own
 * average, so a 34% showing in solo showdown and a 52% in gem grab can sit in
 * one ordered list without the showdown row looking like a mistake.
 */
export function BrawlerSplits({
  modes,
  maps,
  mapSlugFor,
}: {
  modes: BrawlerSplit[];
  maps: BrawlerSplit[];
  /** Resolves a split to a map page path, when the map is still in rotation. */
  mapSlugFor: (split: BrawlerSplit) => string | null;
}) {
  const t = getT(requestLocale());
  if (modes.length === 0 && maps.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SplitList
        title={t('Best modes')}
        empty={t('Not enough battles in any one mode yet.')}
        rows={modes.slice(0, 6).map((split) => ({
          key: split.mode,
          label: humanizeMode(split.mode),
          href: `/tier-list/trophy/${slugify(split.mode)}`,
          split,
        }))}
      />
      <SplitList
        title={t('Best maps')}
        empty={t('Not enough battles on any one map yet.')}
        rows={maps.slice(0, 6).map((split) => ({
          key: `${split.mode}-${split.mapName}`,
          label: split.mapName ?? '–',
          sublabel: humanizeMode(split.mode),
          href: mapSlugFor(split),
          split,
        }))}
      />
    </div>
  );
}

function SplitList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: {
    key: string;
    label: string;
    sublabel?: string;
    href: string | null;
    split: BrawlerSplit;
  }[];
}) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  return (
    <div>
      <h3 className="label-game mb-2 text-sm text-muted">
        {t(title)}
      </h3>
      {rows.length === 0 ? (
        <p className="card p-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">
          {rows.map(({ key, label, sublabel, href, split }) => {
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t(label)}</span>
                  <span className="block text-xs tabular-nums text-muted">
                    {sublabel ? `${sublabel} · ` : ''}{t('{decidedSampleSize} battles ·', { decidedSampleSize: formatNumber(split.decidedSampleSize) })}{' '}{t('{winRate} raw', { winRate: formatPercent(split.winRate) })}</span>
                </span>
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    split.score >= 0.5 ? 'text-victory' : 'text-muted'
                  }`}
                >
                  {formatPercent(split.score)}
                </span>
              </>
            );

            return (
              <li key={key}>
                {href ? (
                  <Link
                    href={lp(href)}
                    className="row-interactive flex items-center gap-3 px-4 py-2.5"
                  >
                    {t(body)}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2.5">{t(body)}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
