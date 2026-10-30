import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/stats';
import { fmtDecimal, fmtNumber, fmtPercent, type Locale } from '@/lib/i18n';
import type { BABrawler } from '@/types/brawlapi';
import type { MetaMover } from '@/types/stats';

/**
 * Which brawlers gained or lost ground since the last comparable snapshot.
 *
 * Rendered on the Ranked list only. The stored `brawler_stats` snapshots this
 * reads take their win rate from competitive battles alone, so there is no
 * trophy-ladder equivalent to show — putting this under the ladder list would
 * caption Ranked movement as ladder movement.
 *
 * It does *not* follow the window or mode controls above it, and says so.
 * Those recompute rates live from `battle_samples` over a trailing window;
 * this compares two stored daily snapshots, which are written at a fixed
 * 7-day window with no mode dimension at all. Silently ignoring the filters
 * would be the worse failure, so the caption states the span it actually used.
 *
 * For the same reason the deltas are self-contained: both sides come from the
 * snapshot table and are scored identically, so the *change* is exact, but the
 * absolute scores are not the ones the tiers above are drawn on and the
 * caption does not claim they are.
 */
const WORDS = {
  en: {
    title: 'Meta movers',
    change: 'Change in',
    score: 'meta score',
    scale:
      '. The same 0–10 scale the tiers above use, measured on the stored daily snapshots, so a mover is a brawler visibly climbing or sliding the Ranked meta.',
    over: (days: number, from: string, to: string) =>
      `Measured over the last ${days} ${days === 1 ? 'day' : 'days'}, comparing the ${from} and ${to} snapshots.`,
    between: 'Measured between the two most recent snapshots.',
    floor:
      'Both sides clear the same sample floor as the tier list, and snapshots computed under different methodologies are never compared.',
    allModes: 'Across all modes',
    allModesRest: '. The daily snapshots this compares are not split by mode, so the filter above does not apply here.',
    up: 'Trending up',
    down: 'Trending down',
    noUp: 'Nothing gained ground over this span.',
    noDown: 'Nothing lost ground over this span.',
    unit: 'Meta score /10',
    win: 'win',
    pick: 'pick',
    decided: 'decided battles',
  },
  es: {
    title: 'Los que se mueven en el meta',
    change: 'Cambio en la',
    score: 'puntuación meta',
    scale:
      ', la misma escala de 0 a 10 que usan los tiers de arriba, medida sobre las mediciones diarias guardadas: quien aparece aquí está subiendo o bajando de verdad en el meta de Competitivo.',
    over: (days: number, from: string, to: string) =>
      `Medido en ${days === 1 ? 'el último día' : `los últimos ${days} días`}, comparando las mediciones del ${from} y del ${to}.`,
    between: 'Medido entre las dos mediciones más recientes.',
    floor:
      'Los dos lados superan el mismo mínimo de partidas que la tier list, y nunca se comparan mediciones hechas con métodos distintos.',
    allModes: 'Todos los modos',
    allModesRest: ': las mediciones diarias no están separadas por modo, así que el filtro de arriba no se aplica aquí.',
    up: 'Subiendo',
    down: 'Bajando',
    noUp: 'Nadie subió en este periodo.',
    noDown: 'Nadie bajó en este periodo.',
    unit: 'Puntuación /10',
    win: 'victorias',
    pick: 'uso',
    decided: 'partidas decididas',
  },
  pt: {
    title: 'Quem está se movendo no meta',
    change: 'Mudança na',
    score: 'pontuação meta',
    scale:
      ', a mesma escala de 0 a 10 dos tiers acima, medida nas medições diárias guardadas: quem aparece aqui está subindo ou caindo de verdade no meta do Ranqueado.',
    over: (days: number, from: string, to: string) =>
      `Medido ${days === 1 ? 'no último dia' : `nos últimos ${days} dias`}, comparando as medições de ${from} e ${to}.`,
    between: 'Medido entre as duas medições mais recentes.',
    floor:
      'Os dois lados passam do mesmo mínimo de partidas da tier list, e medições feitas com métodos diferentes nunca são comparadas.',
    allModes: 'Todos os modos',
    allModesRest: ': as medições diárias não são separadas por modo, então o filtro acima não vale aqui.',
    up: 'Subindo',
    down: 'Caindo',
    noUp: 'Ninguém subiu neste período.',
    noDown: 'Ninguém caiu neste período.',
    unit: 'Pontuação /10',
    win: 'vitórias',
    pick: 'escolha',
    decided: 'partidas decididas',
  },
} satisfies Record<Locale, unknown>;

type Words = (typeof WORDS)[Locale];

