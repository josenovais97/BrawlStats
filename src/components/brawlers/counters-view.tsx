import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LanguageLinks } from '@/components/i18n/language-links';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { titleCase } from '@/lib/format';
import { fmtDecimal, fmtNumber, fmtPercent, languageAlternates, localePath, monthYear, rankLabel, type Locale } from '@/lib/i18n';
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
 * Shared by `/brawlers/[slug]/counters` and its Spanish and Portuguese copies
 * under `/[lang]` (see `lib/i18n`), which differ only in their words.
 */

const WINDOW_DAYS = 21;
/** Ranked games against the brawler before a counter is listed, every rank. */
const MIN_GAMES = 150;
/** The same at one rank, where each list is a quarter of the data. */
const MIN_GAMES_AT_RANK = 60;
const MIN_EDGE = 0.01;

interface Words {
  title: (name: string, month: string) => string;
  ogTitle: (name: string) => string;
  description: (name: string, top: string) => string;
  descriptionNone: (name: string) => string;
  fallbackTitle: string;
  heading: (name: string) => string;
  intro: (name: string, top: string) => string;
  method: (name: string, days: number) => string;
  best: string;
  avoid: (name: string) => string;
  atRank: string;
  games: (n: string, name: string) => string;
  expected: string;
  none: (name: string) => string;
  noneAtRank: string;
  faqWhat: (name: string) => string;
  faqWhatA: (name: string, top: string, days: number) => string;
  faqWhatNone: (name: string) => string;
  faqAvoid: (name: string) => string;
  faqAvoidA: (name: string, list: string) => string;
  faqAvoidNone: (name: string) => string;
  crumbs: string;
  counters: string;
  draft: [string, string, string, string, string];
  join: (names: string[]) => string;
}

