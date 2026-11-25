import type { Metadata } from 'next';
import Link from 'next/link';

import { RankedNumbers, type NumbersLabels } from '@/components/ranked/ranked-numbers';
import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { PageHeading } from '@/components/ui/section-heading';
import { getGameModeMap, rankedLeagueIconUrl } from '@/lib/brawlapi';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { titleCaseLabel } from '@/lib/format';
import { localePath, rankLabel } from '@/lib/i18n';
import { gameWords } from '@/lib/i18n-game';
import { RANK_BRACKETS } from '@/lib/rank-brackets';
import { NUMBER_MODES, RANK_KEYS } from '@/lib/ranked-numbers';
import { getRankNumbers } from '@/lib/ranked-numbers-data';
import { requestLocale } from '@/lib/request-locale';
import { currentMonth } from '@/lib/site';
import { getT } from '@/lib/t';
import type { BAGameMode } from '@/types/brawlapi';

/**
 * Ranked bans, kills, deaths and damage (2026-11-25). The battle log carries
 * them since November; we keep them since today. Mythic and up first: most of
 * the people who come are.
 */
export const revalidate = 7200;

export function generateMetadata(): Metadata {
  const t = getT(requestLocale());
  return {
    alternates: { canonical: '/ranked/stats' },
    title: t('Most banned brawlers and Ranked stats ({v})', { v: currentMonth() }),
    description: t('The most banned brawlers in Brawl Stars Ranked by rank and by map, and who kills, dies, heals and deals damage the most. From real games, updated every 2 hours.'),
  };
}

export default async function RankedStatsPage() {
  const locale = requestLocale();
  const t = getT(locale);
  const [data, catalog, modeMeta, words] = await Promise.all([
    getRankNumbers('mythic-plus'),
    getBrawlerCatalog().catch(() => null),
    getGameModeMap().catch(() => new Map<string, BAGameMode>()),
    gameWords(locale),
  ]);
  const bracketOf = (key: string) => RANK_BRACKETS.find((b) => b.slug === key);
  const labels: NumbersLabels = {
    ranks: RANK_KEYS.map((key) => {
      const b = bracketOf(key);
      return { key, label: b ? rankLabel(b, locale) : t('Mythic and up'), icon: rankedLeagueIconUrl(b?.icon ?? 'Mythic') ?? null };
    }),
    modes: Object.fromEntries(NUMBER_MODES.map((m) => [m, { label: words.mode(m), icon: modeMeta.get(m.toLowerCase())?.imageUrl ?? null }])),
    maps: Object.fromEntries(data.maps.map((m) => [m.map, locale === 'en' ? titleCaseLabel(m.map) : words.map(m.map)])),
    brawlers: Object.fromEntries((catalog?.all ?? []).map((b) => [b.id, titleCaseLabel(b.name)])),
  };

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Ranked', path: '/ranked' },
          { name: 'Ranked stats', path: '/ranked/stats' },
        ])}
      />
      <PageHeading
        title={t('Ranked stats')}
        subtitle={t('Who gets banned, who kills the most, who dies the most and who deals the most damage, by rank.')}
      />
      <RankedNumbers first={data} labels={labels} />
      <p className="text-sm text-muted">
        {t('From real Ranked battles, updated every 2 hours')}.{' '}
        <Link href={localePath(locale, '/tier-list/ranked')} className="font-semibold text-brand hover:underline">{t('Ranked tier list')}</Link>
      </p>
    </div>
  );
}
