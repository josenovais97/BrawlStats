import { ArrowUpRight, TrendingDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { SectionHeading } from '@/components/ui/section-heading';
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

  // The brawlers this player actually invests in, scored. A main sitting in C
  // or D is the single most useful thing this join can surface.
  const mains = [...brawlers]
    .sort((a, b) => b.trophies - a.trophies)
    .slice(0, MAIN_COUNT);
  const coldMains = mains
    .map((b) => ({ brawler: b, entry: meta.get(b.id) }))
    .filter(
      (row): row is { brawler: BSPlayerBrawler; entry: ScoredBrawler } =>
        row.entry?.tier === 'C' || row.entry?.tier === 'D',
    )
    .sort((a, b) => (a.entry.metaScore ?? 0) - (b.entry.metaScore ?? 0))
    .slice(0, LIMIT);

  const iconFor = (id: number) => brawlerMeta.get(id)?.imageUrl ?? brawlerIconUrl(id);

  return (
    <section>
      <SectionHeading
        title="Roster vs the meta"
        aside={`${ownedTop.length}/${top.length} top-tier unlocked`}
      />

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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Strong, not finished"
          icon={ArrowUpRight}
          tone="text-victory"
          empty="Every top-tier brawler you own is at power 11."
          hint="Top-tier brawlers you own below power 11. The cheapest upgrades on this account."
        >
          {underlevelled.map((entry) => {
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
          })}
        </Card>

        <Card
          title="Mains out of favour"
          icon={TrendingDown}
          tone="text-defeat"
          empty="None of your most-played brawlers are struggling right now."
          hint={`Your ${MAIN_COUNT} highest-trophy brawlers that currently sit in C or D.`}
        >
          {coldMains.map(({ brawler, entry }) => (
            <Row
              key={brawler.id}
              id={brawler.id}
              name={brawler.name}
              icon={iconFor(brawler.id)}
              tier={entry.tier}
              score={entry.metaScore}
              detail={`${formatNumber(brawler.trophies)} trophies · power ${brawler.power}`}
            />
          ))}
        </Card>
      </div>
    </section>
  );
}

function Card({
  title,
  icon: Icon,
  tone,
  hint,
  empty,
  children,
}: {
  title: string;
  icon: typeof ArrowUpRight;
  tone: string;
  hint: string;
  empty: string;
  children: React.ReactNode[];
}) {
  const items = children.filter(Boolean);

  return (
    <div className="card flex flex-col p-5">
      <h3 className={`flex items-center gap-2 text-sm font-bold ${tone}`}>
        <Icon className="size-4" />
        {title}
      </h3>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">{hint}</p>

      {items.length === 0 ? (
        <p className="flex flex-1 items-center py-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-1">{items}</ul>
      )}
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
