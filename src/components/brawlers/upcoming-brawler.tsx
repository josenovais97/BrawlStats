import Image from 'next/image';
import Link from 'next/link';

import { GadgetIcon, StarPowerIcon } from '@/components/game-icons';
import type { UpcomingBrawler } from '@/lib/announced';

/**
 * A brawler that has been revealed but is not in the game yet.
 *
 * The point is to exist. In the hours after a Brawl Talk, people search the
 * name and almost nothing has been published — so a page that is already there
 * with the rarity, the class and the ability names is the one that gets found,
 * and it becomes the real page the moment the brawler ships.
 *
 * Everything here comes from the community wiki, which fills in over the days
 * after a reveal. That makes it the one page on the site whose numbers are not
 * measured from battles, so it says so plainly rather than letting a reader
 * assume these carry the same weight as the rest.
 */
/** The measured half of a brawler page, in the order the released pages use. */
const MEASURED_SECTIONS = [
  { id: 'performance', title: 'Performance', blurb: 'Ranked and ladder win rates, pick rate and tier.' },
  { id: 'where', title: 'Where it performs', blurb: 'The maps and modes it is strongest on.' },
  { id: 'matchups', title: 'Matchups', blurb: 'Which brawlers it beats, and which beat it.' },
  { id: 'build', title: 'Build & upgrades', blurb: 'The star power, gadget and gears owners actually run.' },
  { id: 'top-players', title: 'Top players', blurb: 'The highest-trophy accounts playing it.' },
] as const;

export function UpcomingBrawlerPage({ brawler }: { brawler: UpcomingBrawler }) {
  const { name, rarityName, className, stats, abilities, portraitUrl } = brawler;
  const gadgets = abilities.filter((a) => a.kind === 'gadget');
  const starPowers = abilities.filter((a) => a.kind === 'starPower');
  const bare = stats.length === 0 && abilities.length === 0;

  return (
    <div className="space-y-8">
      <header className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          {portraitUrl ? (
            <Image
              src={portraitUrl}
              alt=""
              width={128}
              height={128}
              className="size-32 shrink-0 self-start rounded-2xl bg-surface-2 object-contain"
              priority
              unoptimized
            />
          ) : (
            <span
              aria-hidden
              className="grid size-32 shrink-0 self-start place-items-center rounded-2xl border border-dashed border-border bg-surface-2 text-3xl text-muted"
            >
              ?
            </span>
          )}

          <div className="min-w-0">
            {/* Pills in the same shape the released pages use, so a reader
                moving between the two is not learning a second layout. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                Not released yet
              </span>
              {rarityName ? (
                <span className="inline-flex items-center rounded-full border border-border-strong/60 bg-surface-2/80 px-3 py-1 text-xs font-semibold text-muted">
                  {rarityName}
                </span>
              ) : null}
              {className ? (
                <span className="inline-flex items-center rounded-full border border-border-strong/60 bg-surface-2/80 px-3 py-1 text-xs font-semibold text-muted">
                  {className}
                </span>
              ) : null}
            </div>
            <h1 className="display mt-3 text-3xl capitalize sm:text-4xl">{name.toLowerCase()}</h1>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
              {name} has been revealed but is not playable yet, so there are no
              sampled battles behind this page. Everything below comes from the
              community wiki and fills in over the days after a reveal.
            </p>
          </div>
        </div>
      </header>

      {stats.length > 0 ? (
        <section aria-labelledby="stats">
          <h2 id="stats" className="display text-2xl uppercase">
            Combat stats
          </h2>
          <p className="mt-1 text-sm text-muted">
            Base values, before gears and star powers. Provisional until release.
          </p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="card flex items-baseline justify-between p-3.5">
                <dt className="text-sm text-muted">{stat.label}</dt>
                <dd className="text-lg font-bold tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {abilities.length > 0 ? (
        <section aria-labelledby="abilities">
          <h2 id="abilities" className="display text-2xl uppercase">
            Gadgets and star powers
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <AbilityCard
              title="Gadgets"
              icon={<GadgetIcon className="size-5" />}
              items={gadgets}
            />
            <AbilityCard
              title="Star powers"
              icon={<StarPowerIcon className="size-5" />}
              items={starPowers}
            />
          </div>
        </section>
      ) : null}

      {bare ? (
        <p className="card p-5 text-sm leading-relaxed text-muted">
          Nothing beyond the name has been published for {name} yet. This page
          fills in as the wiki does.
        </p>
      ) : null}

      {/*
        The same sections a released brawler has, each saying plainly that it
        has nothing yet.
        
        Every one is computed from battles this site sampled itself, so none of
        them can be borrowed or estimated before anyone has played. Rendering
        them empty rather than omitting them keeps the page the shape it will
        grow into: a reader finds matchups where matchups live, and learns why
        it is blank instead of wondering whether the site simply lacks it.
      */}
      {MEASURED_SECTIONS.map((section) => (
        <section key={section.id} aria-labelledby={section.id}>
          <h2 id={section.id} className="display text-2xl uppercase">
            {section.title}
          </h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
            {section.blurb}
          </p>
          <p className="card mt-3 p-4 text-sm text-muted">
            <span className="font-semibold text-foreground">No data yet.</span>{' '}
            {name} is not playable, so no battles have been sampled. This fills
            in within a day or two of release.
          </p>
        </section>
      ))}

      <p className="text-sm text-muted">
        <Link href="/brawlers" className="text-brand hover:underline">
          All brawlers
        </Link>{' '}
        · Stats and abilities from the Brawl Stars Wiki, which is community
        edited and may change before release.
      </p>
    </div>
  );
}

function AbilityCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: UpcomingBrawler['abilities'];
}) {
  if (items.length === 0) return null;
  return (
    <div className="card p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((a, i) => (
          <li
            key={a.name ?? i}
            className="flex items-center gap-3 rounded-xl bg-surface-2 p-2.5"
          >
            {a.imageUrl ? (
              <Image
                src={a.imageUrl}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0"
                loading="lazy"
                unoptimized
              />
            ) : (
              <span aria-hidden className="size-9 shrink-0 rounded-lg bg-surface-3" />
            )}
            <span className="min-w-0 text-sm font-semibold">
              {a.name ?? <span className="text-muted">Not named yet</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
