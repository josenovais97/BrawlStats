import Image from 'next/image';
import Link from 'next/link';

import { CounterSearch } from '@/components/home/counter-search';
import { HomePodium } from '@/components/home/home-podium';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { titleCase } from '@/lib/format';
import { getTopMetaBrawlers } from '@/lib/home-meta';
import { localePath, rankLabel } from '@/lib/i18n';
import { RANK_BRACKETS, bracketIconUrl } from '@/lib/rank-brackets';
import { requestLocale } from '@/lib/request-locale';
import { slugify } from '@/lib/slugs';
import { getT } from '@/lib/t';

/**
 * The meta, then the two questions that follow it (2026-10-30): the top three
 * in Ranked as the page's one scroll scene (home-podium.tsx), then what is
 * strong at my rank and what beats the brawler I keep losing to. Replaces
 * three sections that said this at greater length (the snapshot, "play your
 * rank", the split).
 */
export async function HomeMetaNow() {
  const locale = requestLocale();
  const t = getT(locale);
  const lp = (path: string) => localePath(locale, path);
  const [top, catalog] = await Promise.all([
    getTopMetaBrawlers(3).catch(() => []),
    getBrawlerCatalog().catch(() => null),
  ]);
  const all = (catalog?.current ?? [])
    .map((b) => ({ name: titleCase(b.name), slug: slugify(b.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (top.length < 3) return null;

  return (
    <section aria-labelledby="meta-now" className="min-w-0">
      <HomePodium top={top} />

      <div className="mt-6 flex justify-center">
        <Link
          href={lp('/tier-list/ranked')}
          className="btn-game inline-flex items-center bg-surface-3 px-5 py-2.5 text-lg text-white [--btn-shadow:var(--ink)] hover:bg-[#31439a]"
        >
          {t('Full tier list')}
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card min-w-0 space-y-3 p-4 sm:p-5">
          <h3 className="display text-xl">{t('Tier list at your rank')}</h3>
          <ul data-fx-cascade className="grid grid-cols-2 gap-2">
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
        <div className="card min-w-0 space-y-3 p-4 sm:p-5">
          <h3 className="display text-xl">{t('How to counter…')}</h3>
          <p className="text-sm text-muted">{t('Pick the brawler you keep losing to.')}</p>
          <CounterSearch brawlers={all} />
        </div>
      </div>
    </section>
  );
}
