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
            <span className="eyebrow text-accent">Announced, not yet released</span>
            <h1 className="display mt-1.5 text-3xl uppercase sm:text-4xl">{name}</h1>
            <p className="mt-1.5 text-sm text-muted">
              {[rarityName, className].filter(Boolean).join(' · ') ||
                'Rarity and class not published yet'}
            </p>
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
        Says why the page is shorter than a released brawler's, rather than
        leaving it looking half-built.
        
        None of these can be faked or borrowed: every one is computed from
        battles this site sampled itself, and nobody has played {name} yet. The
        page is deliberately the same shape it will grow into, so the sections
        appear where a reader already expects them.
      */}
      <section aria-labelledby="on-release">
        <h2 id="on-release" className="display text-2xl uppercase">
          What appears on release
        </h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
          Everything below is measured from sampled battles, so none of it can
          exist before {name} is playable. This page becomes the full brawler
          page automatically once the game lists {name} and the sampler has seen
          enough matches — usually a day or two after launch.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ['Performance', 'Ranked and ladder win rates, pick rate and tier.'],
            ['Where it performs', 'The maps and modes it is strongest on.'],
            ['Matchups', 'Which brawlers it beats and loses to.'],
            ['Build & upgrades', 'The star power, gadget and gears owners actually run.'],
            ['Top players', 'The highest-trophy accounts playing it.'],
            ['Balance history', 'Every change Supercell makes to it from here.'],
          ].map(([title, detail]) => (
            <li key={title} className="card p-3.5">
              <p className="text-sm font-bold">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{detail}</p>
            </li>
          ))}
        </ul>
      </section>

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
