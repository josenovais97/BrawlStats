import type { Metadata } from 'next';
import Link from 'next/link';

import { JsonLd, breadcrumbSchema } from '@/components/seo/structured-data';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { getStarrDrops, type DropTable, type DropType } from '@/lib/starr-drops';

export const metadata: Metadata = {
  title: 'Brawl Stars Starr Drop odds. Every drop rate and what is inside',
  description:
    'Exact Starr Drop chances: how often each rarity rolls, and every reward inside Rare, Super Rare, Epic, Mythic and Legendary drops. Plus Chaos Drops and every event drop.',
  alternates: { canonical: '/starr-drops' },
};

/** The wiki updates on balance changes; twice a day is plenty. */
export const revalidate = 43_200;

/**
 * What is actually inside a Starr Drop.
 *
 * The game never shows you the table. It shows an animation, and the odds
 * behind it are not published through any API — so the question "what are the
 * chances of a Legendary" has no first-party answer at all, which is exactly
 * why people search for it.
 *
 * Two numbers, kept apart because they are different questions: how often a
 * drop rolls each rarity, and what is inside once it has. Multiplying them is
 * left to the reader rather than presented as a third set of odds, because the
 * product is only meaningful for a specific reward and stating it per row would
 * imply a precision the source does not have.
 */
