import { ArrowUpRight, TrendingDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Panel } from '@/components/ui/panel';
import { brawlerPath } from '@/lib/slugs';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber } from '@/lib/format';
import { MAX_POWER_LEVEL } from '@/lib/progression';
import { TIER_COLOR, type ScoredBrawler } from '@/lib/stats';
import type { BABrawler } from '@/types/brawlapi';
import type { BSPlayerBrawler } from '@/types/brawlstars';

/**
 * The player's roster read against the current tier list.
 *
 * The site already knows which brawlers are strong and which ones this player
 * owns, and until now never put the two together — the roster grid below is a
 * wall of tiles that knows nothing about the meta, and the tier list knows
 * nothing about who is reading it.
 *
 * Scored against the **trophy** list rather than the Ranked one, for two
 * reasons: it rates the whole roster (Ranked has competitive data for barely
 * half of it, so most tiles would come back "unrated"), and it is the list
 * that speaks to the trophy counts this page is otherwise full of.
 */

/** How many brawlers to show per card. */
const LIMIT = 6;

/** Top-of-roster cut-off for "brawlers you main". */
const MAIN_COUNT = 12;

export function PlayerMetaFit({
  brawlers,
  meta,
  brawlerMeta,
}: {
  brawlers: BSPlayerBrawler[];
  /** Current tier list, keyed by brawler id. */
  meta: Map<number, ScoredBrawler>;
  brawlerMeta: Map<number, BABrawler>;
}) {
  if (meta.size === 0) return null;

  const owned = new Map(brawlers.map((b) => [b.id, b]));
  const rated = [...meta.values()].filter((e) => e.tier !== null);
  const top = rated
    .filter((e) => e.tier === 'S' || e.tier === 'A')
    .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0));
  if (top.length === 0) return null;

  const ownedTop = top.filter((e) => owned.has(e.brawlerId));

  // Strong *and* not finished: the actionable half of "you own it".
  const underlevelled = ownedTop
    .filter((e) => (owned.get(e.brawlerId)?.power ?? 0) < MAX_POWER_LEVEL)
    .slice(0, LIMIT);

  // The brawlers this player actually invests in, scored. A main sitting in
  // the bottom half is the single most useful thing this join can surface.
  const mains = [...brawlers]
    .sort((a, b) => b.trophies - a.trophies)
    .slice(0, MAIN_COUNT);
  const coldMains = mains
    .map((b) => ({ brawler: b, entry: meta.get(b.id) }))
    .filter(
      (row): row is { brawler: BSPlayerBrawler; entry: ScoredBrawler } =>
        row.entry?.tier === 'C' ||
        row.entry?.tier === 'D' ||
        row.entry?.tier === 'E' ||
        row.entry?.tier === 'F',
    )
    .sort((a, b) => (a.entry.metaScore ?? 0) - (b.entry.metaScore ?? 0))
    .slice(0, LIMIT);

  const iconFor = (id: number) => brawlerMeta.get(id)?.imageUrl ?? brawlerIconUrl(id);

  const cards = [
    {
      key: 'underlevelled',
      title: 'Strong, not finished',
      icon: ArrowUpRight,
      tone: 'text-victory',
      hint: 'Top-tier brawlers you own below power 11. The cheapest upgrades on this account.',
      empty: 'Every top-tier brawler you own is at power 11.',
      rows: underlevelled.map((entry) => {
        const brawler = owned.get(entry.brawlerId)!;
        return (
          <Row
            key={entry.brawlerId}
            id={entry.brawlerId}
            name={entry.brawlerName}
            icon={iconFor(entry.brawlerId)}
            tier={entry.tier}
            score={entry.metaScore}
            detail={`Power ${brawler.power} · ${formatNumber(brawler.trophies)} trophies`}
          />
        );
      }),
    },
    {
      key: 'cold-mains',
      title: 'Mains out of favour',
      icon: TrendingDown,
      tone: 'text-defeat',
      hint: `Your ${MAIN_COUNT} highest-trophy brawlers that currently sit in C or D.`,
      empty: 'None of your most-played brawlers are struggling right now.',
      rows: coldMains.map(({ brawler, entry }) => (
        <Row
          key={brawler.id}
          id={brawler.id}
          name={brawler.name}
          icon={iconFor(brawler.id)}
          tier={entry.tier}
          score={entry.metaScore}
          detail={`${formatNumber(brawler.trophies)} trophies · power ${brawler.power}`}
        />
      )),
    },
  ];
  const filled = cards.filter((card) => card.rows.length > 0);
  const emptyCards = cards.filter((card) => card.rows.length === 0);

  return (
    <Panel
      title="Roster vs the meta"
      aside={`${ownedTop.length}/${top.length} top-tier unlocked`}
    >
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-muted">
        This roster scored against the current{' '}
        <Link href="/tier-list/trophy" className="font-medium text-brand hover:underline">
          trophy tier list
        </Link>
        , which rates every brawler from sampled ladder battles. For competitive
        play see the{' '}
        <Link href="/tier-list/ranked" className="font-medium text-brand hover:underline">
          Ranked list
        </Link>
        , which covers the 3v3 modes only.
      </p>

      {/*
        Only the cards with something in them get a column.

        This was a three-column grid holding two cards, so the right third of
        the panel was always empty -- and on a maxed account "Strong, not
        finished" was half the panel spent on one sentence at the bottom of
        its box. An empty card is still a reading ("every top-tier brawler you
        own is at power 11" is good news), so it is kept, as a line under the
        cards rather than a box of its own.
      */}
      {filled.length > 0 ? (
        <div className={`grid gap-4 ${filled.length === 2 ? '@3xl:grid-cols-2' : ''}`}>
          {filled.map(({ key, title, icon, tone, hint, rows }) => (
            <Card key={key} title={title} icon={icon} tone={tone} hint={hint}>
              {rows}
            </Card>
          ))}
        </div>
      ) : null}
      {emptyCards.length > 0 ? (
        <ul className={`space-y-1.5 text-sm text-muted ${filled.length > 0 ? 'mt-4' : ''}`}>
          {emptyCards.map(({ key, icon: Icon, tone, title, empty }) => (
            <li key={key} className="flex items-start gap-2">
              <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
              <span>
                <span className="font-semibold text-foreground">{title}:</span> {empty}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

function Card({
  title,
  icon: Icon,
  tone,
  hint,
  children,
}: {
  title: string;
  icon: typeof ArrowUpRight;
  tone: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col p-5">
      <h3 className={`flex items-center gap-2 text-sm font-bold ${tone}`}>
        <Icon className="size-4" />
        {title}
      </h3>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">{hint}</p>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function Row({
  id,
  name,
  icon,
  tier,
  score,
  detail,
  muted = false,
}: {
  id: number;
  name: string;
  icon: string;
  tier: ScoredBrawler['tier'];
  score: number | null;
  detail: string;
  muted?: boolean;
}) {
  return (
    <li>
      <Link
        href={brawlerPath(id, name)}
        className="row-interactive flex items-center gap-3 rounded-lg p-2"
      >
        <Image
          src={icon}
          alt=""
          width={32}
          height={32}
          className={`size-8 shrink-0 ${muted ? 'opacity-50 grayscale' : ''}`}
          unoptimized
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold capitalize">
            {name.toLowerCase()}
          </span>
          <span className="block truncate text-xs text-muted">{detail}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className="text-sm font-black tabular-nums"
            style={{ color: tier ? TIER_COLOR[tier] : undefined }}
          >
            {score?.toFixed(1) ?? '–'}
          </span>
          {tier ? (
            <span
              className="grid size-5 place-items-center rounded text-xs font-black"
              style={{
                color: TIER_COLOR[tier],
                background: `color-mix(in srgb, ${TIER_COLOR[tier]} 20%, transparent)`,
              }}
            >
              {tier}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}
