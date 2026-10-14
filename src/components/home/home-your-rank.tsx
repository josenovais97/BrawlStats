import Image from 'next/image';
import Link from 'next/link';

import { CounterSearch } from '@/components/home/counter-search';
import { HomeSection } from '@/components/home/home-section';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { formatPercent, titleCase } from '@/lib/format';
import { localePath, rankLabel } from '@/lib/i18n';
import { RANK_BRACKETS, bracketIconUrl } from '@/lib/rank-brackets';
import { requestLocale } from '@/lib/request-locale';
import { slugify } from '@/lib/slugs';
import { getBrawlerStatsForWindow } from '@/lib/stats';
import { getT } from '@/lib/t';

/** How many of the most-picked Ranked brawlers get a counters shortcut. */
const MOST_PICKED = 8;

/**
 * The two questions a Ranked player brings, side by side: what is strong at
 * my rank, and what beats the thing I keep losing to.
 *
 * Added 2026-10-14. The rank tier lists and the counters pages were the
 * newest and most specific answers on the site, and nothing on the home page
 * led to either -- a reader had to find them through the tier list's chips or
 * a brawler page. The counters shortcuts are the brawlers picked most in
 * Ranked this week, because those are the ones a player is most likely to be
 * facing.
 */
export async function HomeYourRank() {
  const locale = requestLocale();
  const t = getT(locale);
  const lp = (path: string) => localePath(locale, path);

  const [rows, catalog] = await Promise.all([
    getBrawlerStatsForWindow(7, undefined, 'ranked').catch(() => []),
    getBrawlerCatalog().catch(() => null),
  ]);
  const popular = rows
    .filter((r) => (r.usageRate ?? 0) > 0)
    .sort((a, b) => (b.usageRate ?? 0) - (a.usageRate ?? 0))
    .slice(0, MOST_PICKED);
  const all = (catalog?.current ?? [])
    .map((b) => ({ name: titleCase(b.name), slug: slugify(b.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <HomeSection
      id="your-rank"
      eyebrow={t('Ranked')}
      title={t('Play your rank, beat the meta')}
      subtitle={t('The meta at your rank is not the meta at the top. And every pick has an answer.')}
      ctaHref={lp('/tier-list/ranked')}
      ctaLabel={t('Ranked tier list')}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* min-w-0 throughout: grid items default to their content's width,
            which pushed both cards past a phone's edge. */}
        <div className="card min-w-0 space-y-3 p-4 sm:p-5">
          <h3 className="display text-lg uppercase">{t('Tier list at your rank')}</h3>
          <p className="text-sm text-muted">{t('Built only from battles played at that rank.')}</p>
          <ul className="grid grid-cols-2 gap-2">
            {RANK_BRACKETS.map((b) => (
              <li key={b.slug} className="min-w-0">
                <Link
                  href={lp(`/tier-list/ranked/rank/${b.slug}`)}
                  className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-surface-2/60 px-3 py-2.5 text-sm font-bold transition-colors hover:border-brand/50"
                >
                  <Image src={bracketIconUrl(b)} alt="" width={28} height={28} className="size-7 shrink-0" unoptimized />
                  <span className="min-w-0 truncate">{rankLabel(b, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="card min-w-0 space-y-3 p-4 sm:p-5">
          <h3 className="display text-lg uppercase">{t('How to counter…')}</h3>
          <p className="text-sm text-muted">{t('The brawlers picked most in Ranked this week. Tap one for what beats it, at every rank.')}</p>
          <ul className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {popular.map((r) => (
              <li key={r.brawlerId} className="min-w-0">
                <Link
                  href={lp(`/brawlers/${slugify(r.brawlerName)}/counters`)}
                  title={t('How to counter {name}', { name: titleCase(r.brawlerName) })}
                  className="flex min-w-0 flex-col items-center gap-1 rounded-xl border border-border bg-surface-2/60 px-1 py-2 text-center transition-colors hover:border-brand/50"
                >
                  <Image src={brawlerIconUrl(r.brawlerId)} alt="" width={44} height={44} className="size-11 rounded-lg" unoptimized />
                  <span className="w-full truncate text-xs font-bold">{titleCase(r.brawlerName)}</span>
                  <span className="text-[10px] tabular-nums text-muted">{t('{rate} picked', { rate: formatPercent(r.usageRate) })}</span>
                </Link>
              </li>
            ))}
          </ul>
          <CounterSearch brawlers={all} />
        </div>
      </div>
    </HomeSection>
  );
}