export function MetaMovers({
  movers,
  brawlerMeta,
  limit,
  modeFiltered,
  locale = 'en',
}: {
  movers: MetaMover[];
  brawlerMeta: Map<number, BABrawler>;
  limit: number;
  /** True when a mode filter is active on the page around this section. */
  modeFiltered: boolean;
  locale?: Locale;
}) {
  const w: Words = WORDS[locale];
  const rising = movers.filter((m) => m.metaScoreDelta > 0).slice(0, limit);
  const falling = movers
    .filter((m) => m.metaScoreDelta < 0)
    .slice(0, limit)
    .reverse();

  const iconFor = (id: number) => brawlerMeta.get(id)?.imageUrl;

  // The span is read off the data rather than assumed: `getMetaMovers` falls
  // back to the oldest snapshot it has when the full lookback is not available,
  // so a hardcoded "last 7 days" would be wrong on a young dataset.
  const span = movers[0];
  const days = span
    ? Math.max(
        1,
        Math.round(
          (Date.parse(span.toDate) - Date.parse(span.fromDate)) / 86_400_000,
        ),
      )
    : 0;

  return (
    <section aria-labelledby="meta-movers">
      <h2 id="meta-movers" className="display text-game-stroke text-2xl">
        {w.title}
      </h2>
      <p className="mb-4 mt-1 max-w-3xl text-sm leading-relaxed text-muted">
        {w.change} <strong className="font-semibold text-foreground">{w.score}</strong>
        {w.scale} {span ? w.over(days, span.fromDate, span.toDate) : w.between} {w.floor}
        {modeFiltered ? (
          <>
            {' '}
            <strong className="font-semibold text-foreground">{w.allModes}</strong>
            {w.allModesRest}
          </>
        ) : null}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <MoverList title={w.up} tone="text-victory" movers={rising} iconFor={iconFor} emptyLabel={w.noUp} w={w} locale={locale} />
        <MoverList
          title={w.down}
          tone="text-defeat"
          movers={falling}
          iconFor={iconFor}
          emptyLabel={w.noDown}
          w={w}
          locale={locale}
        />
      </div>
    </section>
  );
}

function MoverList({
  title,
  tone,
  movers,
  iconFor,
  emptyLabel,
  w,
  locale,
}: {
  title: string;
  tone: string;
  movers: MetaMover[];
  iconFor: (id: number) => string | undefined;
  emptyLabel: string;
  w: Words;
  locale: Locale;
}) {
  return (
    <div className="card p-4">
      {/* The unit lives in the header rather than on every row: "+1.3" next to
          a percentage reads as percentage points unless something says
          otherwise, and this column is meta score. */}
      <h3 className={`mb-3 flex items-center gap-2 font-bold ${tone}`}>
        {tone.includes('victory') ? (
          <ArrowUpRight className="size-4" />
        ) : (
          <ArrowDownRight className="size-4" />
        )}
        {title}
        <span className="label-game ml-auto text-xs text-muted">
          {w.unit}
        </span>
      </h3>

      {movers.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {movers.map((mover) => {
            const url = iconFor(mover.brawlerId);
            const up = mover.metaScoreDelta > 0;
            const changedTier = mover.tierNow !== mover.tierBefore;
            return (
              <li key={mover.brawlerId}>
                <Link
                  href={brawlerPath(mover.brawlerId, mover.brawlerName)}
                  className="row-interactive flex items-center gap-3 rounded-lg p-2"
                >
                  {url ? (
                    <Image
                      src={url}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 shrink-0"
                      unoptimized
                    />
                  ) : (
                    <span className="size-8 shrink-0 rounded bg-surface-2" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold capitalize">
                        {mover.brawlerName.toLowerCase()}
                      </span>
                      {/* A move that crossed a tier boundary is the most
                          concrete thing that can be said about it. */}
                      {changedTier ? (
                        <span className="shrink-0 text-xs font-bold tabular-nums">
                          <span style={{ color: TIER_COLOR[mover.tierBefore] }}>
                            {mover.tierBefore}
                          </span>
                          <span className="text-muted">→</span>
                          <span style={{ color: TIER_COLOR[mover.tierNow] }}>
                            {mover.tierNow}
                          </span>
                        </span>
                      ) : null}
                    </span>
                    {/* The two inputs to the score, so the move is explained
                        rather than asserted. */}
                    <span className="block truncate text-xs text-muted">
                      {fmtPercent(mover.winRateBefore, locale)} →{' '}
                      {fmtPercent(mover.winRateNow, locale)} {w.win} ·{' '}
                      {fmtPercent(mover.usageBefore, locale)} →{' '}
                      {fmtPercent(mover.usageNow, locale)} {w.pick}
                    </span>
                    <span className="block truncate text-xs tabular-nums text-muted">
                      {fmtNumber(mover.sampleSize, locale)} {w.decided}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className={`block text-sm font-bold tabular-nums ${
                        up ? 'text-victory' : 'text-defeat'
                      }`}
                    >
                      {up ? '+' : '−'}
                      {fmtDecimal(Math.abs(mover.metaScoreDelta), locale)}
                    </span>
                    {/* Not smaller than this: at 10px the decimal point in
                        "8.4 → 7.3" disappears and it reads as "84 → 73". */}
                    <span className="block text-xs tabular-nums text-muted">
                      {fmtDecimal(mover.metaScoreBefore, locale)} →{' '}
                      {fmtDecimal(mover.metaScoreNow, locale)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
