import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { localePath, rankLabel } from '@/lib/i18n';
import { RANK_BRACKETS, bracketIconUrl } from '@/lib/rank-brackets';
import { getStoredBracketRoster } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import type { BABrawler } from '@/types/brawlapi';

/**
 * The top three at each Ranked rank, beside the page's opening sentence
 * (2026-11-11), each card linking to that rank's tier list. Precomputed
 * per-rank lists only; a rank without one is left out.
 */
export async function RankedHeroRanks({ brawlerMeta }: { brawlerMeta: Map<number, BABrawler> }) {
  const locale = requestLocale();
  const t = getT(locale);
  const cards = [];
  for (const bracket of RANK_BRACKETS) {
    const roster = await getStoredBracketRoster(bracket.id).catch(() => null);
    if (!roster) continue;
    const top = roster.scored
      .filter((s) => s.metaScore !== null)
      .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
      .slice(0, 3);
    if (top.length === 3) cards.push({ bracket, top });
  }
  if (cards.length < 2) return null;
  return (
    <div>
      <p className="label-game mb-2 text-sm text-muted">{t('Best at your rank')}</p>
      <ul className="grid grid-cols-2 gap-2.5">
        {cards.map(({ bracket, top }) => (
          <li key={bracket.id}>
            <Link
              href={localePath(locale, `/tier-list/ranked/rank/${bracket.slug}`)}
              prefetch={false}
              className="card row-interactive flex h-full flex-col gap-2.5 p-3"
            >
              <span className="flex items-center gap-2">
                <Image src={bracketIconUrl(bracket)} alt="" width={28} height={28} unoptimized className="size-7 shrink-0 object-contain" />
                <span className="line-clamp-2 text-sm font-bold leading-tight">{rankLabel(bracket, locale)}</span>
              </span>
              <span className="flex gap-1.5">
                {top.map((s) => (
                  <Image
                    key={s.brawlerId}
                    src={brawlerMeta.get(s.brawlerId)?.imageUrl ?? brawlerIconUrl(s.brawlerId)}
                    alt={brawlerMeta.get(s.brawlerId)?.name ?? s.brawlerName}
                    title={brawlerMeta.get(s.brawlerId)?.name ?? s.brawlerName}
                    width={40}
                    height={40}
                    unoptimized
                    className="size-10 rounded-lg border-2 border-ink bg-surface-3"
                  />
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
