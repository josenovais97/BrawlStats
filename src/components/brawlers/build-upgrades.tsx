import Image from 'next/image';
import type { ReactNode } from 'react';

import {
  AbilityChoices,
  hasAbilityChoices,
} from '@/components/brawlers/ability-choices';
import { PopularBuild } from '@/components/brawlers/popular-build';
import {
  BuffieIcon,
  GadgetIcon,
  GearIcon,
  HyperchargeIcon,
  StarPowerIcon,
} from '@/components/game-icons';
import { ClampedText } from '@/components/ui/disclosure';
import { SectionHeading } from '@/components/ui/section-heading';
import { gearIconUrl } from '@/lib/brawlapi';
import type { BrawlerWiki } from '@/lib/brawler-wiki';
import { slugify } from '@/lib/slugs';
import type { BrawlerAbilityChoices, BrawlerBuffies } from '@/lib/stats';
import type { BAAccessory, BABrawler } from '@/types/brawlapi';
import type { BSAccessory } from '@/types/brawlstars';
import type { BrawlerBuild } from '@/types/stats';

/**
 * Everything a player unlocks, buys or equips, in one place.
 *
 * These were six full-width sections spread down the page with the win-rate
 * tables cut in between them, so reading "what do I actually build on this
 * brawler" meant three round trips past statistics answering a different
 * question. They are one area now, in the order a player meets them: what
 * other owners bought, then the kit itself, then the coins.
 *
 * Each ability type carries its own colour, matching the game's own — gold for
 * star powers, green for gadgets, pink for hypercharges, purple for buffies —
 * so the type of a card is legible before its label is read. That is also what
 * lets the cards sit two to a row without the row reading as one thing.
 */
const KIND = {
  starPower: { accent: '#ffc53d', label: 'Star power' },
  gadget: { accent: '#35d07f', label: 'Gadget' },
  hypercharge: { accent: '#ff5c72', label: 'Hypercharge' },
  buffie: { accent: '#8b6bff', label: 'Buffie' },
  gear: { accent: '#35d0ff', label: 'Gear' },
} as const;

