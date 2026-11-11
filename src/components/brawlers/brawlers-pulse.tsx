import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { localePath } from '@/lib/i18n';
import { brawlerPath } from '@/lib/slugs';
import type { ScoredBrawler } from '@/lib/stats';
import { getT } from '@/lib/t';
import { TIER_COLOR, TIER_ORDER } from '@/lib/tiers';
import { requestLocale } from '@/lib/request-locale';
import type { MetaMover, Tier } from '@/types/stats';

interface Row {
  id: number;
  name: string;
  image: string | null;
  tier: Tier | null;
  value: string;
  tone: string;
  note?: string;
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase());

/**
 * The roster's week before the grid (2026-11-11): the three strongest, the
 * three that rose most and fell most, and how the tiers are spread. Same
 * meta score and 7-day movers the tier list and /meta use.
 */
export function BrawlersPulse({
  meta,
  movers,
  images,
}: {
  meta: Map<number, ScoredBrawler>;
  movers: MetaMover[];
  images: Map<number, { name: string; image: string | null }>;
}) {
  const locale = requestLocale();
  const t = getT(locale);
  const rated = [...meta.values()].filter((s) => s.metaScore !== null && s.tier);
  if (rated.length < 10) return null;
  const pct = (v: number | null) => (v === null ? '–' : `${(v * 100).toFixed(1)}%`);
  const nameOf = (id: number, fallback: string) => titleCase(images.get(id)?.name ?? fallback);

  const strongest: Row[] = [...rated]
    .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
    .slice(0, 3)
    .map((s) => ({
      id: s.brawlerId,
      name: nameOf(s.brawlerId, s.brawlerName),
      image: images.get(s.brawlerId)?.image ?? null,
      tier: s.tier,
      value: pct(s.normalizedWinRate),
      tone: (s.normalizedWinRate ?? 0) >= 0.5 ? 'text-victory' : 'text-foreground',
    }));
  const moverRow = (m: MetaMover): Row => ({
    id: m.brawlerId,
    name: nameOf(m.brawlerId, m.brawlerName),
    image: images.get(m.brawlerId)?.image ?? null,
    tier: m.tierNow,
    value: `${m.metaScoreDelta > 0 ? '▲ +' : '▼ −'}${Math.abs(m.metaScoreDelta).toFixed(1)}`,
    tone: m.metaScoreDelta > 0 ? 'text-victory' : 'text-defeat',
    note: m.tierBefore !== m.tierNow ? `${m.tierBefore} → ${m.tierNow}` : undefined,
  });
  const rising = movers.filter((m) => m.metaScoreDelta >= 0.3).slice(0, 3).map(moverRow);
  const falling = [...movers]
    .filter((m) => m.metaScoreDelta <= -0.3)
    .sort((a, b) => a.metaScoreDelta - b.metaScoreDelta)
    .slice(0, 3)
    .map(moverRow);

  const counts = TIER_ORDER.map((tier) => ({ tier, n: rated.filter((s) => s.tier === tier).length })).filter((c) => c.n > 0);

  return (
    <section className="card p-5 sm:p-6">
      <div className="grid gap-5 md:grid-cols-3">
        <Column title={t('Strongest right now')} hint={t('Ranked win rate')} rows={strongest} locale={locale} />
        {rising.length > 0 ? <Column title={t('Rising this week')} hint={t('Meta score')} rows={rising} locale={locale} /> : null}
        {falling.length > 0 ? <Column title={t('Falling this week')} hint={t('Meta score')} rows={falling} locale={locale} /> : null}
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex h-3 overflow-hidden rounded-full border-2 border-ink">
          {counts.map((c) => (
            <div key={c.tier} title={`${c.tier}: ${c.n}`} style={{ flexGrow: c.n, background: TIER_COLOR[c.tier] }} />
          ))}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {counts.map((c) => (
            <span key={c.tier}>
              <span className="font-bold" style={{ color: TIER_COLOR[c.tier] }}>{c.tier}</span> {c.n}
            </span>
          ))}
          <span>{t('{n} rated brawlers in Ranked this week', { n: rated.length })}</span>
        </p>
      </div>
    </section>
  );
}

function Column({ title, hint, rows, locale }: { title: string; hint: string; rows: Row[]; locale: ReturnType<typeof requestLocale> }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="label-game text-sm">{title}</h2>
        <span className="text-[11px] text-muted">{hint}</span>
      </div>
      <ol className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={localePath(locale, brawlerPath(r.id, r.name))}
              prefetch={false}
              className="row-interactive flex items-center gap-2.5 rounded-xl bg-surface-2/50 px-2.5 py-2"
            >
              {r.image ? (
                <Image src={r.image} alt="" width={36} height={36} unoptimized className="size-9 shrink-0 rounded-lg border-2 border-ink bg-surface-3 object-cover" />
              ) : (
                <span className="size-9 shrink-0 rounded-lg bg-surface-3" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{r.name}</span>
                {r.note ? <span className="block text-xs text-muted">{r.note}</span> : null}
              </span>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${r.tone}`}>{r.value}</span>
              {r.tier ? (
                <span className="tier-badge tier-badge-sm shrink-0" style={{ '--tier': TIER_COLOR[r.tier] } as CSSProperties}>
                  <span className="display text-game-stroke text-lg leading-none">{r.tier}</span>
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
