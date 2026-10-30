import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent, titleCase } from '@/lib/format';
import type { Discovery, DiscoveryKind } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import { getUT } from '@/lib/t-universal';
import type { T } from '@/lib/t-core';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

/**
 * One finding, written as a sentence rather than shown as a row.
 *
 * The copy is templated per kind and filled with the numbers — deterministic,
 * so the same data always produces the same sentence, and there is no model in
 * the loop to invent a claim the data does not support. What varies is only
 * what the argmax picked.
 *
 * Each card states its own evidence. A discovery that reads as a bold claim
 * with no sample size behind it is exactly the kind of thing this site exists
 * not to publish, so the battle count sits on the card rather than a caveat
 * page.
 */
interface Copy {
  eyebrow: string;
  headline: (d: Discovery, t: T) => string;
  detail: (d: Discovery, t: T) => string;
  stat: (d: Discovery, t: T) => { value: string; label: string };
  cta: string;
  tone: 'good' | 'bad';
  pair?: 'vs' | '+';
}

/** "+3.4 pts", with the page's decimal separator. */
const pts = (n: number) => `${n >= 0 ? '+' : '−'}${formatPercent(Math.abs(n)).replace('%', '')} pts`;
const name = (d: Discovery, i: number) => titleCase(d.brawlerNames[i]);
const dec = (n: number) => formatPercent(n / 100).replace('%', '');

/*
 * Every sentence is one template with named slots, so a translation can put
 * the brawler, the map and the numbers wherever its grammar wants them.
 */
const COPY: Record<DiscoveryKind, Copy> = {
  'secret-pick': {
    eyebrow: 'The secret pick',
    tone: 'good',
    headline: (d, t) => t('Almost nobody picks {name}. It is winning anyway.', { name: name(d, 0) }),
    detail: (d, t) =>
      t(
        '{rate} adjusted win rate on just {picks} of picks — one of the strongest records on the roster, from a brawler most drafts never consider.',
        { rate: formatPercent(d.value), picks: formatPercent(d.comparison) },
      ),
    stat: (d, t) => ({ value: formatPercent(d.value), label: t('adjusted win rate') }),
    cta: 'See the full record',
  },
  'meta-trap': {
    eyebrow: 'The meta trap',
    tone: 'bad',
    headline: (d, t) => t('{name} is everywhere, and losing.', { name: name(d, 0) }),
    detail: (d, t) =>
      t('Picked in {picks} of sampled battles and returning {rate} adjusted — below the average of the very players picking it.', {
        picks: formatPercent(d.comparison),
        rate: formatPercent(d.value),
      }),
    stat: (d, t) => ({ value: formatPercent(d.comparison), label: t('of all picks') }),
    cta: 'See why it underperforms',
  },
  'giant-killer': {
    eyebrow: 'The giant killer',
    tone: 'good',
    pair: 'vs',
    headline: (d, t) => t('{name} owns {other}.', { name: name(d, 0), other: name(d, 1) }),
    detail: (d, t) =>
      t("{rate} against {other} specifically, {edge} above {name}'s own record. The most lopsided matchup in the sample.", {
        rate: formatPercent(d.value),
        other: name(d, 1),
        edge: pts(d.value - d.comparison),
        name: name(d, 0),
      }),
    stat: (d, t) => ({ value: pts(d.value - d.comparison), label: t('vs its usual form') }),
    cta: 'See every matchup',
  },
  'secret-duo': {
    eyebrow: 'The secret duo',
    tone: 'good',
    pair: '+',
    headline: (d, t) => t('{name} and {other} belong together.', { name: name(d, 0), other: name(d, 1) }),
    detail: (d, t) =>
      t('Teamed up, {name} wins {rate} — {edge} better than it does otherwise. Neither is picked for the other.', {
        name: name(d, 0),
        rate: formatPercent(d.value),
        edge: pts(d.value - d.comparison),
      }),
    stat: (d, t) => ({ value: pts(d.value - d.comparison), label: t('when paired') }),
    cta: 'See who else pairs well',
  },
  'map-surprise': {
    eyebrow: 'The map surprise',
    tone: 'good',
    headline: (d, t) => t('{name} is a different brawler on {map}.', { name: name(d, 0), map: d.context ?? t('this map') }),
    detail: (d, t) =>
      t('{rate} here against {other} across every other map — the widest gap between a brawler and one piece of terrain.', {
        rate: formatPercent(d.value),
        other: formatPercent(d.comparison),
      }),
    stat: (d, t) => ({ value: pts(d.value - d.comparison), label: t('on {map}', { map: d.context ?? t('this map') }) }),
    cta: 'See the map',
  },
  'overnight-rise': {
    eyebrow: 'The overnight rise',
    tone: 'good',
    headline: (d, t) => t('{name} moved more than anything else since yesterday.', { name: name(d, 0) }),
    detail: (d, t) =>
      t('Meta score {from} to {to} in a single day, on enough battles for the move to be real rather than noise.', {
        from: dec(d.comparison),
        to: dec(d.value),
      }),
    stat: (d, t) => ({ value: `+${dec(d.value - d.comparison)}`, label: t('meta score, 1 day') }),
    cta: 'See what changed',
  },
};