export function BuildAndUpgrades({
  name,
  brawler,
  starPowers,
  gadgets,
  gears,
  gearNames,
  gearText,
  hyperCharges,
  hyperchargeName,
  hyperchargeDescription,
  buffieEffects,
  buffies,
  build,
  abilityChoices,
  wiki,
}: {
  name: string;
  brawler: BABrawler;
  starPowers: BAAccessory[];
  gadgets: BAAccessory[];
  gears: BSAccessory[];
  gearNames: Map<number, string>;
  /** Slugged gear name -> what it does, from the wiki's one Gears page. */
  gearText: Map<string, string>;
  hyperCharges: BSAccessory[];
  hyperchargeName: string | null;
  hyperchargeDescription: string | null;
  buffieEffects: { kind: string; ability: string; effect: string }[];
  buffies: BrawlerBuffies | null;
  build: BrawlerBuild | null;
  abilityChoices: BrawlerAbilityChoices | null;
  wiki?: BrawlerWiki | null;
}) {
  // Only a brawler whose owners are actually split has a first-buy preference
  // to show; otherwise the coin spend gets the full width to itself.
  const showChoices = hasAbilityChoices(abilityChoices);
  const hasHypercharge = hyperCharges.length > 0 || Boolean(hyperchargeName);
  const hasBuffies = buffieEffects.length > 0 || Boolean(buffies);

  /*
   * The wiki's copy of the in-game text has its numbers filled in; the artwork
   * source ships the same sentence with the game's own placeholders still in
   * it, which can only be rendered as "?". Prefer the readable one.
   */
  const describe = (item: BAAccessory) =>
    wiki?.abilities.get(slugify(item.name))?.description ?? item.description;

  /*
   * Matched on the slugged name rather than by position. The infobox numbers
   * its gadgets and the game API lists them in its own order, and the two have
   * no contract with each other — pairing by index would eventually put one
   * gadget's cooldown under another's name, silently and only for the brawlers
   * where the orders happen to differ.
   */
  const cooldowns = new Map(
    (wiki?.gadgets ?? []).map((g) => [slugify(g.name), g.cooldown] as const),
  );
  const cooldownOf = (item: BAAccessory) => cooldowns.get(slugify(item.name)) ?? null;

  return (
    <section id="build" className="scroll-anchor">
      <SectionHeading
        title="Build & upgrades"
        subtitle={`What ${name}'s kit does, and what owners spend their coins on first.`}
      />

      <div className="space-y-4">
        {/* What other owners bought. First, because it is the only part of
            this area that is a recommendation rather than a reference. */}
        <div className={`grid gap-4 ${showChoices ? 'lg:grid-cols-2' : ''}`}>
          {showChoices && abilityChoices ? (
            <AbilityChoices
              choices={abilityChoices}
              starPowers={starPowers}
              gadgets={gadgets}
            />
          ) : null}
          <PopularBuild
            build={build}
            meta={{ ...brawler, starPowers, gadgets }}
            gearNames={gearNames}
          />
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <AbilityCard
            title="Star powers"
            kind="starPower"
            icon={<StarPowerIcon className="size-5" />}
            items={starPowers}
            emptyLabel="No star powers released."
            descriptionFor={describe}
          />
          <AbilityCard
            title="Gadgets"
            kind="gadget"
            icon={<GadgetIcon className="size-5" />}
            items={gadgets}
            emptyLabel="No gadgets released."
            descriptionFor={describe}
            cooldownFor={cooldownOf}
          />
        </div>

        {/* `items-start`, like the pair above: a hypercharge is one paragraph
            and a buffie list is one row per ability, so stretching them to
            match left the hypercharge card as a caption floating in three
            hundred pixels of empty surface. */}
        {hasHypercharge || hasBuffies ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {hasHypercharge ? (
              <UpgradeCard
                title="Hypercharge"
                kind="hypercharge"
                icon={<HyperchargeIcon className="size-5" />}
              >
                <div className="flex gap-3.5 p-4">
                  {/* The game's own hypercharge mark, shipped with the site:
                      the artwork CDN has no per-hypercharge set under any
                      path, so one icon stands for the ability. */}
                  <span
                    className="grid size-12 shrink-0 place-items-center rounded-xl"
                    style={{
                      background: `color-mix(in srgb, ${KIND.hypercharge.accent} 18%, transparent)`,
                    }}
                  >
                    <HyperchargeIcon className="size-7" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold capitalize">
                      {(hyperchargeName ?? hyperCharges[0]?.name ?? 'Hypercharge').toLowerCase()}
                    </p>
                    {/* What it changes, in the game's own words. No ownership
                        percentage: how many sampled players have bought it
                        says nothing about what it does, which is the only
                        question this card is here to answer. */}
                    <ClampedText
                      className="mt-1"
                      text={
                        hyperchargeDescription ??
                        `Unlocked at Power 11. Charges from dealing and taking damage, then boosts ${name}'s speed, damage and shield for a few seconds.`
                      }
                    />
                    {!hyperchargeDescription ? (
                      <p className="mt-2 text-xs leading-relaxed text-muted/80">
                        The exact boost percentages vary per brawler and are published
                        neither by the game API nor by any artwork source.
                      </p>
                    ) : null}
                  </div>
                </div>
              </UpgradeCard>
            ) : null}

            {hasBuffies ? (
              <UpgradeCard
                title="Buffies"
                kind="buffie"
                icon={<BuffieIcon className="size-5" />}
              >
                {/*
                  What each buffie does, per ability. A brawler has one buffie
                  per ability type, but its effect differs by which gadget or
                  star power it is buffing, so they are listed against the
                  ability rather than as three flat rows.
                */}
                {buffieEffects.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {buffieEffects.map((entry) => (
                      <li key={`${entry.kind}-${entry.ability}`} className="p-4">
                        <p className="flex flex-wrap items-baseline gap-2">
                          <span className="font-semibold capitalize">
                            {entry.ability.toLowerCase()}
                          </span>
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted">
                            {entry.kind}
                          </span>
                        </p>
                        <ClampedText className="mt-1" text={entry.effect} />
                      </li>
                    ))}
                  </ul>
                ) : (buffies?.none ?? true) ? (
                  <p className="p-4 text-sm text-muted">
                    <span className="font-semibold text-foreground">Unreleased.</span>{' '}
                    {name} has no buffies yet.
                  </p>
                ) : (
                  /* Our own samples say buffies exist here, but the wiki has no
                     text for them. A brand-new release, most likely. */
                  <p className="p-4 text-sm text-muted">
                    <span className="font-semibold text-foreground">Released.</span>{' '}
                    {name} has buffies, but their effects have not been documented yet.
                  </p>
                )}
              </UpgradeCard>
            ) : null}
          </div>
        ) : null}

        {gears.length > 0 ? (
          <UpgradeCard
            title="Gears"
            kind="gear"
            icon={<GearIcon className="size-5" />}
            aside={`${gears.length} equippable`}
          >
            {/*
              Separate tiles rather than cells divided by hairlines. A brawler
              has seven gears and the grid runs two or three across, so the
              last row is nearly always short — and with the dividers drawn by
              the container's background, every unfilled cell rendered as a
              blank panel sitting in the row.
            */}
            <ul className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {gears.map((gear) => {
                const text = gearText.get(slugify(gear.name));
                return (
                  <li
                    key={gear.id}
                    className="flex gap-3 rounded-xl bg-surface-2/50 p-3"
                  >
                    <Image
                      src={gearIconUrl(gear.id)}
                      alt=""
                      width={36}
                      height={36}
                      className="size-9 shrink-0 object-contain"
                      loading="lazy"
                      unoptimized
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold capitalize">
                        {gear.name.toLowerCase()}
                      </span>
                      {/* The catalogue names a gear but never says what it
                          does, which left this list as six bare words. */}
                      {text ? (
                        <span className="mt-0.5 block text-xs leading-snug text-muted">
                          {text}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </UpgradeCard>
        ) : null}
      </div>
    </section>
  );
}

/** A titled panel with a coloured type marker along its top edge. */
function UpgradeCard({
  title,
  kind,
  icon,
  aside,
  children,
}: {
  title: string;
  kind: keyof typeof KIND;
  icon: ReactNode;
  aside?: string;
  children: ReactNode;
}) {
  const { accent } = KIND[kind];
  return (
    <div className="card flex flex-col overflow-hidden">
      <span aria-hidden className="block h-0.5 w-full" style={{ background: accent }} />
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{
            background: `color-mix(in srgb, ${accent} 16%, transparent)`,
            color: accent,
          }}
        >
          {icon}
        </span>
        <h3 className="display flex-1 text-lg uppercase leading-none">{title}</h3>
        {aside ? <span className="shrink-0 text-xs text-muted">{aside}</span> : null}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** Star powers or gadgets: portrait, name, and the resolved in-game text. */
function AbilityCard({
  title,
  kind,
  icon,
  items,
  emptyLabel,
  descriptionFor,
  cooldownFor,
}: {
  title: string;
  kind: keyof typeof KIND;
  icon: ReactNode;
  items: BAAccessory[];
  emptyLabel: string;
  descriptionFor: (item: BAAccessory) => string;
  /** Gadgets only: the wiki records a cooldown, nothing else does. */
  cooldownFor?: (item: BAAccessory) => string | null;
}) {
  return (
    <UpgradeCard
      title={title}
      kind={kind}
      icon={icon}
      aside={items.length > 0 ? `${items.length}` : undefined}
    >
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3.5 p-4">
              <Image
                src={item.imageUrl}
                alt=""
                width={44}
                height={44}
                className="size-11 shrink-0 object-contain"
                loading="lazy"
                unoptimized
              />
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 font-bold capitalize">
                  {item.name.toLowerCase()}
                  {/* The cooldown decides whether a gadget is a habit or an
                      emergency button, and the game shows it nowhere. */}
                  {cooldownFor?.(item) ? (
                    <span className="text-xs font-semibold normal-case text-muted">
                      {cooldownFor(item)} cooldown
                    </span>
                  ) : null}
                </p>
                {/* Descriptions run from eight words to sixty. Clamped past a
                    threshold so one wordy gadget cannot make its card three
                    times the height of the one beside it. */}
                <ClampedText className="mt-1" text={descriptionFor(item)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </UpgradeCard>
  );
}
