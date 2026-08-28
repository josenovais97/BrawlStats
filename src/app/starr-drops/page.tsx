import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { JsonLd, breadcrumbSchema } from "@/components/seo/structured-data";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeading, SectionHeading } from "@/components/ui/section-heading";
import {
  getStarrDrops,
  type DropReward,
  type DropTable,
  type DropType,
} from "@/lib/starr-drops";

export const metadata: Metadata = {
  title: "Brawl Stars Starr Drop odds. Every drop rate and what is inside",
  description:
    "Exact Starr Drop chances: how often each rarity rolls, and every reward inside Rare, Super Rare, Epic, Mythic and Legendary drops. Plus Chaos Drops and every event drop.",
  alternates: { canonical: "/starr-drops" },
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

  const core = data.types.filter((type) => type.group === "core");
  const event = data.types.filter((type) => type.group === "event");

  return (
    <div className="space-y-10">
      <JsonLd
        data={breadcrumbSchema([{ name: "Starr Drops", path: "/starr-drops" }])}
      />

      <PageHeading
        eyebrow="Every drop rate"
        title="Starr Drops"
        subtitle="What each drop can contain and how likely each reward is. The game shows you the opening, never the table behind it — and Supercell publishes no drop rates through any API, so these come from the community wiki."
      />

      {/*
        Every drop is folded shut, and the whole page is the list of them.
        
        Expanded, thirteen drop types ran to seventeen thousand pixels — so
        finding the Legendary Chaos Drop table meant scrolling past nine event
        drops that have not been obtainable in a year. Closed, the page is a
        contents page: you see every drop at once and open the one you came
        for. The first is open because a page that answers nothing until you
        click is its own kind of unhelpful.
      */}
      <section aria-labelledby="permanent" className="space-y-3">
        <SectionHeading
          title="Permanent drops"
          subtitle="Obtainable right now, from Daily Wins, Trophy Road, the Brawl Pass and the Shop."
        />
        {core.map((type, index) => (
          <DropSection key={type.slug} type={type} defaultOpen={index === 0} />
        ))}
      </section>

      {event.length > 0 ? (
        <section aria-labelledby="event" className="space-y-3">
          <SectionHeading
            title="Event drops"
            subtitle="Limited-time drops from past events. Kept for reference — most are no longer obtainable."
            count={event.length}
          />
          {event.map((type) => (
            <DropSection key={type.slug} type={type} />
          ))}
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-muted">
        Drop rates and contents from the{" "}
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
        brawlers, see the{" "}
        <Link
          href="/tier-list/ranked"
          className="font-medium text-brand hover:underline"
        >
          Ranked tier list
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * One drop type: its artwork, what it is, and the tables behind it.
 *
 * The artwork is the point. A drop is a physical object in the game — people
 * recognise a Chaos Drop by its shape long before they read the word — and the
 * first version of this page was a wall of percentages that could have been
 * about anything. Leading each section with the real image is what makes it
 * scannable.
 */
function DropSection({
  type,
  defaultOpen = false,
}: {
  type: DropType;
  defaultOpen?: boolean;
}) {
  const rewardCount = type.tables.reduce(
    (sum, table) => sum + table.rewards.length,
    0,
  );

  return (
    <details open={defaultOpen} className="group card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 transition-colors hover:bg-surface-2/40 sm:gap-4 sm:p-4 [&::-webkit-details-marker]:hidden">
        {type.imageUrl ? (
          <Image
            src={type.imageUrl}
            alt=""
            width={80}
            height={80}
            className="size-11 shrink-0 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] sm:size-14"
            unoptimized
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <h3 className="display text-base uppercase sm:text-lg">
            {type.name}
          </h3>
          {/*
            One line closed, the whole thing open. The description is the only
            place that says where a drop comes from, so it is worth a glance in
            the summary without letting it set the row height.
          */}
          <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-muted group-open:line-clamp-none sm:text-sm">
            {type.description}
          </p>
        </div>

        {/* What is behind the fold, so the row is worth reading closed. */}
        <span className="hidden shrink-0 text-right text-xs text-muted sm:block">
          {rewardCount > 0 ? (
            <>
              <span className="font-bold tabular-nums text-foreground">
                {rewardCount}
              </span>{" "}
              rewards
              {type.rarityOdds.length > 0 ? (
                <span className="block">{type.rarityOdds.length} rarities</span>
              ) : null}
            </>
          ) : (
            "No table"
          )}
        </span>

        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted duration-200 group-open:rotate-180 motion-safe:transition-transform"
        />
      </summary>

      <div className="space-y-4 border-t border-border p-3 sm:p-4">
        {type.rarityOdds.length > 0 ? <RarityBar type={type} /> : null}

        {/*
          Auto-fit rather than a fixed column count.
          
          Five rarity tables in a two-column grid is 2 + 2 + 1, and that last
          one sits alone against half a row of nothing — which was most of what
          made this page look unfinished. `auto-fit` puts down as many columns
          as the width allows and stretches them to fill it, so a drop with
          five tables gets five columns and one with three gets three. There is
          never a hole, because there is never a leftover.
        */}
        {type.tables.length > 0 ? (
          <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(11.5rem,1fr))]">
            {type.tables.map((table, index) => (
              <RewardTable key={table.rarity ?? index} table={table} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            The wiki publishes no reward table for this drop.
          </p>
        )}
      </div>
    </details>
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
  Rare: "#5fd45f",
  "Super Rare": "#3ea8ff",
  Epic: "#c05bff",
  Mythic: "#ff4d6d",
  Legendary: "#ffc53d",
  Ultra: "#ff8a3d",
  "Ultra Legendary": "#ff8a3d",
  Angelic: "#ffe9a8",
  Demonic: "#ff5c72",
};

function rarityColor(rarity: string | null): string {
  return (rarity && RARITY_COLOR[rarity]) || "var(--accent)";
}

function RarityBar({ type }: { type: DropType }) {
  return (
    <div>
      <p className="eyebrow mb-2.5">Chance of rolling each rarity</p>

      <div
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={type.rarityOdds
          .map((odd) => `${odd.rarity} ${(odd.chance * 100).toFixed(0)}%`)
          .join(", ")}
      >
        {type.rarityOdds.map((odd) => (
          <span
            key={odd.rarity}
            className="first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${odd.chance * 100}%`,
              background: rarityColor(odd.rarity),
            }}
          />
        ))}
      </div>

      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {type.rarityOdds.map((odd) => (
          <li key={odd.rarity} className="flex items-baseline gap-1.5 text-sm">
            <span
              aria-hidden
              className="size-2 shrink-0 translate-y-[-1px] rounded-full"
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
  const most = Math.max(
    ...table.rewards.map((reward) => reward.chance ?? 0),
    0,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-2/20">
      {table.rarity ? (
        <p
          className="border-b border-border px-3.5 py-2 text-xs font-bold uppercase tracking-wide"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
          }}
        >
          {table.rarity}
        </p>
      ) : null}

      <ul className="divide-y divide-border/60">
        {table.rewards.map((reward) => (
          <RewardRow
            key={reward.reward}
            reward={reward}
            color={color}
            most={most}
          />
        ))}
      </ul>

      {/*
        Said plainly when the source is short. The rows above are correct as far
        as they go; the table is simply missing one, and a reader comparing
        percentages has no other way to notice.
      */}
      {short ? (
        <p
          className="border-t border-border bg-surface-2/60 px-2.5 py-2 text-xs leading-snug text-muted"
          title={`The wiki lists rewards totalling ${(table.listed * 100).toFixed(1)}%, so a row covering the other ${((1 - table.listed) * 100).toFixed(1)}% is missing from the source.`}
        >
          Wiki lists {(table.listed * 100).toFixed(1)}% — a row is missing.
        </p>
      ) : null}
    </div>
  );
}

function RewardRow({
  reward,
  color,
  most,
}: {
  reward: DropReward;
  color: string;
  /** The biggest chance in this table, which the bars are scaled against. */
  most: number;
}) {
  return (
    <li className="flex items-start gap-2 px-2.5 py-2">
      {reward.iconUrl ? (
        <Image
          src={reward.iconUrl}
          alt=""
          width={32}
          height={32}
          className="size-7 shrink-0 object-contain"
          loading="lazy"
          unoptimized
        />
      ) : (
        /* Keeps the column aligned when a one-off event reward has no mark. */
        <span aria-hidden className="size-7 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        {/*
          The reward gets a line to itself, and wraps rather than truncating.
          
          Fitting five rarity columns across meant a column is about 190px, and
          putting the name and the percentage on one line clipped sixty-odd
          reward names to things like "200 Power Poi…". A drop table whose
          rewards cannot be read is not a drop table, so the name takes the
          width and the number moves down beside its own bar.
        */}
        <p className="text-sm leading-tight">
          {reward.amount ? (
            <span className="font-bold tabular-nums">{reward.amount} </span>
          ) : null}
          <span className={reward.amount ? "text-muted" : ""}>
            {reward.label}
          </span>
        </p>

        <div className="mt-1.5 flex items-center gap-2">
          {/*
            A real track, rather than a tint behind the row.
            
            Drawn as a background fill the likeliest reward filled its row edge
            to edge — which reads as no bar at all — and every other row looked
            like a panel with a piece missing. A track makes the empty part of
            the bar as explicit as the full part.
            
            Scaled to the biggest row rather than to 100%: at true scale a 1.3%
            reward is too short to see, and the comparison worth making here is
            between the rows of one table.
          */}
          <span
            aria-hidden
            className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3/70"
          >
            {reward.chance !== null && most > 0 ? (
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max((reward.chance / most) * 100, 2)}%`,
                  background: color,
                }}
              />
            ) : null}
          </span>

          <span className="shrink-0 text-xs font-bold tabular-nums">
            {reward.chance === null
              ? "–"
              : `${(reward.chance * 100).toFixed(2)}%`}
          </span>
        </div>
      </div>
    </li>
  );
}
