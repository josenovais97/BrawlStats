import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { CounterSearch } from '@/components/home/counter-search';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { formatPercent, titleCase } from '@/lib/format';
import { getTopMetaBrawlers } from '@/lib/home-meta';
import { localePath, rankLabel } from '@/lib/i18n';
import { RANK_BRACKETS, bracketIconUrl } from '@/lib/rank-brackets';
import { requestLocale } from '@/lib/request-locale';
import { brawlerPath, slugify } from '@/lib/slugs';
import { getT } from '@/lib/t';
import { TIER_COLOR } from '@/lib/tiers';

/**
 * The meta in one row (2026-10-30), the way the game lays out a brawler
 * select: five portraits, each with its tier as a badge, the score under the
 * name. Then the two questions that follow -- what is strong at my rank, and
 * what beats the brawler I keep losing to. Replaces three sections that said
 * this at greater length (the snapshot, "play your rank", the split).
 */
export async function HomeMetaNow() {
  const locale = requestLocale();
  const t = getT(locale);
  const lp = (path: string) => localePath(locale, path);
  const [top, catalog] = await Promise.all([
    getTopMetaBrawlers(5).catch(() => []),
    getBrawlerCatalog().catch(() => null),
  ]);
  const all = (catalog?.current ?? [])
    .map((b) => ({ name: titleCase(b.name), slug: slugify(b.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (top.length === 0) return null;

  return (
    <section aria-labelledby="meta-now" className="sd-meta min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="meta-now" className="sd-slam display text-game-stroke text-3xl sm:text-4xl">{t('Best in Ranked right now')}</h2>
        <Link
          href={lp('/tier-list/ranked')}
          className="btn-game inline-flex shrink-0 items-center bg-surface-3 px-4 py-2 text-base text-white [--btn-shadow:var(--ink)] hover:bg-[#31439a]"
        >
          {t('Full tier list')}
        </Link>
      </div>

      <ol className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-4 sm:overflow-visible sm:px-0">
        {top.map((b, i) => (
          <li key={b.brawlerId} className="sd-pop w-[40%] shrink-0 snap-start sm:w-auto" style={{ '--i': i } as CSSProperties}>
            <Link
              href={lp(brawlerPath(b.brawlerId, b.name))}
              prefetch={false}
              className="card card-interactive relative flex h-full flex-col items-center overflow-hidden px-2 pb-3 pt-3 text-center"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: `radial-gradient(90% 60% at 50% 30%, color-mix(in srgb, ${TIER_COLOR[b.tier]} 30%, transparent), transparent 70%)` }}
              />
              <span className="display absolute left-2 top-2 z-10 text-sm text-muted">#{i + 1}</span>
              <span
                className="sd-stamp tier-badge tier-badge-sm absolute right-2 top-2 z-10"
                style={{ '--tier': TIER_COLOR[b.tier], '--i': i } as CSSProperties}
                title={t('{tier} tier', { tier: b.tier })}
              >
                <span aria-hidden className="display text-game-stroke text-xl leading-none">{b.tier}</span>
                <span className="sr-only">{t('{tier} tier', { tier: b.tier })}</span>
              </span>
              <Image
                src={b.portraitUrl}
                alt=""
                width={120}
                height={120}
                className="relative mt-4 size-24 object-contain drop-shadow-[0_8px_8px_rgb(0_0_0/0.45)] sm:size-28"
                unoptimized
              />
              <span className="display text-game-stroke relative mt-2 w-full truncate text-xl">{titleCase(b.name)}</span>
              <span className="relative text-sm text-muted">
                <strong className="tabular-nums text-foreground">{b.score.toFixed(1)}</strong>/10
                {b.winRate !== null ? <> {t('{rate} win', { rate: formatPercent(b.winRate) })}</> : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="sd-swing card min-w-0 space-y-3 p-4 sm:p-5">
          <h3 className="display text-xl">{t('Tier list at your rank')}</h3>
          <ul className="grid grid-cols-2 gap-2">
            {RANK_BRACKETS.map((b) => (
              <li key={b.slug} className="min-w-0">
                <Link
                  href={lp(`/tier-list/ranked/rank/${b.slug}`)}
                  prefetch={false}
                  className="bz-chip flex min-w-0 items-center gap-2.5 px-3 py-2 text-sm"
                >
                  <Image src={bracketIconUrl(b)} alt="" width={28} height={28} className="size-7 shrink-0" unoptimized />
                  <span className="min-w-0 truncate">{rankLabel(b, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="sd-swing card min-w-0 space-y-3 p-4 sm:p-5">
          <h3 className="display text-xl">{t('How to counter…')}</h3>
          <p className="text-sm text-muted">{t('Pick the brawler you keep losing to.')}</p>
          <CounterSearch brawlers={all} />
        </div>
      </div>
    </section>
  );
}
