import type { Metadata } from 'next';
import {
  ArrowDownRight,
  ArrowUpRight,
  Cog,
  Minus,
  Sparkles,
  Star,
  Wrench,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { getBrawlerMap } from '@/lib/brawlapi';
import { formatNumber, formatPercent } from '@/lib/format';
import { hasDatabase } from '@/lib/prisma';
import { getCatalogChanges, getMetaMovers } from '@/lib/stats';
import type { CatalogChangeEntry, MetaMover } from '@/types/stats';

export const metadata: Metadata = {
  title: 'Updates',
  description:
    'Detected Brawl Stars roster and kit changes, plus which brawlers are trending up or down in the sampled meta.',
};

export const revalidate = 3600;

/** How many movers to show on each side. */
const MOVER_LIMIT = 8;

export default async function UpdatesPage() {
  // Artwork (HTTP) overlaps with the database work, but the database reads run
  // one after another so the page never needs more than one connection.
  const [movers, brawlerMeta] = await Promise.all([
    getMetaMovers(7),
    getBrawlerMap().catch(() => new Map()),
  ]);
  const changes = await getCatalogChanges(40);

  const rising = movers.filter((m) => m.winRateDelta > 0).slice(0, MOVER_LIMIT);
  const falling = movers
    .filter((m) => m.winRateDelta < 0)
    .slice(0, MOVER_LIMIT)
    .reverse();

  const iconFor = (id: number) => brawlerMeta.get(id)?.imageUrl;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Updates</h1>
        <p className="mt-2 max-w-3xl text-muted">
          New brawlers and abilities, and which brawlers are rising or falling.
        </p>
      </header>

      <section>
        <h2 className="mb-1 text-2xl font-bold tracking-tight">Meta movers</h2>
        <p className="mb-4 text-sm text-muted">Win rate change over the last 7 days.</p>

        {movers.length === 0 ? (
          <EmptyNote
            configured={hasDatabase()}
            what="Not enough data collected yet — check back tomorrow."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <MoverList
              title="Trending up"
              tone="text-victory"
              movers={rising}
              iconFor={iconFor}
              emptyLabel="Nothing gained ground this week."
            />
            <MoverList
              title="Trending down"
              tone="text-defeat"
              movers={falling}
              iconFor={iconFor}
              emptyLabel="Nothing lost ground this week."
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-2xl font-bold tracking-tight">Detected game changes</h2>
        <p className="mb-4 text-sm text-muted">
          New brawlers, star powers, gadgets and hypercharges.
        </p>

        {changes.length === 0 ? (
          <EmptyNote
            configured={hasDatabase()}
            what="No changes detected yet."
          />
        ) : (
          <ol className="space-y-2">
            {changes.map((change) => (
              <li key={change.id}>
                <ChangeRow change={change} imageUrl={iconFor(change.brawlerId)} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function MoverList({
  title,
  tone,
  movers,
  iconFor,
  emptyLabel,
}: {
  title: string;
  tone: string;
  movers: MetaMover[];
  iconFor: (id: number) => string | undefined;
  emptyLabel: string;
}) {
  return (
    <div className="card p-4">
      <h3 className={`mb-3 flex items-center gap-2 font-bold ${tone}`}>
        {tone.includes('victory') ? (
          <ArrowUpRight className="size-4" />
        ) : (
          <ArrowDownRight className="size-4" />
        )}
        {title}
      </h3>

      {movers.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {movers.map((mover) => {
            const url = iconFor(mover.brawlerId);
            const up = mover.winRateDelta > 0;
            return (
              <li key={mover.brawlerId}>
                <Link
                  href={`/brawlers/${mover.brawlerId}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-2"
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
                    <span className="block truncate text-sm font-semibold capitalize">
                      {mover.brawlerName.toLowerCase()}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {formatPercent(mover.winRateBefore)} → {formatPercent(mover.winRateNow)}{' '}
                      · {formatNumber(mover.sampleSize)} battles
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-bold tabular-nums ${
                      up ? 'text-victory' : 'text-defeat'
                    }`}
                  >
                    {up ? '+' : ''}
                    {(mover.winRateDelta * 100).toFixed(1)} pts
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

const CHANGE_META: Record<
  string,
  { icon: typeof Star; label: string; tone: string; verb: string }
> = {
  brawlerAdded: {
    icon: Star,
    label: 'New brawler',
    tone: 'text-brand',
    verb: 'released',
  },
  starPowerAdded: {
    icon: Sparkles,
    label: 'Star power',
    tone: 'text-brand',
    verb: 'added to',
  },
  gadgetAdded: { icon: Wrench, label: 'Gadget', tone: 'text-accent', verb: 'added to' },
  hyperchargeAdded: {
    icon: Zap,
    label: 'Hypercharge',
    tone: 'text-defeat',
    verb: 'added to',
  },
  gearAdded: { icon: Cog, label: 'Gear', tone: 'text-muted', verb: 'added to' },
  abilityRemoved: { icon: Minus, label: 'Removed', tone: 'text-muted', verb: 'removed from' },
  brawlerRemoved: {
    icon: Minus,
    label: 'Brawler removed',
    tone: 'text-muted',
    verb: 'removed',
  },
};

function ChangeRow({
  change,
  imageUrl,
}: {
  change: CatalogChangeEntry;
  imageUrl?: string;
}) {
  const meta = CHANGE_META[change.kind] ?? {
    icon: Star,
    label: 'Change',
    tone: 'text-muted',
    verb: 'changed on',
  };
  const Icon = meta.icon;

  return (
    <Link
      href={`/brawlers/${change.brawlerId}`}
      className="card flex items-center gap-3 p-3 transition-colors hover:border-brand/40"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0"
          unoptimized
        />
      ) : (
        <span className="size-10 shrink-0 rounded-lg bg-surface-2" />
      )}

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold ${meta.tone}`}
          >
            <Icon className="size-3" />
            {meta.label}
          </span>
          <span className="truncate text-sm font-medium capitalize">
            {change.itemName
              ? `${change.itemName.toLowerCase()} ${meta.verb} ${change.brawlerName.toLowerCase()}`
              : `${change.brawlerName.toLowerCase()} ${meta.verb}`}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted">Detected {change.detectedOn}</p>
      </div>
    </Link>
  );
}

function EmptyNote({ configured, what }: { configured: boolean; what: string }) {
  return (
    <p className="card p-6 text-sm text-muted">
{configured ? what : 'Not available right now.'}
    </p>
  );
}