const list = (and: string) => (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1)}`;

const WORDS: Record<Locale, Words> = {
  en: {
    title: (n, m) => `How to counter ${n} in Brawl Stars (${m})`,
    ogTitle: (n) => `How to counter ${n}`,
    description: (n, top) =>
      `The best counters to ${n} in Ranked are ${top}. Win rates against ${n} from real Ranked battles, by rank, updated every two hours.`,
    descriptionNone: (n) => `Who beats ${n} in Brawl Stars Ranked, from real battles, by rank.`,
    fallbackTitle: 'Counters',
    heading: (n) => `How to counter ${n}`,
    intro: (n, top) => `In Ranked right now, ${top} beat ${n} most often. `,
    method: (n, d) =>
      `From real Ranked battles over the last ${d} days, every rank, updated every two hours. Each number is a win rate against ${n}, and how far it beats what the two brawlers' usual rates would predict.`,
    best: 'Best counters',
    avoid: (n) => `Don't pick into ${n}`,
    atRank: 'Counters at your rank',
    games: (g, n) => `${g} Ranked games against ${n}`,
    expected: 'vs expected',
    none: (n) => `Not enough Ranked battles against ${n} yet.`,
    noneAtRank: 'Not enough games at this rank yet.',
    faqWhat: (n) => `What counters ${n} in Brawl Stars?`,
    faqWhatA: (n, top, d) =>
      `In Ranked, ${top} win most often against ${n}, beyond what their usual win rates would predict, over the last ${d} days.`,
    faqWhatNone: (n) => `There are not enough Ranked battles against ${n} yet to name its counters.`,
    faqAvoid: (n) => `Who should I not pick against ${n}?`,
    faqAvoidA: (n, l) => `${l} lose to ${n} more than expected in Ranked.`,
    faqAvoidNone: (n) => `No brawler stands out as losing to ${n} yet.`,
    crumbs: 'Brawlers',
    counters: 'Counters',
    draft: [
      'Drafting right now? The',
      'draft helper',
      'adds up counters, team-mates and the map for your whole draft, and the free',
      'Bubble app',
      'shows it over the game, by your rank.',
    ],
    join: (names) => names.join(', '),
  },
  es: {
    title: (n, m) => `Cómo counterear a ${n} en Brawl Stars (${m})`,
    ogTitle: (n) => `Cómo counterear a ${n}`,
    description: (n, top) =>
      `Los mejores counters de ${n} en Competitivo son ${top}. Tasas de victoria contra ${n} de partidas reales de Competitivo, por rango, actualizadas cada dos horas.`,
    descriptionNone: (n) => `Quién le gana a ${n} en Competitivo de Brawl Stars, con partidas reales, por rango.`,
    fallbackTitle: 'Counters',
    heading: (n) => `Cómo counterear a ${n}`,
    intro: (n, top) => `En Competitivo ahora mismo, ${top} son los que más le ganan a ${n}. `,
    method: (n, d) =>
      `Con partidas reales de Competitivo de los últimos ${d} días, de todos los rangos, actualizado cada dos horas. Cada número es una tasa de victorias contra ${n}, y cuánto supera lo que se esperaría por el nivel normal de los dos brawlers.`,
    best: 'Mejores counters',
    avoid: (n) => `No los elijas contra ${n}`,
    atRank: 'Counters en tu rango',
    // "de Competitivo" is in the intro; on a phone it wrapped every row.
    games: (g, n) => `${g} partidas contra ${n}`,
    expected: 'vs lo esperado',
    none: (n) => `Todavía no hay suficientes partidas de Competitivo contra ${n}.`,
    noneAtRank: 'Todavía no hay suficientes partidas en este rango.',
    faqWhat: (n) => `¿Qué brawlers counterean a ${n} en Brawl Stars?`,
    faqWhatA: (n, top, d) =>
      `En Competitivo, ${top} son los que más le ganan a ${n}, más de lo que dirían sus tasas de victoria normales, en los últimos ${d} días.`,
    faqWhatNone: (n) => `Todavía no hay suficientes partidas de Competitivo contra ${n} para saber sus counters.`,
    faqAvoid: (n) => `¿A quién no debo elegir contra ${n}?`,
    faqAvoidA: (n, l) => `${l} pierden contra ${n} más de lo esperado en Competitivo.`,
    faqAvoidNone: (n) => `Ningún brawler destaca todavía por perder contra ${n}.`,
    crumbs: 'Brawlers',
    counters: 'Counters',
    draft: [
      '¿Estás en la selección? El',
      'asistente de draft',
      '(en inglés) suma counters, compañeros y el mapa para todo tu draft, y la app gratis',
      'Bubble',
      'te lo muestra encima del juego, según tu rango y en español.',
    ],
    join: list('y'),
  },
  pt: {
    title: (n, m) => `Como counterar ${n} no Brawl Stars (${m})`,
    ogTitle: (n) => `Como counterar ${n}`,
    description: (n, top) =>
      `Os melhores counters de ${n} no Ranqueado são ${top}. Taxas de vitória contra ${n} em partidas ranqueadas reais, por rank, atualizadas a cada duas horas.`,
    descriptionNone: (n) => `Quem ganha de ${n} no Ranqueado do Brawl Stars, com partidas reais, por rank.`,
    fallbackTitle: 'Counters',
    heading: (n) => `Como counterar ${n}`,
    intro: (n, top) => `No Ranqueado agora, ${top} são os que mais ganham de ${n}. `,
    method: (n, d) =>
      `Com partidas ranqueadas reais dos últimos ${d} dias, de todos os ranks, atualizado a cada duas horas. Cada número é uma taxa de vitória contra ${n}, e quanto ela passa do que se esperaria pelo nível normal dos dois brawlers.`,
    best: 'Melhores counters',
    avoid: (n) => `Não escolha contra ${n}`,
    atRank: 'Counters no seu rank',
    games: (g, n) => `${g} partidas contra ${n}`,
    expected: 'vs o esperado',
    none: (n) => `Ainda não há partidas ranqueadas suficientes contra ${n}.`,
    noneAtRank: 'Ainda não há partidas suficientes neste rank.',
    faqWhat: (n) => `Quais brawlers são counter de ${n} no Brawl Stars?`,
    faqWhatA: (n, top, d) =>
      `No Ranqueado, ${top} são os que mais ganham de ${n}, além do que as taxas de vitória normais deles indicariam, nos últimos ${d} dias.`,
    faqWhatNone: (n) => `Ainda não há partidas ranqueadas suficientes contra ${n} para saber os counters dele.`,
    faqAvoid: (n) => `Quem eu não devo escolher contra ${n}?`,
    faqAvoidA: (n, l) => `${l} perdem para ${n} mais do que o esperado no Ranqueado.`,
    faqAvoidNone: (n) => `Nenhum brawler se destaca ainda por perder para ${n}.`,
    crumbs: 'Brawlers',
    counters: 'Counters',
    draft: [
      'Escolhendo agora? O',
      'assistente de draft',
      '(em inglês) soma counters, aliados e o mapa para o seu draft inteiro, e o app grátis',
      'Bubble',
      'mostra isso por cima do jogo, pelo seu rank e em português.',
    ],
    join: list('e'),
  },
};

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

