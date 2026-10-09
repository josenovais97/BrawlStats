import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl, brawlerModelUrl, hasBrawlerModel } from '@/lib/brawlapi';
import { formatPercent, titleCaseLabel } from '@/lib/format';
import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/tiers';
import type { TierListEntry } from '@/types/stats';
import type { BABrawler } from '@/types/brawlapi';

/**
 * The top three, as the first thing on the page.
 *
 * The answer was a sentence -- "Amber, Bo and Wendy are the best brawlers in
 * Ranked right now" -- and the brawlers themselves first appeared as 72px
 * portraits below the controls and the week's changes; on a phone, not one
 * brawler was on the first screen. This is the profile showcase's treatment:
 * the three drawn full-body on their rarity colour, first place in the middle
 * and raised, each a link to its build page.
 *
 * The sentence stays above it, unchanged: it is what search engines and
 * answer engines quote.
 */
export async function TierPodium({
  best,
  brawlerMeta,
}: {
  best: TierListEntry[];
  brawlerMeta: Map<number, BABrawler>;
}) {
  const top = best.slice(0, 3);
  if (top.length < 3) return null;

  const models = await Promise.all(top.map((b) => hasBrawlerModel(b.brawlerId).catch(() => false)));
  const art = (b: TierListEntry, i: number) =>
    models[i] ? brawlerModelUrl(b.brawlerId) : (brawlerMeta.get(b.brawlerId)?.imageUrl ?? brawlerIconUrl(b.brawlerId));

  // Second, first, third: the winner in the middle, as podiums stand.
  const order = [1, 0, 2];
  return (
    <ol className="mt-5 grid grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Top three right now">
      {order.map((i) => {
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
                  src={art(b, i)}
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
                {b.tier ? (
                  <span className="display" style={{ color: TIER_COLOR[b.tier] }}>
                    {b.tier}
                  </span>
                ) : null}
                <span className="font-black tabular-nums">{b.metaScore?.toFixed(1) ?? '—'}</span>
                <span className="hidden text-muted sm:inline">/10</span>
              </p>
              <p className="text-[10px] tabular-nums text-muted sm:text-xs">
                {formatPercent(b.normalizedWinRate)} win rate
              </p>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