export default async function StarrDropsPage() {
  const data = await getStarrDrops();

  if (!data) {
    return (
      <ErrorState
        code="upstreamDown"
        title="Drop rates unavailable"
        detail="The community wiki these numbers come from is not responding, or has changed shape. Rather than show odds that might be wrong, the page waits."
      />
    );
  }

  const core = data.types.filter((type) => type.group === 'core');
  const event = data.types.filter((type) => type.group === 'event');

  return (
    <div className="space-y-10">
      <JsonLd
        data={breadcrumbSchema([{ name: 'Starr Drops', path: '/starr-drops' }])}
      />

      <PageHeading
        eyebrow="Every drop rate"
        title="Starr Drops"
        subtitle="What each drop can contain and how likely each reward is. The game shows you the opening, never the table behind it — and Supercell publishes no drop rates through any API, so these come from the community wiki."
      />

      {/* The permanent drops first. Event drops are the long tail: interesting,
          but most of them have not been obtainable for a year. */}
      <div className="space-y-8">
        {core.map((type) => (
          <DropSection key={type.slug} type={type} />
        ))}
      </div>

      {event.length > 0 ? (
        <div className="space-y-8">
          <SectionHeading
            title="Event drops"
            subtitle="Limited-time drops from past events. Kept for reference — most are no longer obtainable."
            count={event.length}
          />
          {event.map((type) => (
            <DropSection key={type.slug} type={type} />
          ))}
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-muted">
        Drop rates and contents from the{' '}
        <a
          href={data.sourceUrl}
          rel="noreferrer noopener"
          target="_blank"
          className="font-medium text-brand hover:underline"
        >
          Brawl Stars Wiki
        </a>
        , CC-BY-SA. Supercell publishes no drop-rate API, so these are
        community-maintained from datamines and in-game observation rather than
        official figures. For what the meta looks like once you have the
        brawlers, see the{' '}
        <Link href="/tier-list/ranked" className="font-medium text-brand hover:underline">
          Ranked tier list
        </Link>
        .
      </p>
    </div>
  );
}

function DropSection({ type }: { type: DropType }) {
  return (
    <section aria-labelledby={type.slug} className="reveal space-y-4">
      <div className="flex items-start gap-3">
        <span className="rule mt-1" aria-hidden />
        <div className="min-w-0">
          <h2 id={type.slug} className="display text-2xl uppercase">
            {type.name}
          </h2>
          {type.description ? (
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">
              {type.description}
            </p>
          ) : null}
        </div>
      </div>

      {/* How often the drop rolls each rarity. A bar rather than a table: the
          whole point is that Legendary is a sliver, and 2% in a cell does not
          land the way 2% of a width does. */}
      {type.rarityOdds.length > 0 ? <RarityBar type={type} /> : null}

      {/* `items-start` so a five-row table does not stretch to match a
          seven-row one beside it and end in dead space. */}
      {type.tables.length > 0 ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {type.tables.map((table, index) => (
            <RewardTable key={table.rarity ?? index} table={table} />
          ))}
        </div>
      ) : (
        <p className="card p-4 text-sm text-muted">
          The wiki publishes no reward table for this drop.
        </p>
      )}
    </section>
  );
}

/**
 * Rarity colours.
 *
 * Deliberately the game's own progression rather than the site's tier palette:
 * a reader who plays already knows what colour Legendary is, and borrowing the
 * S-to-D colours here would imply these are rankings rather than rarities.
 */
const RARITY_COLOR: Record<string, string> = {
  Rare: '#5fd45f',
  'Super Rare': '#3ea8ff',
  Epic: '#c05bff',
  Mythic: '#ff4d6d',
  Legendary: '#ffc53d',
  Ultra: '#ff8a3d',
  Angelic: '#ffe9a8',
  Demonic: '#ff5c72',
};

function rarityColor(rarity: string | null): string {
  return (rarity && RARITY_COLOR[rarity]) || 'var(--accent)';
}

function RarityBar({ type }: { type: DropType }) {
  return (
    <div className="card overflow-hidden p-4">
      <p className="eyebrow mb-3">Chance of rolling each rarity</p>

      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={type.rarityOdds
          .map((odd) => `${odd.rarity} ${(odd.chance * 100).toFixed(0)}%`)
          .join(', ')}
      >
        {type.rarityOdds.map((odd) => (
          <span
            key={odd.rarity}
            style={{
              width: `${odd.chance * 100}%`,
              background: rarityColor(odd.rarity),
            }}
          />
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {type.rarityOdds.map((odd) => (
          <li key={odd.rarity} className="flex items-center gap-1.5 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: rarityColor(odd.rarity) }}
            />
            <span className="text-muted">{odd.rarity}</span>
            <span className="font-bold tabular-nums">
              {(odd.chance * 100).toFixed(odd.chance * 100 < 1 ? 2 : 0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RewardTable({ table }: { table: DropTable }) {
  const color = rarityColor(table.rarity);
  // A point of slack for the wiki's rounded percentages.
  const short = table.listed < 0.99;
  const most = Math.max(...table.rewards.map((reward) => reward.chance ?? 0), 0);

  return (
    <div className="card overflow-hidden">
      {table.rarity ? (
        <p
          className="border-b border-border px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
          style={{ color, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
        >
          {table.rarity}
        </p>
      ) : null}

      <ul className="divide-y divide-border">
        {table.rewards.map((reward) => (
          <li key={reward.reward} className="relative flex items-center gap-3 px-4 py-2.5">
            {/* The chance as a width behind the row, so a column of numbers
                also reads as a shape. Scaled to the biggest row rather than to
                100%, or every row in a long table would be a sliver. */}
            {reward.chance !== null && most > 0 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0"
                style={{
                  width: `${(reward.chance / most) * 100}%`,
                  background: `color-mix(in srgb, ${color} 8%, transparent)`,
                }}
              />
            ) : null}

            <span className="relative min-w-0 flex-1 truncate text-sm">
              {reward.reward}
            </span>
            <span className="relative shrink-0 text-sm font-bold tabular-nums">
              {reward.chance === null ? '–' : `${(reward.chance * 100).toFixed(2)}%`}
            </span>
          </li>
        ))}
      </ul>

      {/*
        Said plainly when the source is short. The rows above are correct as far
        as they go; the table is simply missing one, and a reader comparing
        percentages has no other way to notice.
      */}
      {short ? (
        <p className="border-t border-border bg-surface-2/40 px-4 py-2.5 text-xs leading-relaxed text-muted">
          These add up to {(table.listed * 100).toFixed(1)}%, not 100% — the wiki is
          missing a row here, so something else drops the remaining{' '}
          {((1 - table.listed) * 100).toFixed(1)}% of the time.
        </p>
      ) : null}
    </div>
  );
}
