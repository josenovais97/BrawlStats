import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { DropOpener } from '@/components/starr/drop-opener';
import { OpenOnHash } from '@/components/starr/open-on-hash';
import { CHAOS_TINT, dropRewardName, pct, RARITY_TINT, rarityColor } from '@/components/starr/rarity';
import { ErrorState } from '@/components/ui/error-state';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  atLeastOnce,
  atOrAbove,
  getStarrDrops,
  nextSpecialDay,
  perNormalDay,
  type DailyCell,
  type DailySchedule,
  type DropReward,
  type DropTable,
  type DropType,
} from '@/lib/starr-drops';
import type { OpenerDrop } from '@/lib/drop-roll';
import { formatDate, formatDayMonth } from '@/lib/format';
import { SITE_URL } from '@/lib/site';
import { andList, getT, type T } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

export const metadata: Metadata = {
  // "Chances", not "odds": the word in the queries Search Console shows
  // ("legendary starr drop chances", "star drop chances"). "Schedule" since
  // 2026-10-22, when "brawl stars starr drop schedule" was this page's most
  // seen query (position 9.8) and the title did not say the page answers it.
  // "Drop rates" since 2026-10-28: "legendary starr drop rates" is the other
  // query this page shows for, and the title said only "chances".
  title: 'Brawl Stars Starr Drops: daily schedule, drop rates and rewards',
  description:
    "This season's Starr Drop schedule, your chance of a Legendary today, this week and this month, and every reward inside each drop and box. Updated twice a day.",
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
/**
 * Limited-time ways to earn drops, shown only while their event runs.
 *
 * The drop tables below come from the wiki and update themselves. These do not
 * have a table anywhere -- they are described once, in the patch notes -- so
 * each is written here by hand with an end date, and the page drops it the day
 * the event is over rather than leaving a stale offer up. The page revalidates
 * twice a day, so a card disappears within twelve hours of `endsAt`.
 */
const EVENT_EXTRAS: { event: string; name: string; endsAt: string; points: string[] }[] = [
  {
    event: 'Brawl-O-Ween',
    name: "Loony's Loot",
    // A month-long October event; the card retires at the start of November.
    endsAt: '2026-11-02T00:00:00Z',
    points: [
      'Every daily win adds a reward to Loony, up to 6 wins a day.',
      'Rewards are Starr Drops or Chaos Drops, with up to 2 Starr Drops a day.',
      'Claim by pressing and holding Loony once all 6 daily wins are done.',
      'Forgot to claim? The rewards are granted automatically the next day.',
      'Progress resets every day, like Daily Wins.',
    ],
  },
];

/** The extras whose event is still running, as of this render. */
function liveEventExtras() {
  const now = Date.now();
  return EVENT_EXTRAS.filter((e) => now < Date.parse(e.endsAt));
}

export default async function StarrDropsPage() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const data = await getStarrDrops();

  if (!data) {
    return (
      <ErrorState
        code="upstreamDown"
        title={t('Drop rates unavailable')}
        detail={t('The community wiki these numbers come from is not responding, or has changed shape. Rather than show odds that might be wrong, the page waits.')}
      />
    );
  }

  const core = data.types.filter((type) => type.group === 'core');
  const event = data.types.filter((type) => type.group === 'event');
  const boxes = data.types.filter((type) => type.group === 'box');

  /*
   * Everything above the drop list is computed from the same wiki read as the
   * tables, so none of it is written down anywhere to go stale: a new season's
   * schedule, a change to the odds or a new special day reaches the hero, the
   * odds and the answers on the next revalidation.
   */
  const starr = core.find((type) => type.slug === 'starr-drops') ?? core.find((type) => type.rarityOdds.length > 0) ?? null;
  const chaos = core.find((type) => type.slug === 'chaos-drops') ?? null;
  const legendary = starr ? atOrAbove(starr.rarityOdds, 'Legendary') : null;
  const chaosLegendary = chaos ? atOrAbove(chaos.rarityOdds, 'Legendary') : null;
  const perDayRaw = perNormalDay(data.daily, 'Starr Drop');
  const perDay = perDayRaw && perDayRaw > 0 ? perDayRaw : null;
  const next = nextSpecialDay(data.daily, new Date());
  const openers = [starr, chaos].filter((type): type is DropType => type !== null && type.rarityOdds.length > 0).map((type) => toOpener(type, t));
  const faq = buildFaq(t, { starr, chaos, legendary, chaosLegendary, perDay, daily: data.daily });

  return (
    <div className="space-y-10">
      <JsonLd data={breadcrumbSchema([{ name: 'Starr Drops', path: '/starr-drops' }])} />
      {faq.length > 0 ? <JsonLd data={faqSchema(faq)} /> : null}
      <OpenOnHash />

      <StarrHero
        art={starr?.imageUrl ?? '/icons/starr-drop.png'}
        odds={starr?.rarityOdds ?? []}
        wins={data.daily?.wins ?? null}
        perDay={perDay}
        chaosLegendary={chaosLegendary}
        next={next}
      />

      <nav aria-label={t('On this page')} className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
        {[
          ...(openers.length > 0 ? [{ href: '#open', label: t('Open a drop') }] : []),
          { href: '#schedule', label: t('Daily schedule') },
          ...(legendary ? [{ href: '#odds', label: t('Your Legendary odds') }] : []),
          ...(starr ? [{ href: `#${starr.slug}`, label: starr.name }] : []),
          ...(chaos ? [{ href: `#${chaos.slug}`, label: chaos.name }] : []),
          ...(boxes.length > 0 ? [{ href: '#boxes', label: t('Boxes') }] : []),
          ...(faq.length > 0 ? [{ href: '#faq', label: t('Quick answers') }] : []),
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="shrink-0 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold transition-colors hover:border-brand hover:text-brand"
          >
            {t(link.label)}
          </a>
        ))}
      </nav>

      {/*
        How you actually get them, before what is inside them.

        Search Console had this page answering "starr drop schedule" at
        position 9 -- people asking *when* and *how many*, landing on a page
        that only said *what*. The Daily Wins table is read from the wiki
        (2026-10-22): the hand-written "first 5 wins" of 2026-10-09 was out of
        date within two weeks. Event extras come from the patch notes and carry
        an end date, so each one takes itself off the page when its event is over.
      */}
      <section id="schedule" className="scroll-mt-24 space-y-3">
        <SectionHeading title={t('How to get them: the daily schedule')} />
        {data.daily ? <DailyWins daily={data.daily} types={data.types} /> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {liveEventExtras().map((e) => (
            <div key={e.name} className="card border-accent/40 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-accent">{t('{event} · limited time', { event: e.event })}</p>
              <h3 className="display mt-1 text-xl">{e.name}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-muted">
                {e.points.map((point) => (
                  <li key={point}>{t(point)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {legendary ? <LegendaryOdds legendary={legendary} perDay={perDay} chaosLegendary={chaosLegendary} /> : null}

      {/*
        The odds above, felt rather than read (2026-10-29): the game's tap-to-
        upgrade ritual, rolled from the same tables the page prints.
      */}
      {openers.length > 0 ? (
        <section id="open" className="scroll-mt-24 space-y-3">
          <SectionHeading title={t('Open a Starr Drop')} subtitle={t('Tap it like in the game and see what the real odds give you.')} />
          <DropOpener drops={openers} shareUrl={`${SITE_URL}${lp('/starr-drops')}#open`} />
        </section>
      ) : null}

      {/*
        Every drop is folded shut, and the whole page is the list of them.
        
        Expanded, thirteen drop types ran to seventeen thousand pixels — so
        finding the Legendary Chaos Drop table meant scrolling past nine event
        drops that have not been obtainable in a year. Closed, the page is a
        contents page: you see every drop at once and open the one you came
        for. The first is open because a page that answers nothing until you
        click is its own kind of unhelpful.
      */}
      <section id="permanent" className="scroll-mt-24 space-y-3">
        <SectionHeading
          title={t('Permanent drops')}
          subtitle={t('Obtainable right now, from Daily Wins, Trophy Road, the Brawl Pass and the Shop.')}
        />
        {core.map((type, index) => (
          <DropSection key={type.slug} type={type} defaultOpen={index === 0} />
        ))}
      </section>

      {boxes.length > 0 ? (
        <section id="boxes" className="scroll-mt-24 space-y-3">
          <SectionHeading
            title={t('Boxes')}
            subtitle={t("Event and new-brawler boxes: the ones in this season's Daily Wins first, then newest first.")}
            count={boxes.length}
          />
          {boxes.map((type) => (
            <DropSection key={type.slug} type={type} />
          ))}
        </section>
      ) : null}

      {event.length > 0 ? (
        <section id="event" className="scroll-mt-24 space-y-3">
          <SectionHeading
            title={t('Event drops')}
            subtitle={t('Limited-time drops from past events. Kept for reference — most are no longer obtainable.')}
            count={event.length}
          />
          {event.map((type) => (
            <DropSection key={type.slug} type={type} />
          ))}
        </section>
      ) : null}

      {faq.length > 0 ? (
        <section id="faq" className="scroll-mt-24 space-y-3">
          <SectionHeading title={t('Quick answers')} />
          <dl className="card divide-y divide-border overflow-hidden">
            {faq.map((item) => (
              <div key={item.question} className="p-4 sm:p-5">
                <dt className="font-bold">{item.question}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-muted">{t('Drop rates and contents from the')}{' '}
        <a
          href={lp(data.sourceUrl)}
          rel="noreferrer noopener"
          target="_blank"
          className="font-medium text-brand hover:underline"
        >{t('Brawl Stars Wiki')}</a>{t(', CC-BY-SA. Supercell publishes no drop-rate API, so these are community-maintained from datamines and in-game observation rather than official figures. For what the meta looks like once you have the brawlers, see the')}{' '}
        <Link href={lp('/tier-list/ranked')} className="font-medium text-brand hover:underline">{t('Ranked tier list')}</Link>
        .
      </p>
    </div>
  );
}

/** Day kinds the wiki uses, so they can be translated; anything new shows as written. */
const DAY_NAMES: Record<string, string> = {
  'Normal Days': 'Normal days',
  'Lucky Days': 'Lucky days',
  'Luckiest Days': 'Luckiest days',
};

/** How many past special days to show. Upcoming ones are always shown. */
const SPECIAL_DAYS_SHOWN = 3;

/**
 * What each daily win gives this season, slot by slot, then the special days.
 *
 * Icons rather than words, like the game's own Daily Wins screen: a reader
 * recognises a Chaos Drop by its shape. The name is in the alt text.
 */
function DailyWins({ daily, types }: { daily: DailySchedule; types: DropType[] }) {
  const t = getT(requestLocale());
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = daily.special.filter((day) => day.endsAt.slice(0, 10) >= today).reverse();
  const past = daily.special.filter((day) => day.endsAt.slice(0, 10) < today).slice(0, SPECIAL_DAYS_SHOWN);
  const range = (day: DailySchedule['special'][number]) =>
    day.startsAt === day.endsAt ? formatDate(day.startsAt) : `${formatDate(day.startsAt)} – ${formatDate(day.endsAt)}`;

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <p className="text-sm leading-relaxed text-muted">
        {daily.wins
          ? t('Each of your first {n} wins of the day gives a reward, and what each one gives changes every season. The count resets once a day; the timer on the Daily Wins screen in game shows exactly when.', { n: daily.wins })
          : t('Your first wins of the day each give a reward, and what each one gives changes every season.')}
      </p>

      {daily.days.map((day) => (
        <div key={day.name}>
          <p className="eyebrow mb-2">
            {t(DAY_NAMES[day.name] ?? day.name)}
            {day.rows.length > 1 ? <span className="ml-2 normal-case tracking-normal text-muted">{t('one of these')}</span> : null}
          </p>
          <div className="space-y-2">
            {day.rows.map((row, i) => (
              <DailyRow key={i} cells={row} />
            ))}
          </div>
        </div>
      ))}

      {daily.footnote ? <p className="text-xs text-muted">* {t(daily.footnote)}</p> : null}

      <ScheduleKey daily={daily} types={types} />

      {upcoming.length + past.length > 0 ? (
        <div className="border-t border-border pt-4">
          <p className="eyebrow mb-2">{upcoming.length > 0 ? t('Special days') : t('Recent special days')}</p>
          <div className="space-y-3">
            {[...upcoming, ...past].map((day) => (
              <div key={day.startsAt} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
                <p className="shrink-0 text-sm sm:w-56">
                  {upcoming.includes(day) ? <span className="mr-1.5 font-bold text-victory">{t('Coming')}</span> : null}
                  {range(day)}
                </p>
                <DailyRow cells={day.cells} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DailyRow({ cells }: { cells: DailyCell[] }) {
  const t = getT(requestLocale());
  return (
    /*
     * A grid of equal squares, one per win, rather than wrapping tiles: at
     * phone width six 56px tiles wrapped five and one, which read as a sixth
     * win that was somehow different from the others.
     */
    <ol
      className="grid w-full max-w-sm gap-1.5"
      style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
    >
      {cells.map((cell, i) => (
        <li
          key={i}
          className="relative flex aspect-square items-center justify-center gap-0.5 rounded-xl border border-border bg-surface-2/40 p-1"
          title={cell.items.map((item) => `${item.amount ? `${item.amount} ` : ''}${t(item.name)}`).join(' + ')}
        >
          <span className="absolute left-1 top-0.5 text-[10px] font-bold tabular-nums text-muted">{i + 1}</span>
          {cell.items.map((item, j) =>
            item.iconUrl ? (
              <span key={j} className="flex min-w-0 flex-col items-center">
                <Image src={item.iconUrl} alt={t(item.name)} width={40} height={40} className="size-8 object-contain sm:size-9" loading="lazy" unoptimized />
                {item.amount ? <span className="-mt-1 text-[10px] font-bold tabular-nums">{item.amount}</span> : null}
              </span>
            ) : (
              <span key={j} className="px-0.5 text-center text-[9px] leading-tight">{item.amount ? `${item.amount} ` : ''}{t(item.name)}</span>
            ),
          )}
          {cell.footnote ? <span className="absolute right-1 top-0.5 text-xs text-muted">*</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** The drop or box a schedule slot names: "Pumpkin Box" is listed as "Pumpkin Boxes". */
function typeFor(name: string, types: DropType[]): DropType | null {
  return types.find((type) => type.name === name || type.name === `${name}s` || type.name === `${name}es`) ?? null;
}

/**
 * What the icons in the schedule are, each linking to its own table.
 *
 * The schedule is icons, like the game's screen -- which only helps someone
 * who already knows a Coffin Box by its shape. The key names them once and
 * turns "what is in that one" into a tap.
 */
function ScheduleKey({ daily, types }: { daily: DailySchedule; types: DropType[] }) {
  const t = getT(requestLocale());
  const items = new Map<string, string | null>();
  for (const cell of daily.days.flatMap((day) => day.rows.flat())) {
    for (const item of cell.items) if (!items.has(item.name)) items.set(item.name, item.iconUrl);
  }
  if (items.size === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">
      {[...items].map(([name, iconUrl]) => {
        const type = typeFor(name, types);
        const body = (
          <>
            {iconUrl ? <Image src={iconUrl} alt="" width={28} height={28} className="size-6 object-contain" loading="lazy" unoptimized /> : null}
            <span>{t(name)}</span>
          </>
        );
        return (
          <li key={name}>
            {type && type.tables.length > 0 ? (
              <a href={`#${type.slug}`} className="flex items-center gap-1.5 text-sm font-medium hover:text-brand">
                {body}
                <span aria-hidden className="text-muted">→</span>
              </a>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted">{body}</span>
            )}
          </li>
        );
      })}
    </ul>
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
function DropSection({ type, defaultOpen = false }: { type: DropType; defaultOpen?: boolean }) {
  const t = getT(requestLocale());
  const rewardCount = type.tables.reduce((sum, table) => sum + table.rewards.length, 0);

  return (
    <details id={type.slug} open={defaultOpen} className="group card scroll-mt-24 overflow-hidden">
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
          <h3 className="display text-base uppercase sm:text-lg">{type.name}</h3>
          {/*
            One line closed, the whole thing open. The description is the only
            place that says where a drop comes from, so it is worth a glance in
            the summary without letting it set the row height.
          */}
          <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-muted group-open:line-clamp-none sm:text-sm">
            {type.group === 'box' ? (
              <>
                {type.inDailyWins ? <span className="font-semibold text-victory">{t("In this season's Daily Wins")}</span> : null}
                {type.inDailyWins && type.addedAt ? ' · ' : null}
                {type.addedAt ? t('Added {date}', { date: formatDate(type.addedAt) }) : null}
              </>
            ) : (
              t(type.description)
            )}
          </p>
        </div>

        {/* What is behind the fold, so the row is worth reading closed. */}
        <span className="hidden shrink-0 text-right text-xs text-muted sm:block">
          {rewardCount > 0 ? (
            <>
              <span className="font-bold tabular-nums text-foreground">{rewardCount}</span>{' '}{t('rewards')}{type.rarityOdds.length > 0 ? (
                <span className="block">{type.rarityOdds.length}{' '}{t('rarities')}</span>
              ) : null}
            </>
          ) : (
            t('No table')
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
          <p className="text-sm text-muted">{t('The wiki publishes no reward table for this drop.')}</p>
        )}
      </div>
    </details>
  );
}

function RarityBar({ type }: { type: DropType }) {
  const t = getT(requestLocale());
  return (
    <div>
      <p className="eyebrow mb-2.5">{t('Chance of rolling each rarity')}</p>

      <div
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={type.rarityOdds
          .map((odd) => `${odd.rarity} ${(odd.chance * 100).toFixed(0)}%`)
          .join(', ')}
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
  const t = getT(requestLocale());
  const color = rarityColor(table.rarity);
  // A point of slack for the wiki's rounded percentages.
  const short = table.listed < 0.99;
  const most = Math.max(...table.rewards.map((reward) => reward.chance ?? 0), 0);

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
          <RewardRow key={reward.reward} reward={reward} color={color} most={most} />
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
          title={t('The wiki lists rewards totalling {v}%, so a row covering the other {v2}% is missing from the source.', { v: (table.listed * 100).toFixed(1), v2: ((1 - table.listed) * 100).toFixed(1) })}
        >{t('Wiki lists {v}% — a row is missing.', { v: (table.listed * 100).toFixed(1) })}</p>
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
  const t = getT(requestLocale());
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
          {reward.amount ? <span className="font-bold tabular-nums">{reward.amount} </span> : null}
          <span className={reward.amount ? 'text-muted' : ''}>{t(reward.label)}</span>
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
          <span aria-hidden className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-3/70">
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
            {reward.chance === null ? '–' : `${(reward.chance * 100).toFixed(2)}%`}
          </span>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------ hero and odds ------------------------------ */

/**
 * The game's own reward screen for the page's subject: the drop floating in
 * turning rays (the /rewards stage), the rarity ladder it can climb, and the
 * four numbers people come for. All of it from this render's wiki read.
 */
function StarrHero({
  art,
  odds,
  wins,
  perDay,
  chaosLegendary,
  next,
}: {
  art: string;
  odds: { rarity: string; chance: number }[];
  wins: number | null;
  perDay: number | null;
  chaosLegendary: number | null;
  next: DailySchedule['special'][number] | null;
}) {
  const t = getT(requestLocale());
  const facts = [
    wins ? { value: String(wins), label: t('wins a day give a reward') } : null,
    perDay ? { value: String(perDay), label: t('Starr Drops on a normal day') } : null,
    chaosLegendary ? { value: pct(chaosLegendary), label: t('of Chaos Drops are Legendary or better') } : null,
    next
      ? { value: formatDayMonth(next.startsAt), label: t('next special day') }
      : { value: '–', label: t('no special day announced yet') },
  ].filter((fact): fact is { value: string; label: string } => fact !== null);

  return (
    <section className="reward-stage px-4 pb-5 pt-5 sm:px-8 sm:pb-8 sm:pt-8" aria-labelledby="starr-title">
      <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto] sm:gap-6">
        <div className="order-2 text-center sm:order-1 sm:text-left">
          <p className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-xs font-semibold text-white/85">
            <span className="live-dot" />
            {t('Updated {date}', { date: formatDate(new Date()) })}
          </p>
          <h1 id="starr-title" className="display text-game-stroke mt-3 text-5xl leading-none text-white sm:text-7xl">
            {t('Starr Drops')}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:mx-0 sm:text-base">
            {t("This season's daily schedule, the chance of every rarity, and every reward inside each drop and box. Read from the Brawl Stars Wiki twice a day, so it changes when the game does.")}
          </p>
        </div>
        <div className="relative isolate order-1 mx-auto sm:order-2">
          <div aria-hidden className="reward-rays" />
          {/* eslint-disable-next-line @next/next/no-img-element -- the wiki's own 200px artwork, like the drop icons below */}
          <img src={art} alt="" width={200} height={200} className="reward-float size-32 object-contain sm:size-52" />
        </div>
      </div>

      {odds.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-center text-xs font-semibold text-white/75 sm:text-left">
            {t('Every Starr Drop starts Rare and can upgrade. The chance it ends as each:')}
          </p>
          <ol className="grid gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${odds.length}, minmax(0, 1fr))` }}>
            {odds.map((odd) => (
              <li key={odd.rarity} className="reward-tile flex flex-col items-center px-0.5 pb-2 pt-2.5 text-center sm:pb-3 sm:pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local 111x128 icon */}
                <img
                  src="/icons/starr-drop.png"
                  alt=""
                  width={56}
                  height={64}
                  className="h-9 w-auto drop-shadow-[0_3px_0_#10142a] sm:h-14"
                  style={{ filter: RARITY_TINT[odd.rarity] }}
                />
                <span
                  className="mt-1.5 text-[9px] font-bold uppercase leading-tight tracking-wide sm:text-xs"
                  style={{ color: rarityColor(odd.rarity) }}
                >
                  {t(odd.rarity)}
                </span>
                <span className="display text-game-stroke mt-0.5 text-lg leading-none text-white sm:text-3xl">{pct(odd.chance)}</span>
                <span className="mt-1 text-[9px] text-white/60 sm:text-xs">{t('1 in {n}', { n: Math.round(1 / odd.chance) })}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-3">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-2xl bg-black/35 px-3 py-2.5 sm:px-4 sm:py-3">
            <dd className="display text-2xl leading-none text-white sm:text-3xl">{fact.value}</dd>
            <dt className="mt-1 text-xs leading-snug text-white/70">{fact.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * "Will I get one this week", answered.
 *
 * Per-drop odds are what the wiki gives and what nobody can feel: 2% sounds
 * like never, and seven days of five drops is closer to a coin flip. The
 * windows are the Daily Wins a player actually gets; with no schedule to
 * count, they fall back to round numbers of drops.
 */
function LegendaryOdds({
  legendary,
  perDay,
  chaosLegendary,
}: {
  legendary: number;
  perDay: number | null;
  chaosLegendary: number | null;
}) {
  const t = getT(requestLocale());
  const windows = perDay
    ? [
        { label: t('Today'), drops: perDay },
        { label: t('This week'), drops: perDay * 7 },
        { label: t('This month'), drops: perDay * 30 },
      ]
    : [10, 50, 100].map((drops) => ({ label: t('{n} drops', { n: drops }), drops }));
  const every = Math.round(1 / legendary);

  return (
    <section id="odds" className="scroll-mt-24 space-y-3">
      <SectionHeading
        title={t('Your chance of a Legendary')}
        subtitle={perDay
          ? t('The chance of at least one Legendary Starr Drop from your Daily Wins, at {n} Starr Drops a day.', { n: perDay })
          : t('The chance of at least one Legendary in that many Starr Drops.')}
      />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {windows.map((window) => {
          const chance = atLeastOnce(legendary, window.drops);
          return (
            <div key={window.label} className="card flex flex-col items-center p-3 text-center sm:p-5">
              <div
                className="relative grid size-20 place-items-center rounded-full sm:size-28"
                style={{ background: `conic-gradient(${rarityColor('Legendary')} ${chance}turn, rgb(255 255 255 / 0.08) 0)` }}
                role="img"
                aria-label={`${window.label}: ${pct(chance)}`}
              >
                <span aria-hidden className="absolute inset-[6px] rounded-full bg-surface sm:inset-2" />
                <span className="display relative text-xl sm:text-3xl">{pct(chance)}</span>
              </div>
              <p className="mt-2 font-bold">{window.label}</p>
              <p className="text-xs text-muted">{t('{n} Starr Drops', { n: window.drops })}</p>
            </div>
          );
        })}
      </div>
      <p className="text-sm leading-relaxed text-muted">
        {perDay
          ? t('On average one Starr Drop in {k} is Legendary: about one every {d} days of Daily Wins.', { k: every, d: Math.round(every / perDay) })
          : t('On average one Starr Drop in {k} is Legendary.', { k: every })}
        {chaosLegendary ? ` ${t('Chaos Drops are better odds: {p} of them are Legendary or rarer.', { p: pct(chaosLegendary) })}` : null}
      </p>
    </section>
  );
}

/**
 * A drop as the opener needs it: names already translated, and only rows
 * with a chance, since a reward the source cannot weigh cannot be rolled.
 * The Starr Drop uses our own art so each rarity can tint it, like the hero.
 */
function toOpener(type: DropType, t: T): OpenerDrop {
  const own = type.slug === 'starr-drops' || !type.imageUrl;
  return {
    slug: type.slug,
    name: t(type.name.replace(/s$/, '')),
    image: own ? '/icons/starr-drop.png' : type.imageUrl!,
    tint: own ? RARITY_TINT : type.slug === 'chaos-drops' ? CHAOS_TINT : null,
    odds: type.rarityOdds.map((odd) => ({ rarity: odd.rarity, label: t(odd.rarity === 'Ultra' ? 'Ultra Legendary' : odd.rarity), chance: odd.chance })),
    tables: Object.fromEntries(
      type.tables
        .filter((table) => table.rarity !== null)
        .map((table) => [
          table.rarity!,
          table.rewards
            .filter((reward) => reward.chance !== null)
            .map((reward) => ({ name: dropRewardName(reward, t), iconUrl: reward.iconUrl, chance: reward.chance! })),
        ]),
    ),
  };
}

/**
 * The questions the page's searches ask, answered from this render's numbers.
 *
 * Visible on the page and in the FAQ markup alike, word for word -- markup
 * that says something the page does not is what structured-data.tsx warns
 * about. Each answer is left out when the wiki did not give its numbers.
 */
function buildFaq(
  t: T,
  {
    starr,
    chaos,
    legendary,
    chaosLegendary,
    perDay,
    daily,
  }: {
    starr: DropType | null;
    chaos: DropType | null;
    legendary: number | null;
    chaosLegendary: number | null;
    perDay: number | null;
    daily: DailySchedule | null;
  },
): { question: string; answer: string }[] {
  const out: { question: string; answer: string }[] = [];
  const oddsList = (type: DropType) => andList(type.rarityOdds.map((odd) => `${t(odd.rarity)} ${pct(odd.chance)}`));

  if (daily?.wins && perDay) {
    out.push({
      question: t('How many Starr Drops do you get a day?'),
      answer:
        perDay === daily.wins
          ? t('Your first {wins} wins of the day each give a reward, and this season all {wins} are Starr Drops on a normal day.', { wins: daily.wins })
          : t('Your first {wins} wins of the day each give a reward. On a normal day this season {n} of them are Starr Drops, and the rest are the other drops and boxes in the schedule above.', { wins: daily.wins, n: perDay }),
    });
  }

  if (starr && legendary) {
    out.push({
      question: t('What are the chances of a Legendary Starr Drop?'),
      answer: t('{p} per Starr Drop, about 1 in {k}. Every Starr Drop starts Rare and can upgrade; the chance it ends as each rarity is {list}.', {
        p: pct(legendary),
        k: Math.round(1 / legendary),
        list: oddsList(starr),
      }),
    });
  }

  if (legendary && perDay) {
    out.push({
      question: t('How long does it take to get a Legendary Starr Drop?'),
      answer: t('About {d} days on average, at {n} Starr Drops a day from Daily Wins. The chance of at least one is {w} in a week and {m} in a month.', {
        d: Math.round(1 / legendary / perDay),
        n: perDay,
        w: pct(atLeastOnce(legendary, perDay * 7)),
        m: pct(atLeastOnce(legendary, perDay * 30)),
      }),
    });
  }

  const legendaryTable = starr?.tables.find((table) => table.rarity === 'Legendary');
  if (legendaryTable && legendaryTable.rewards.length > 0) {
    out.push({
      question: t('What can you get from a Legendary Starr Drop?'),
      answer: t('One of: {list}.', {
        list: andList(
          legendaryTable.rewards.map((reward) =>
            `${reward.amount ? `${reward.amount} ` : ''}${t(reward.label)}${reward.chance !== null ? ` (${pct(reward.chance)})` : ''}`,
          ),
        ),
      }),
    });
  }

  if (chaos && chaos.rarityOdds.length > 0) {
    out.push({
      question: t('What are the Chaos Drop chances?'),
      answer: chaosLegendary
        ? t('A Chaos Drop starts at Super Rare: {list}. That makes {p} of them Legendary or better, against {s} for a Starr Drop.', {
            list: oddsList(chaos),
            p: pct(chaosLegendary),
            s: legendary ? pct(legendary) : '–',
          })
        : t('A Chaos Drop starts at Super Rare: {list}.', { list: oddsList(chaos) }),
    });
  }

  out.push({
    question: t('Are these drop rates official?'),
    answer: t('They come from the Brawl Stars Wiki, which the community keeps up to date from datamines and in-game observation. Supercell publishes no drop-rate API. This page reads the wiki twice a day, so it changes when the game does.'),
  });

  return out;
}
