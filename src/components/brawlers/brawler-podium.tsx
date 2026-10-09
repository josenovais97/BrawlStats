import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl, brawlerModelUrl, hasBrawlerModel } from '@/lib/brawlapi';
import { titleCaseLabel } from '@/lib/format';
import { wikiThumb } from '@/lib/skin-art';
import { brawlerPath } from '@/lib/slugs';
import { getWikiModel } from '@/lib/wiki-art';
import type { BABrawler } from '@/types/brawlapi';

export interface PodiumItem {
  brawlerId: number;
  brawlerName: string;
  /** The big number under the name, e.g. "8.9" or "60.9%". */
  headline: string;
  /** One quiet line under it, e.g. "55.1% win rate" or "+5.6 vs usual". */
  detail?: string;
  /** A coloured letter before the headline, e.g. the tier. */
  badge?: { text: string; color: string };
}

/**
 * A top-three podium: the three drawn full-body on their rarity colour,
 * first place in the middle and raised, each a link to its build page.
 *
 * Shared by the tier lists and the map pages so the two cannot drift apart.
 * Art: the mirror's model, then the wiki's full-body render, then the
 * portrait -- so a podium never mixes figures with a square tile.
 */
export async function BrawlerPodium({
  items,
  brawlerMeta,
  label,
}: {
  items: PodiumItem[];
  brawlerMeta: Map<number, BABrawler>;
  label: string;
}) {
  const top = items.slice(0, 3);
  if (top.length < 3) return null;

  const arts = await Promise.all(
    top.map(async (b) => {
      if (await hasBrawlerModel(b.brawlerId).catch(() => false)) return brawlerModelUrl(b.brawlerId);
      const wiki = await getWikiModel(b.brawlerName).catch(() => null);
      if (wiki) return wikiThumb(wiki, 400);
      return brawlerMeta.get(b.brawlerId)?.imageUrl ?? brawlerIconUrl(b.brawlerId);
    }),
  );

  // Second, first, third: the winner in the middle, as podiums stand.
  return (
    <ol className="mt-5 grid grid-cols-3 items-end gap-2 sm:gap-4" aria-label={label}>
      {[1, 0, 2].map((i) => {
        const b = top[i];
        const tint = brawlerMeta.get(b.brawlerId)?.rarity.color ?? 'var(--brand)';
        const first = i === 0;
        return (
          <li key={b.brawlerId} className={first ? '' : 'pt-6 sm:pt-10'}>
            <Link
              href={brawlerPath(b.brawlerId, b.brawlerName)}
              prefetch={false}
              className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-border pb-3 transition-colors hover:border-brand/60"
              style={{
                background: `linear-gradient(170deg, color-mix(in srgb, ${tint} 30%, transparent), var(--surface) 68%)`,
              }}
            >
              <span
                className={`display absolute left-2 top-2 z-10 rounded-md px-2 py-0.5 text-sm sm:left-3 sm:top-3 sm:text-base ${
                  first ? 'bg-brand text-brand-ink' : 'bg-background/70 text-foreground'
                }`}
              >
                #{i + 1}
              </span>
              <div className={`relative flex w-full items-end justify-center pt-6 ${first ? 'h-36 sm:h-56' : 'h-28 sm:h-44'}`}>
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-2 left-1/2 size-32 -translate-x-1/2 rounded-full opacity-45 blur-2xl sm:size-44"
                  style={{ background: tint }}
                />
                <Image
                  src={arts[i]}
                  alt={b.brawlerName}
                  width={240}
                  height={240}
                  className={`relative w-auto object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.55)] transition-transform group-hover:scale-105 ${
                    first ? 'h-32 sm:h-52' : 'h-24 sm:h-40'
                  }`}
                  priority
                  unoptimized
                />
              </div>
              <p className="display mt-1 w-full truncate px-1 text-center text-sm uppercase sm:text-xl">
                {titleCaseLabel(b.brawlerName)}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs sm:text-sm">
                {b.badge ? (
                  <span className="display" style={{ color: b.badge.color }}>
                    {b.badge.text}
                  </span>
                ) : null}
                <span className="font-black tabular-nums">{b.headline}</span>
              </p>
              {b.detail ? (
                <p className="px-1 text-center text-[10px] tabular-nums text-muted sm:text-xs">{b.detail}</p>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
