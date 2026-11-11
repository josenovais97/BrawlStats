import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { localePath } from '@/lib/i18n';
import { brawlerPath } from '@/lib/slugs';
import { getMetaMovers } from '@/lib/stats';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import type { BABrawler } from '@/types/brawlapi';
import type { MetaMover } from '@/types/stats';

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());

/**
 * The week's biggest moves under the podium (2026-11-11): three rising, three
 * falling, each with its tier change, and the way into the weekly report.
 */
export async function HomeMovers() {
  const locale = requestLocale();
  const t = getT(locale);
  const [movers, art] = await Promise.all([
    getMetaMovers(7).catch(() => [] as MetaMover[]),
    getBrawlerArtMap().catch(() => new Map<number, BABrawler>()),
  ]);
  const rising = movers.filter((m) => m.metaScoreDelta >= 0.3).slice(0, 3);
  const falling = [...movers].filter((m) => m.metaScoreDelta <= -0.3).sort((a, b) => a.metaScoreDelta - b.metaScoreDelta).slice(0, 3);
  if (rising.length + falling.length === 0) return null;

  const row = (m: MetaMover) => {
    const name = titleCase(art.get(m.brawlerId)?.name ?? m.brawlerName);
    const up = m.metaScoreDelta > 0;
    return (
      <li key={m.brawlerId}>
        <Link href={localePath(locale, brawlerPath(m.brawlerId, name))} prefetch={false} className="row-interactive flex items-center gap-2.5 rounded-xl bg-surface-2/50 px-2.5 py-2">
          <Image src={art.get(m.brawlerId)?.imageUrl ?? brawlerIconUrl(m.brawlerId)} alt="" width={36} height={36} unoptimized className="size-9 shrink-0 rounded-lg border-2 border-ink bg-surface-3" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{name}</span>
            <span className="block text-xs text-muted">{m.tierBefore !== m.tierNow ? `${m.tierBefore} → ${m.tierNow}` : t('{tier} tier', { tier: m.tierNow })}</span>
          </span>
          <span className={`shrink-0 text-sm font-black tabular-nums ${up ? 'text-victory' : 'text-defeat'}`}>
            {up ? '▲ +' : '▼ −'}
            {Math.abs(m.metaScoreDelta).toFixed(1)}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-2xl leading-none">{t('This week in Ranked')}</h2>
        <Link href={localePath(locale, '/meta')} className="text-sm font-bold text-brand hover:underline">
          {t('Weekly report →')}
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {rising.length > 0 ? (
          <div>
            <h3 className="label-game mb-2 text-sm text-victory">{t('Rising this week')}</h3>
            <ol className="space-y-1.5">{rising.map(row)}</ol>
          </div>
        ) : null}
        {falling.length > 0 ? (
          <div>
            <h3 className="label-game mb-2 text-sm text-defeat">{t('Falling this week')}</h3>
            <ol className="space-y-1.5">{falling.map(row)}</ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
