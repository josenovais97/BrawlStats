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
 * The list is capped and the roster is sorted to the top, because an update can
 * touch forty brawlers and a wall of them is the patch notes again. A row says
 * "too early to measure" until there are a few days of snapshots behind it,
 * which is most of the window where this section is on the page at all — that
 * is the honest state, and better than a two-day number that looks like a
 * finding.
 */

/** "1 September", UTC-anchored so the server and browser agree. */
function patchDay(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export function PlayerPatchImpact({
  impact,
  patch,
  brawlerMeta,
}: {
  impact: PatchImpact;
  patch: { title: string; url: string; date: string };
  brawlerMeta: Map<number, BABrawler>;
}) {
  const { rows, buffed, nerfed, changedTotal, ownedTotal } = impact;
  const measured = buffed + nerfed > 0;

  return (
    <section className="space-y-3">
      <SectionHeading
        title="What the update did to you"
        subtitle={
          ownedTotal > 0
            ? `The ${patchDay(patch.date)} update changed ${ownedTotal} ${
                ownedTotal === 1 ? 'brawler' : 'brawlers'
              } you own${measured ? ` — ${buffed} up, ${nerfed} down since` : ''}.`
            : `Nothing you own changed in the ${patchDay(patch.date)} update.`
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
                <span className="shrink-0 text-xs text-muted">too early to measure</span>
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
        {changedTotal > rows.length
          ? `Showing the ${rows.length} most relevant of ${changedTotal} brawlers the update touched, yours first. `
          : ''}
        Win rates are adjusted against the sample average, so a shift here is the brawler moving
        rather than the cohort — and a move only appears once there are a few days of snapshots
        behind it, because a two-day sample swings further than any balance change does.
      </p>
    </section>
  );
}
