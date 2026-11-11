import Image from 'next/image';
import Link from 'next/link';

import { SectionHeading } from '@/components/ui/section-heading';
import { formatPercent } from '@/lib/format';
import type { GameMap } from '@/lib/game-maps';
import { localePath } from '@/lib/i18n';
import { gameWords } from '@/lib/i18n-game';
import type { LiveSlot } from '@/lib/live-slots';
import { slugify } from '@/lib/slugs';
import type { BrawlerSplit } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import type { BAGameMode } from '@/types/brawlapi';

/**
 * Where to play this brawler right now (2026-11-11): the maps in the live
 * rotation where it beats that map's own average, best first, with the map
 * art and the hours the slot has left. Nothing when no live map qualifies.
 */
export async function BrawlerLiveMaps({
  name,
  live,
  maps,
  activeMaps,
  modeMeta,
}: {
  name: string;
  live: LiveSlot[];
  maps: BrawlerSplit[];
  activeMaps: GameMap[];
  modeMeta: Map<string, BAGameMode>;
}) {
  const locale = requestLocale();
  const t = getT(locale);
  const words = await gameWords(locale);
  const picks = live
    .map((slot) => {
      const split = maps.find((m) => m.mode === slot.mode && slugify(m.mapName ?? '') === slugify(slot.map));
      const art = activeMaps.find((m) => m.scHash === slot.mode && m.mapSlug === slugify(slot.map));
      return split ? { slot, split, art } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.split.score >= 0.5)
    .sort((a, b) => b.split.score - a.split.score)
    .slice(0, 4);
  if (picks.length === 0) return null;

  return (
    <section>
      <SectionHeading title={t('Play {name} right now', { name })} subtitle={t('Live maps where {name} beats the map average.', { name })} />
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {picks.map(({ slot, split, art }) => {
          const icon = modeMeta.get(slot.mode.toLowerCase())?.imageUrl;
          const body = (
            <>
              <span className="relative block aspect-[16/10] overflow-hidden border-b-2 border-ink bg-surface-3">
                {art?.map.imageUrl ? (
                  <Image src={art.map.imageUrl} alt="" fill unoptimized sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover" />
                ) : null}
                {slot.hoursLeft !== null ? (
                  <span className="absolute right-2 top-2 rounded-full border-2 border-ink bg-black/70 px-2 py-0.5 text-[11px] font-bold">
                    {t('{h}h left', { h: slot.hoursLeft })}
                  </span>
                ) : null}
              </span>
              <span className="flex items-center gap-2 p-3">
                {icon ? <Image src={icon} alt="" width={24} height={24} unoptimized className="size-6 shrink-0 object-contain" /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{t(slot.map)}</span>
                  <span className="block truncate text-xs text-muted">{words.mode(slot.mode)}</span>
                </span>
                <span className="shrink-0 text-lg font-black tabular-nums text-victory">{formatPercent(split.score)}</span>
              </span>
            </>
          );
          return (
            <li key={`${slot.mode}-${slot.map}`}>
              {art ? (
                <Link href={localePath(locale, `/maps/${art.modeSlug}/${art.mapSlug}`)} prefetch={false} className="card row-interactive block overflow-hidden">
                  {body}
                </Link>
              ) : (
                <div className="card block overflow-hidden">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