export async function countersMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const w = WORDS[locale];
  const b = await resolve(slug);
  if (!b) return { title: w.fallbackTitle };
  const scores = await getRankedCounterScores([b.id], WINDOW_DAYS).catch(() => new Map());
  const { counters, avoid } = split(scores, b.id, MIN_GAMES, b.named);
  const top = counters.slice(0, 3).map((c) => c.name);
  const description = top.length ? w.description(b.name, w.join(top)) : w.descriptionNone(b.name);
  const path = `/brawlers/${b.slug}/counters`;
  return {
    title: w.title(b.name, locale === 'en' ? currentMonth() : monthYear(locale)),
    description,
    alternates: { canonical: localePath(locale, path), languages: languageAlternates(path) },
    openGraph: { title: w.ogTitle(b.name), description },
    // Nothing to list yet (a brawler just released: Vince on 2026-10-30) is a
    // page of "not enough battles", which is no answer to index.
    ...(counters.length === 0 && avoid.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

function CounterList({ rows, good, against, locale }: { rows: Row[]; good: boolean; against: string; locale: Locale }) {
  const w = WORDS[locale];
  if (rows.length === 0) {
    return <p className="card px-4 py-6 text-sm text-muted">{w.none(against)}</p>;
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
              <span className="block text-xs tabular-nums text-muted">{w.games(fmtNumber(r.games, locale), against)}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className={`block font-black tabular-nums ${good ? 'text-victory' : 'text-defeat'}`}>
                {fmtPercent(r.winRate, locale)}
              </span>
              <span className="block text-xs tabular-nums text-muted">
                {r.edge >= 0 ? '+' : '−'}
                {fmtDecimal(Math.abs(r.edge * 100), locale)} {w.expected}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export async function CountersView({ slug, locale }: { slug: string; locale: Locale }) {
  const w = WORDS[locale];
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
  const path = `/brawlers/${b.slug}/counters`;
  const faq = [
    {
      question: w.faqWhat(b.name),
      answer: top.length ? w.faqWhatA(b.name, w.join(top), WINDOW_DAYS) : w.faqWhatNone(b.name),
    },
    {
      question: w.faqAvoid(b.name),
      answer: avoid.length
        ? w.faqAvoidA(
            b.name,
            w.join(avoid.slice(0, 3).map((a) => a.name)),
          )
        : w.faqAvoidNone(b.name),
    },
  ];

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: w.crumbs, path: '/brawlers' },
          { name: b.name, path: `/brawlers/${b.slug}` },
          { name: w.counters, path: localePath(locale, path) },
        ])}
      />
      <JsonLd data={faqSchema(faq)} />

      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/brawlers/${b.slug}`}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {b.name}
          </Link>
          <LanguageLinks locale={locale} path={path} />
        </div>
        <div className="flex items-center gap-4">
          <Image
            src={brawlerIconUrl(b.id)}
            alt=""
            width={72}
            height={72}
            className="size-18 shrink-0 rounded-2xl bg-surface-2"
            unoptimized
          />
          <h1 className="display text-3xl leading-tight sm:text-4xl">{w.heading(b.name)}</h1>
        </div>
        <p className="max-w-2xl leading-relaxed text-muted">
          {top.length ? <strong className="text-foreground">{w.intro(b.name, w.join(top))}</strong> : null}
          {w.method(b.name, WINDOW_DAYS)}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="display text-xl">{w.best}</h2>
        <CounterList rows={counters.slice(0, 8)} good against={b.name} locale={locale} />
      </section>

      <section className="space-y-3">
        <h2 className="display text-xl">{w.avoid(b.name)}</h2>
        <CounterList rows={avoid.slice(0, 5)} good={false} against={b.name} locale={locale} />
      </section>

      <section className="space-y-3">
        <h2 className="display text-xl">{w.atRank}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ranks.map(({ bracket, counters: rows }) => (
            <div key={bracket.slug} className="card space-y-2 p-3">
              <div className="flex items-center gap-2 font-bold">
                <Image src={bracketIconUrl(bracket)} alt="" width={24} height={24} className="size-6" unoptimized />
                {rankLabel(bracket, locale)}
              </div>
              {rows.length ? (
                <ul className="space-y-1.5">
                  {rows.map((c) => (
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
                      <span className="tabular-nums text-victory">{fmtPercent(c.winRate, locale)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{w.noneAtRank}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-4 text-sm leading-relaxed text-muted">
        <p>
          {w.draft[0]}{' '}
          <Link href="/draft" className="font-semibold text-brand hover:underline">
            {w.draft[1]}
          </Link>{' '}
          {w.draft[2]}{' '}
          <Link href="/bubble" className="font-semibold text-brand hover:underline">
            {w.draft[3]}
          </Link>{' '}
          {w.draft[4]}
        </p>
      </section>
    </div>
  );
}
