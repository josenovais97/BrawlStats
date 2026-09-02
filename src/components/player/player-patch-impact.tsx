import Image from 'next/image';
import Link from 'next/link';

import { SectionHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { titleCase } from '@/lib/format';
import type { PatchImpact } from '@/lib/patch-impact';
import { brawlerPath } from '@/lib/slugs';
import type { BABrawler } from '@/types/brawlapi';

/**
 * The update, read against this roster.
 *
 * The headline is deliberately about the account rather than the patch: "four
 * brawlers you own were changed" is the thing a reader cannot get from the
 * official notes, and it is the reason to look here rather than at them.
 *
 * Rows keep their measured move even when it is small, and say how many days of
 * data are behind it. A patch is usually days old when this matters most, and
 * two days of snapshots is a real measurement of a short period rather than a
 * verdict — printing the number without its age would overstate it.
 */
export function PlayerPatchImpact({
  impact,
  patch,
  brawlerMeta,
}: {
  impact: PatchImpact;
  patch: { title: string; url: string; date: string };
  brawlerMeta: Map<number, BABrawler>;
}) {
  const { rows, buffed, nerfed, daysAfter } = impact;
  const mine = rows.filter((row) => row.power !== null);

  return (
    <section className="space-y-3">
      <SectionHeading
        title="What the update did to you"
        subtitle={
          mine.length > 0
            ? `${mine.length} ${mine.length === 1 ? 'brawler' : 'brawlers'} you own changed in ${patch.title}${
                buffed + nerfed > 0 ? ` — ${buffed} up, ${nerfed} down since` : ''
              }.`
            : `Nothing you own changed in ${patch.title}.`
        }
        aside={
          <a
            href={patch.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-brand transition-colors hover:underline"
          >
            Patch notes
          </a>
        }
      />

      <ul className="card divide-y divide-border overflow-hidden">
        {rows.map((row) => (
          <li key={row.brawlerId}>
            <Link
              href={brawlerPath(row.brawlerId, row.name)}
              prefetch={false}
              className="row-interactive flex items-center gap-3 px-4 py-2.5"
            >
              <Image
                src={brawlerMeta.get(row.brawlerId)?.imageUrl ?? brawlerIconUrl(row.brawlerId)}
                alt=""
                width={36}
                height={36}
                className={`size-9 shrink-0 rounded-lg bg-surface-2 ${
                  row.power === null ? 'opacity-50' : ''
                }`}
                loading="lazy"
                unoptimized
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {titleCase(row.name)}
                </span>
                <span className="block truncate text-xs text-muted">
                  {row.categoryLabel}
                  {row.power !== null ? ` · your power ${row.power}` : ' · not unlocked'}
                </span>
              </span>

              {row.delta === null ? (
                <span className="shrink-0 text-xs text-muted">not measured yet</span>
              ) : (
                <span className="shrink-0 text-right">
                  <span
                    className={`block text-sm font-bold tabular-nums ${
                      row.delta >= 0.005
                        ? 'text-victory'
                        : row.delta <= -0.005
                          ? 'text-defeat'
                          : 'text-muted'
                    }`}
                  >
                    {row.delta >= 0.005 ? '+' : row.delta <= -0.005 ? '−' : '±'}
                    {Math.abs(row.delta * 100).toFixed(1)}
                  </span>
                  <span className="block text-[11px] text-muted">pts since</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-muted">
        Win rates are adjusted against the sample average, so a shift here is the brawler moving
        rather than the cohort.{' '}
        {Number.isFinite(daysAfter) && daysAfter > 0
          ? `Measured from ${daysAfter} ${daysAfter === 1 ? 'day' : 'days'} of snapshots since the update — a short window, and it widens daily.`
          : 'Moves appear once a day of snapshots has been collected since the update.'}
      </p>
    </section>
  );
}