export function DiscoveryCard({
  discovery,
  brawlerMeta,
  index,
}: {
  discovery: Discovery;
  brawlerMeta: Map<number, BABrawler>;
  index: number;
}) {
  const t = getUT();
  const lp = (path: string) => localePath(requestLocale(), path);
  const copy = COPY[discovery.kind];
  const stat = copy.stat(discovery, t);
  const accent = copy.tone === 'good' ? 'var(--accent-2)' : 'var(--defeat, #ff6b6b)';

  return (
    <article className="card card-glow relative overflow-hidden">
      <span className="block h-1 w-full" style={{ background: accent }} />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(90% 70% at 100% 0%, color-mix(in srgb, ${accent} 18%, transparent) 0%, transparent 60%)`,
        }}
      />

      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="flex shrink-0 items-center gap-2">
          {discovery.brawlerIds.slice(0, 2).map((id, i) => (
            <div key={id} className="flex items-center gap-2">
              {i > 0 && copy.pair ? (
                <span
                  aria-hidden
                  className="text-xs font-black uppercase tracking-wide text-muted"
                >
                  {copy.pair}
                </span>
              ) : null}
              <span className="flex flex-col items-center gap-1">
                <Image
                  src={brawlerMeta.get(id)?.imageUrl ?? brawlerIconUrl(id)}
                  alt=""
                  width={72}
                  height={72}
                  className={`rounded-xl bg-surface-2 ${
                    i === 0 ? 'size-16 sm:size-[72px]' : 'size-14 sm:size-16'
                  }`}
                  loading={index < 2 ? 'eager' : 'lazy'}
                  unoptimized
                />
                {discovery.brawlerNames[i] ? (
                  <span className="max-w-[5rem] truncate text-[11px] font-semibold leading-tight">
                    {titleCase(discovery.brawlerNames[i])}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="display text-base"
            style={{ color: accent }}
          >
            {t(copy.eyebrow)}
          </p>
          <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">
            {copy.headline(discovery, t)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {copy.detail(discovery, t)}
          </p>
          <p className="mt-2 text-xs tabular-nums text-muted">{t('From {sampleSize} sampled battles.', { sampleSize: formatNumber(discovery.sampleSize) })}</p>
          <Link
            href={lp(discovery.href)}
            prefetch={false}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:underline"
          >
            {t(copy.cta)}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="shrink-0 text-left sm:min-w-[7.5rem] sm:text-right">
          <p className="text-3xl font-black tabular-nums" style={{ color: accent }}>
            {stat.value}
          </p>
          <p className="text-xs leading-snug text-muted">{stat.label}</p>
        </div>
      </div>
    </article>
  );
}
