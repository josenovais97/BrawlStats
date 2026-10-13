import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { formatNumber, formatPercent, titleCase } from '@/lib/format';
import { RANK_BRACKETS, bracketIconUrl } from '@/lib/rank-brackets';
import { currentMonth } from '@/lib/site';
import { slugify } from '@/lib/slugs';
import { getRankedCounterScores, type CounterScore } from '@/lib/stats';

/**
 * How to counter one brawler: its best counters in Ranked, the picks to avoid
 * into it, and the counters at each rank.
 *
 * Added 2026-10-13 as the permanent home of "counter of the day": "how to
 * counter X" is among the most searched Brawl Stars questions, and a TikTok
 * answer is gone in a day. Ranked battles only, measured the way the draft
 * helper measures them -- each matchup against what the two brawlers' own
 * rates would predict -- so a weak opponent does not make everyone look like
 * its counter.
 *
 * Runtime ISR like the brawler page: nothing built ahead, each page rendered
 * on first visit and kept for the read cache's two hours.
 */

export const revalidate = 7200;

/* Runtime ISR — see AGENTS.md trap 1. */
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

const WINDOW_DAYS = 21;
/** Ranked games against the brawler before a counter is listed, every rank. */
const MIN_GAMES = 150;
/** The same at one rank, where each list is a quarter of the data. */
const MIN_GAMES_AT_RANK = 60;
const MIN_EDGE = 0.01;

interface Row {
  brawlerId: number;
  name: string;
  slug: string;
  winRate: number;
  edge: number;
  games: number;
}

async function resolve(slug: string) {
  const catalog = await getBrawlerCatalog().catch(() => null);
  const entry = catalog?.bySlug.get(slugify(slug));
  if (!catalog || !entry) return null;
  const named = (s: CounterScore): Row => {
    const b = catalog.byId.get(s.brawlerId);
    return {
      brawlerId: s.brawlerId,
      name: titleCase(b?.name ?? `#${s.brawlerId}`),
      slug: slugify(b?.name ?? String(s.brawlerId)),
      winRate: s.winRate,
      edge: s.edge,
      games: s.decidedSampleSize,
    };
  };
  return { id: entry.id, name: titleCase(entry.name), slug: slugify(entry.name), named };
}

