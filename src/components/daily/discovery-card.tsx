import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent } from '@/lib/format';
import type { Discovery, DiscoveryKind } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';

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
  headline: (d: Discovery) => string;
  detail: (d: Discovery) => string;
  stat: (d: Discovery) => { value: string; label: string };
  cta: string;
  /** Drives the card's accent. Two hues only: a find, or a warning. */
  tone: 'good' | 'bad';
}

const pts = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(1)} pts`;

const COPY: Record<DiscoveryKind, Copy> = {
  'secret-pick': {
    eyebrow: 'The secret pick',
    tone: 'good',
    headline: (d) => `Almost nobody picks ${cap(d.brawlerNames[0])}. It is winning anyway.`,
    detail: (d) =>
      `${formatPercent(d.value)} adjusted win rate on just ${formatPercent(d.comparison)} of picks — one of the strongest records on the roster, from a brawler most drafts never consider.`,
    stat: (d) => ({ value: formatPercent(d.value), label: 'adjusted win rate' }),
    cta: 'See the full record',
  },
  'meta-trap': {
    eyebrow: 'The meta trap',
    tone: 'bad',
    headline: (d) => `${cap(d.brawlerNames[0])} is everywhere, and losing.`,
    detail: (d) =>
      `Picked in ${formatPercent(d.comparison)} of sampled battles and returning ${formatPercent(d.value)} adjusted — below the average of the very players picking it.`,
    stat: (d) => ({ value: formatPercent(d.comparison), label: 'of all picks' }),
    cta: 'See why it underperforms',
  },
  'giant-killer': {
    eyebrow: 'The giant killer',
    tone: 'good',
    headline: (d) => `${cap(d.brawlerNames[0])} owns ${cap(d.brawlerNames[1])}.`,
    detail: (d) =>
      `${formatPercent(d.value)} against ${cap(d.brawlerNames[1])} specifically, ${pts(
        d.value - d.comparison,
      )} above ${cap(d.brawlerNames[0])}'s own record. The most lopsided matchup in the sample.`,
    stat: (d) => ({ value: pts(d.value - d.comparison), label: 'vs its usual form' }),
    cta: 'See every matchup',
  },
  'secret-duo': {
    eyebrow: 'The secret duo',
    tone: 'good',
    headline: (d) => `${cap(d.brawlerNames[0])} and ${cap(d.brawlerNames[1])} belong together.`,
    detail: (d) =>
      `Teamed up, ${cap(d.brawlerNames[0])} wins ${formatPercent(d.value)} — ${pts(
        d.value - d.comparison,
      )} better than it does otherwise. Neither is picked for the other.`,
    stat: (d) => ({ value: pts(d.value - d.comparison), label: 'when paired' }),
    cta: 'See who else pairs well',
  },
  'map-surprise': {
    eyebrow: 'The map surprise',
    tone: 'good',
    headline: (d) => `${cap(d.brawlerNames[0])} is a different brawler on ${d.context}.`,
    detail: (d) =>
      `${formatPercent(d.value)} here against ${formatPercent(
        d.comparison,
      )} across every other map — the widest gap between a brawler and one piece of terrain.`,
    stat: (d) => ({ value: pts(d.value - d.comparison), label: `on ${d.context ?? 'this map'}` }),
    cta: 'See the map',
  },
  'overnight-rise': {
    eyebrow: 'The overnight rise',
    tone: 'good',
    headline: (d) => `${cap(d.brawlerNames[0])} moved more than anything else since yesterday.`,
    detail: (d) =>
      `Meta score ${d.comparison.toFixed(1)} to ${d.value.toFixed(
        1,
      )} in a single day, on enough battles for the move to be real rather than noise.`,
    stat: (d) => ({ value: `+${(d.value - d.comparison).toFixed(1)}`, label: 'meta score, 1 day' }),
    cta: 'See what changed',
  },
};

function cap(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export function DiscoveryCard({
  discovery,
  brawlerMeta,
  index,
}: {
  discovery: Discovery;
  brawlerMeta: Map<number, BABrawler>;
  index: number;
}) {
  const copy = COPY[discovery.kind];
  const stat = copy.stat(discovery);
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
            <Image
              key={id}
              src={brawlerMeta.get(id)?.imageUrl ?? brawlerIconUrl(id)}
              alt=""
              width={72}
              height={72}
              className={`rounded-xl bg-surface-2 ${
                i === 0 ? 'size-16 sm:size-[72px]' : 'size-12 opacity-70 sm:size-14'
              }`}
              loading={index < 2 ? 'eager' : 'lazy'}
              unoptimized
            />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: accent }}
          >
            {copy.eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">
            {copy.headline(discovery)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {copy.detail(discovery)}
          </p>
          <p className="mt-2 text-xs tabular-nums text-muted">
            From {formatNumber(discovery.sampleSize)} sampled battles.
          </p>
          <Link
            href={discovery.href}
            prefetch={false}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:underline"
          >
            {copy.cta}
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
