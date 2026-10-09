import Image from 'next/image';
import Link from 'next/link';

import { SectionHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent, titleCaseLabel } from '@/lib/format';
import { brawlerPath } from '@/lib/slugs';
import { getRankedComps } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

/** Trios shown per map; the bubble's Team comp tab has the rest. */
const SHOWN = 5;

/**
 * The best Ranked trios on this map -- the bubble's Team comp tab, as a page
 * section.
 *
 * Content no other page about the map carries, and the question its searches
 * ask ("best brawlers for <map>") in the form a team actually needs it. Ranked
 * only, last 14 days; the map's own trios when it has enough, else the mode's,
 * labelled as such. Renders nothing when neither has data.
 */
export async function MapTrios({
  mode,
  mapName,
  dataMapName,
  modeLabel,
  brawlerMeta,
}: {
  mode: string;
  mapName: string;
  /** The battle data's spelling of the map, which the trios are keyed by. */
  dataMapName: string;
  modeLabel: string;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const comps = await getRankedComps().catch(() => ({ maps: [], modes: [] }));
  const own = comps.maps.find((m) => m.mode === mode && m.mapName === dataMapName);
  const fallback = own ? null : comps.modes.find((m) => m.mode === mode);
  const trios = (own?.comps ?? fallback?.comps ?? []).slice(0, SHOWN);
  if (trios.length === 0) return null;

  return (
    <section>
      <SectionHeading
        title={own ? `Best Ranked trios on ${mapName}` : `Best Ranked trios in ${modeLabel}`}
        subtitle={
          own
            ? 'The three brawlers that win most together on this map, from sampled Ranked battles in the last 14 days.'
            : `${mapName} has too few Ranked teams to rank on its own yet, so these are the best trios across ${modeLabel}.`
        }
      />
      <ol className="card divide-y divide-border overflow-hidden">
        {trios.map((t, i) => (
          <li key={t.brawlerIds.join('-')} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <span className="display w-6 shrink-0 text-center text-lg text-brand">{i + 1}</span>
            <span className="flex shrink-0 -space-x-1.5">
              {t.brawlerIds.map((id) => {
                const meta = brawlerMeta.get(id);
                return (
                  <Link key={id} href={brawlerPath(id, meta?.name ?? String(id))} prefetch={false}>
                    <Image
                      src={meta?.imageUrl ?? brawlerIconUrl(id)}
                      alt={meta?.name ?? ''}
                      width={44}
                      height={44}
                      className="size-10 rounded-lg border-2 border-background bg-surface-2 sm:size-11"
                      loading="lazy"
                      unoptimized
                    />
                  </Link>
                );
              })}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {t.brawlerIds.map((id) => titleCaseLabel(brawlerMeta.get(id)?.name ?? `#${id}`)).join(' · ')}
              </span>
              <span className="block text-xs tabular-nums text-muted">
                {formatNumber(t.battles)} games · {formatNumber(t.players)} players
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-lg font-black tabular-nums leading-tight">
                {formatPercent(t.winRate)}
              </span>
              <span className={`block text-xs font-bold tabular-nums ${t.edge >= 0 ? 'text-victory' : 'text-defeat'}`}>
                {t.edge >= 0 ? '+' : '−'}
                {Math.abs(t.edge * 100).toFixed(1)} vs avg
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">
        Win rate against this {own ? 'map' : 'mode'}&apos;s own Ranked average; small samples are pulled
        toward it. The same trios, with your roster ticked, are in the{' '}
        <Link href="/bubble" className="font-medium text-brand hover:underline">
          BrawlZone Bubble
        </Link>{' '}
        app&apos;s Team comp tab.
      </p>
    </section>
  );
}
