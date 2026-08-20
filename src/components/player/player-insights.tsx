import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import {
  BattlesIcon,
  BrawlersIcon,
  CrownIcon,
  PlayersIcon,
} from '@/components/game-icons';
import { SectionHeading } from '@/components/ui/section-heading';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { getBattleLog } from '@/lib/bs-api';
import { computeBattleInsights, type PlayerAssociation } from '@/lib/battle-insights';
import { formatNumber, formatPercent, humanizeMode, relativeTime } from '@/lib/format';
import type { BABrawler } from '@/types/brawlapi';

interface Props {
  tag: string;
  playerTag: string;
  brawlerMeta: Map<number, BABrawler>;
}

/**
 * Recent-form panel built from the battle log.
 *
 * The log only covers ~25 battles, so this is deliberately framed as "recent"
 * everywhere rather than presented as career data.
 */
export async function PlayerInsights({ tag, playerTag, brawlerMeta }: Props) {
  let entries;
  try {
    entries = (await getBattleLog(tag)).items;
  } catch {
    return null;
  }
  if (entries.length === 0) return null;

  const insights = computeBattleInsights(entries, playerTag);
  const topBrawlers = insights.brawlers.slice(0, 6);
  const perDay = insights.battles / insights.daysCovered;

  return (
    <section>
      <SectionHeading
        title="Recent form"
        aside={`Last ${insights.battles} battles${
          insights.lastBattleAt ? ` · ${relativeTime(insights.lastBattleAt)}` : ''
        }`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Headline numbers */}
        <div className="card card-glow p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted">Win rate</span>
            <span className="text-3xl font-black tabular-nums text-brand">
              {formatPercent(insights.winRate)}
            </span>
          </div>

          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="bg-victory"
              style={{ width: `${(insights.wins / Math.max(insights.battles, 1)) * 100}%` }}
            />
            <div
              className="bg-defeat"
              style={{ width: `${(insights.losses / Math.max(insights.battles, 1)) * 100}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-victory">{insights.wins}W</span>
            <span className="text-defeat">{insights.losses}L</span>
            {insights.draws > 0 ? (
              <span className="text-muted">{insights.draws}D</span>
            ) : null}
            {insights.averageRank !== null ? (
              <span className="text-muted">
                Avg place {insights.averageRank.toFixed(1)}
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Trophies</p>
              <p
                className={`flex items-center gap-1 text-lg font-bold tabular-nums ${
                  insights.trophyChange >= 0 ? 'text-victory' : 'text-defeat'
                }`}
              >
                {insights.trophyChange >= 0 ? (
                  <TrendingUp className="size-4" />
                ) : (
                  <TrendingDown className="size-4" />
                )}
                {insights.trophyChange > 0 ? '+' : ''}
                {formatNumber(insights.trophyChange)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Star player</p>
              <p className="flex items-center gap-1 text-lg font-bold tabular-nums">
                <CrownIcon className="size-4" />
                {insights.starPlayerCount}
              </p>
            </div>
          </div>
        </div>

        {/* Most played brawlers */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
            <BrawlersIcon className="size-4" />
            Most played
          </h3>

          <ul className="grid gap-3 sm:grid-cols-2">
            {topBrawlers.map((brawler) => {
              const meta = brawlerMeta.get(brawler.brawlerId);
              return (
                <li key={brawler.brawlerId}>
                  <Link
                    href={`/brawlers/${brawler.brawlerId}`}
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2"
                  >
                    <Image
                      src={meta?.imageUrl ?? brawlerIconUrl(brawler.brawlerId)}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 shrink-0"
                      unoptimized
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold capitalize">
                        {brawler.brawlerName.toLowerCase()}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {brawler.battles} {brawler.battles === 1 ? 'battle' : 'battles'}
                        {brawler.winRate !== null
                          ? ` · ${formatPercent(brawler.winRate)} win`
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold tabular-nums ${
                        brawler.trophyChange >= 0 ? 'text-victory' : 'text-defeat'
                      }`}
                    >
                      {brawler.trophyChange > 0 ? '+' : ''}
                      {brawler.trophyChange}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <AssociationList
          title="Played with"
          icon={PlayersIcon}
          people={insights.teammates.slice(0, 5)}
          emptyLabel="No repeat teammates in this window."
        />
        <AssociationList
          title="Faced most"
          icon={BattlesIcon}
          people={insights.opponents.slice(0, 5)}
          emptyLabel="No repeat opponents in this window."
        />

        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
            <Activity className="size-4 text-accent" />
            Activity
          </h3>
          <dl className="space-y-3 text-sm">
            <Row label="Last 24 hours" value={`${insights.battlesLast24h} battles`} />
            <Row label="Battles per day" value={perDay.toFixed(1)} />
            <Row
              label="Last seen"
              value={insights.lastBattleAt ? relativeTime(insights.lastBattleAt) : ', '}
            />
            {insights.modes[0] ? (
              <Row label="Top mode" value={humanizeMode(insights.modes[0].mode)} />
            ) : null}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function AssociationList({
  title,
  icon: Icon,
  people,
  emptyLabel,
}: {
  title: string;
  icon: (props: { className?: string }) => React.ReactNode;
  people: PlayerAssociation[];
  emptyLabel: string;
}) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4 text-accent" />
        {title}
      </h3>

      {people.length === 0 ? (
        <p className="py-2 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {people.map((person) => (
            <li key={person.tag}>
              <Link
                href={`/player/${person.tag}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {person.name}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {person.battles}×
                  {person.winRate !== null ? ` · ${formatPercent(person.winRate)}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
