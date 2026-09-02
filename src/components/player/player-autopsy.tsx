import Image from 'next/image';
import Link from 'next/link';

import { SectionHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl, modeLabel } from '@/lib/brawlapi';
import { titleCase } from '@/lib/format';
import type { Autopsy } from '@/lib/battle-autopsy';
import { brawlerPath, slugify } from '@/lib/slugs';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';

/**
 * The pattern behind the recent losses.
 *
 * Sits with the battle log because it is the same subject read one level up:
 * the log lists what happened, this says what kept happening. A single loss
 * gets no entry here — the floor is two, because one bad game on one map is
 * the game working normally and calling it a mistake would be reading tea
 * leaves.
 *
 * Two shapes only, and the difference matters. A wrong pick is something the
 * reader controls and can change tomorrow; a recurring opponent is context they
 * can prepare for but not prevent. They are worded so that distinction is
 * obvious without a legend.
 */
export function PlayerAutopsy({
  autopsy,
  brawlerMeta,
  modeMeta,
}: {
  autopsy: Autopsy;
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
}) {
  return (
    <section className="space-y-3">
      <SectionHeading
        title="What went wrong"
        subtitle={`Patterns across the ${autopsy.losses} ${
          autopsy.losses === 1 ? 'loss' : 'losses'
        } in this battle log, rather than one-off results.`}
      />

      <ul className="card divide-y divide-border overflow-hidden">
        {autopsy.findings.map((finding) => {
          const art =
            brawlerMeta.get(finding.brawlerId)?.imageUrl ?? brawlerIconUrl(finding.brawlerId);
          const name = titleCase(finding.brawlerName);
          const mode = finding.mode ? modeLabel(modeMeta, finding.mode) : null;

          return (
            <li
              key={`${finding.kind}-${finding.brawlerId}-${finding.mapName ?? ''}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              <Image
                src={art}
                alt=""
                width={40}
                height={40}
                className="size-10 shrink-0 rounded-lg bg-surface-2"
                loading="lazy"
                unoptimized
              />

              <span className="min-w-0 flex-1 text-sm leading-snug">
                {finding.kind === 'map-pick' ? (
                  <>
                    <span className="block">
                      <Link
                        href={brawlerPath(finding.brawlerId, finding.brawlerName)}
                        prefetch={false}
                        className="font-semibold transition-colors hover:text-brand"
                      >
                        {name}
                      </Link>{' '}
                      <span className="text-muted">is a weak pick on</span>{' '}
                      {mode && finding.mapName ? (
                        <Link
                          href={`/maps/${slugify(mode)}/${slugify(finding.mapName)}`}
                          prefetch={false}
                          className="font-semibold transition-colors hover:text-brand"
                        >
                          {finding.mapName}
                        </Link>
                      ) : (
                        <span className="font-semibold">{finding.mapName}</span>
                      )}
                    </span>
                    <span className="block text-xs text-muted">
                      {finding.losses} {finding.losses === 1 ? 'loss' : 'losses'} there ·{' '}
                      {Math.abs((finding.edge ?? 0) * 100).toFixed(1)} pts below the map average
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block">
                      <Link
                        href={brawlerPath(finding.brawlerId, finding.brawlerName)}
                        prefetch={false}
                        className="font-semibold transition-colors hover:text-brand"
                      >
                        {name}
                      </Link>{' '}
                      <span className="text-muted">was on the other side</span>
                    </span>
                    <span className="block text-xs text-muted">
                      In {finding.losses} of your losses
                    </span>
                  </>
                )}
              </span>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                  finding.kind === 'map-pick'
                    ? 'bg-defeat/15 text-defeat'
                    : 'bg-surface-2 text-muted'
                }`}
              >
                {finding.kind === 'map-pick' ? 'Your pick' : 'Opponent'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