function split(scores: Map<number, CounterScore>, self: number, minGames: number, named: (s: CounterScore) => Row) {
  const rows = [...scores.values()]
    .filter((s) => s.brawlerId !== self && s.decidedSampleSize >= minGames)
    .map(named);
  return {
    // A counter has to win, and an avoid has to lose: an edge on a losing
    // record reads as a mistake to anyone who checks the number.
    counters: rows.filter((r) => r.edge >= MIN_EDGE && r.winRate >= 0.5).sort((a, b) => b.edge - a.edge),
    avoid: rows.filter((r) => r.edge <= -MIN_EDGE && r.winRate < 0.5).sort((a, b) => a.edge - b.edge),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const b = await resolve(slug);
  if (!b) return { title: 'Counters' };
  const scores = await getRankedCounterScores([b.id], WINDOW_DAYS).catch(() => new Map());
  const { counters } = split(scores, b.id, MIN_GAMES, b.named);
  const top = counters.slice(0, 3).map((c) => c.name);
  const description = top.length
    ? `The best counters to ${b.name} in Ranked are ${top.join(', ')}. Win rates against ${b.name} from real Ranked battles, by rank, updated every two hours.`
    : `Who beats ${b.name} in Brawl Stars Ranked, from real battles, by rank.`;
  return {
    title: `How to counter ${b.name} in Brawl Stars (${currentMonth()})`,
    description,
    alternates: { canonical: `/brawlers/${b.slug}/counters` },
    openGraph: { title: `How to counter ${b.name}`, description },
  };
}

function CounterList({ rows, good, against }: { rows: Row[]; good: boolean; against: string }) {
  if (rows.length === 0) {
    return <p className="card px-4 py-6 text-sm text-muted">Not enough Ranked battles against {against} yet.</p>;
  }
  return (
    <ol className="card divide-y divide-border overflow-hidden">
      {rows.map((r, i) => (
        <li key={r.brawlerId}>
          <Link
            href={`/brawlers/${r.slug}`}
            className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2/60"
          >
            <span className="w-6 text-center text-sm font-black tabular-nums text-muted">{i + 1}</span>
            <Image
              src={brawlerIconUrl(r.brawlerId)}
              alt=""
              width={44}
              height={44}
              className="size-11 shrink-0 rounded-lg bg-surface-2"
              unoptimized
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold leading-tight">{r.name}</span>
              <span className="block text-xs tabular-nums text-muted">
                {formatNumber(r.games)} Ranked games against {against}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className={`block font-black tabular-nums ${good ? 'text-victory' : 'text-defeat'}`}>
                {formatPercent(r.winRate)}
              </span>
              <span className="block text-xs tabular-nums text-muted">
                {r.edge >= 0 ? '+' : '−'}
                {Math.abs(r.edge * 100).toFixed(1)} vs expected
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default async function CountersPage({ params }: PageProps) {
  const { slug } = await params;
  const b = await resolve(slug);
  if (!b) notFound();

  const [all, ...byRank] = await Promise.all([
    getRankedCounterScores([b.id], WINDOW_DAYS).catch(() => new Map<number, CounterScore>()),
    ...RANK_BRACKETS.map((r) =>
      getRankedCounterScores([b.id], WINDOW_DAYS, r.id).catch(() => new Map<number, CounterScore>()),
    ),
  ]);
  const { counters, avoid } = split(all, b.id, MIN_GAMES, b.named);
  const ranks = RANK_BRACKETS.map((r, i) => ({
    bracket: r,
    counters: split(byRank[i], b.id, MIN_GAMES_AT_RANK, b.named).counters.slice(0, 3),
  }));

  const top = counters.slice(0, 3).map((c) => c.name);
  const faq = [
    {
      question: `What counters ${b.name} in Brawl Stars?`,
      answer: top.length
        ? `In Ranked, ${top.join(', ')} win most often against ${b.name}, beyond what their usual win rates would predict, over the last ${WINDOW_DAYS} days.`
        : `There are not enough Ranked battles against ${b.name} yet to name its counters.`,
    },
    {
      question: `Who should I not pick against ${b.name}?`,
      answer: avoid.length
        ? `${avoid
            .slice(0, 3)
            .map((a) => a.name)
            .join(', ')} lose to ${b.name} more than expected in Ranked.`
        : `No brawler stands out as losing to ${b.name} yet.`,
    },
  ];

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Brawlers', path: '/brawlers' },
          { name: b.name, path: `/brawlers/${b.slug}` },
          { name: 'Counters', path: `/brawlers/${b.slug}/counters` },
        ])}
      />
      <JsonLd data={faqSchema(faq)} />

      <header className="space-y-3">
        <Link
          href={`/brawlers/${b.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {b.name}
        </Link>
        <div className="flex items-center gap-4">
          <Image
            src={brawlerIconUrl(b.id)}
            alt=""
            width={72}
            height={72}
            className="size-18 shrink-0 rounded-2xl bg-surface-2"
            unoptimized
          />
          <h1 className="display text-3xl leading-tight sm:text-4xl">How to counter {b.name}</h1>
        </div>
        <p className="max-w-2xl leading-relaxed text-muted">
          {top.length ? (
            <>
              In Ranked right now, <strong className="text-foreground">{top.join(', ')}</strong> beat{' '}
              {b.name} most often.{' '}
            </>
          ) : null}
          From real Ranked battles over the last {WINDOW_DAYS} days, every rank, updated every two hours. Each
          number is a win rate against {b.name}, and how far it beats what the two brawlers&apos; usual rates
          would predict.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="display text-xl">Best counters</h2>
        <CounterList rows={counters.slice(0, 8)} good against={b.name} />
      </section>

      <section className="space-y-3">
        <h2 className="display text-xl">Don&apos;t pick into {b.name}</h2>
        <CounterList rows={avoid.slice(0, 5)} good={false} against={b.name} />
      </section>

      <section className="space-y-3">
        <h2 className="display text-xl">Counters at your rank</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ranks.map(({ bracket, counters: list }) => (
            <div key={bracket.slug} className="card space-y-2 p-3">
              <div className="flex items-center gap-2 font-bold">
                <Image src={bracketIconUrl(bracket)} alt="" width={24} height={24} className="size-6" unoptimized />
                {bracket.label}
              </div>
              {list.length ? (
                <ul className="space-y-1.5">
                  {list.map((c) => (
                    <li key={c.brawlerId} className="flex items-center gap-2 text-sm">
                      <Image
                        src={brawlerIconUrl(c.brawlerId)}
                        alt=""
                        width={28}
                        height={28}
                        className="size-7 rounded-md bg-surface-2"
                        unoptimized
                      />
                      <Link href={`/brawlers/${c.slug}`} className="flex-1 font-semibold hover:underline">
                        {c.name}
                      </Link>
                      <span className="tabular-nums text-victory">{formatPercent(c.winRate)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Not enough games at this rank yet.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-4 text-sm leading-relaxed text-muted">
        <p>
          Drafting right now? The{' '}
          <Link href="/draft" className="font-semibold text-brand hover:underline">
            draft helper
          </Link>{' '}
          adds up counters, team-mates and the map for your whole draft, and the free{' '}
          <Link href="/bubble" className="font-semibold text-brand hover:underline">
            Bubble app
          </Link>{' '}
          shows it over the game, by your rank.
        </p>
      </section>
    </div>
  );
}
