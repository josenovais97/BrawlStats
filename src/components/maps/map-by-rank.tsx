import Image from 'next/image';
import Link from 'next/link';

import { SectionHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatPercent } from '@/lib/format';
import { localePath, rankLabel } from '@/lib/i18n';
import { RANK_BRACKETS, bracketIconUrl } from '@/lib/rank-brackets';
import { brawlerPath } from '@/lib/slugs';
import { getStoredBracketMapPicks } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import type { BABrawler } from '@/types/brawlapi';
import type { RankedMapPick } from '@/types/stats';

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());

/**
 * The map's best picks at each Ranked rank (2026-11-11): what wins here in
 * Diamond is not what wins in Masters, and this is the one page that can say
 * so for a single map. Precomputed per-rank lists only; a rank without enough
 * games on the map is left out, and the panel needs two ranks to compare.
 */
export async function MapByRank({
  mode,
  dataMapName,
  mapName,
  brawlerMeta,
}: {
  mode: string;
  dataMapName: string;
  mapName: string;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const locale = requestLocale();
  const t = getT(locale);
  const cols: { bracket: (typeof RANK_BRACKETS)[number]; picks: RankedMapPick[] }[] = [];
  for (const bracket of RANK_BRACKETS) {
    const lists = await getStoredBracketMapPicks(bracket.id).catch(() => null);
    const entry = lists?.find((l) => l.mode === mode && l.mapName === dataMapName);
    if (entry && entry.picks.length >= 3) cols.push({ bracket, picks: entry.picks.slice(0, 5) });
  }
  if (cols.length < 2) return null;

  // A brawler in the top five at every rank shown is the safe pick.
  const everywhere = cols[0].picks
    .map((p) => p.brawlerId)
    .filter((id) => cols.every((c) => c.picks.some((p) => p.brawlerId === id)));

  return (
    <section>
      <SectionHeading
        title={t('Best picks by rank')}
        subtitle={
          everywhere.length > 0
            ? t('{names}: top five at every rank on {map}.', {
                names: everywhere.map((id) => titleCase(brawlerMeta.get(id)?.name ?? cols[0].picks.find((p) => p.brawlerId === id)?.brawlerName ?? '')).join(', '),
                map: mapName,
              })
            : t('What wins on {map} changes with the rank.', { map: mapName })
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cols.map(({ bracket, picks }) => (
          <div key={bracket.id} className="card p-3.5">
            <p className="mb-2.5 flex items-center gap-2">
              <Image src={bracketIconUrl(bracket)} alt="" width={28} height={28} unoptimized className="size-7 shrink-0 object-contain" />
              <span className="line-clamp-2 text-sm font-bold leading-tight">{rankLabel(bracket, locale)}</span>
            </p>
            <ol className="space-y-1.5">
              {picks.map((p, i) => {
                const name = titleCase(brawlerMeta.get(p.brawlerId)?.name ?? p.brawlerName);
                return (
                  <li key={p.brawlerId}>
                    <Link
                      href={localePath(locale, brawlerPath(p.brawlerId, name))}
                      prefetch={false}
                      className={`row-interactive flex items-center gap-2 rounded-lg px-1.5 py-1 ${everywhere.includes(p.brawlerId) ? 'bg-brand/10' : ''}`}
                    >
                      <span className="w-3 shrink-0 text-xs font-bold tabular-nums text-muted">{i + 1}</span>
                      <Image
                        src={brawlerMeta.get(p.brawlerId)?.imageUrl ?? brawlerIconUrl(p.brawlerId)}
                        alt=""
                        width={28}
                        height={28}
                        unoptimized
                        className="size-7 shrink-0 rounded-md border border-ink bg-surface-3"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
                      <span className={`shrink-0 text-xs font-bold tabular-nums ${p.score >= 0.5 ? 'text-victory' : 'text-muted'}`}>{formatPercent(p.score)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
