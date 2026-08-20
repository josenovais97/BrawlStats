import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import {
  BattlesIcon,
  BrawlersIcon,
  HyperchargeIcon,
  Power11Icon,
  TrophyIcon,
} from '@/components/game-icons';
import { SAMPLE_PLAYER_TAG } from '@/lib/site';

/**
 * What a visitor actually gets for typing their tag in.
 *
 * Built from the profile's own furniture rather than from marketing icons: the
 * accent rule, the display heading, the real section names and the real game
 * marks are the same ones the page uses, so this reads as a preview of the
 * product instead of a feature list about it.
 *
 * Nothing here is a screenshot and nothing is a made-up number. Profiles
 * differ enormously between accounts, a stale image would represent nobody,
 * and inventing a completion percentage to fill a progress bar would be worse
 * than either. The proof is a real profile, one click away, deep-linked to the
 * section each card names.
 */
const MODULES = [
  {
    title: 'Skill score',
    icon: <TrophyIcon className="size-5" />,
    body: 'Out of 10, weighted toward Ranked — how you play, not how long you have played.',
    hash: '',
  },
  {
    title: 'Roster vs the meta',
    icon: <BrawlersIcon className="size-5" />,
    body: 'Every brawler you own, tiered against the current list. Strong picks, and the ones you are missing.',
    hash: '#brawlers',
  },
  {
    title: 'Progression',
    icon: <Power11Icon className="size-5" />,
    body: 'Account completion, coins invested, and what finishing the rest would cost.',
    hash: '#progress',
  },
  {
    title: 'Upgraded but not maxed',
    icon: <HyperchargeIcon className="size-5" />,
    body: 'Hypercharges and buffies stranded on brawlers below power 11, cheapest to finish first.',
    hash: '#progress',
  },
  {
    title: 'Recent battles',
    icon: <BattlesIcon className="size-5" />,
    body: 'Your last matches with the brawlers, maps and star players, plus who you keep running into.',
    hash: '#battles',
  },
];

export function HomeProfileDepth() {
  return (
    <section className="reveal" aria-labelledby="profile-depth">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="eyebrow text-accent">After you search</p>
          <h2 id="profile-depth" className="display mt-2.5 text-2xl uppercase sm:text-3xl">
            What a profile gives you
          </h2>
        </div>
        <Link
          href={`/player/${SAMPLE_PLAYER_TAG}`}
          className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border-strong/70 bg-surface px-4 text-sm font-bold transition-colors hover:border-brand/60 hover:text-brand"
        >
          Open a sample profile
          <ArrowRight className="size-4 duration-200 group-hover:translate-x-0.5 motion-safe:transition-transform" />
        </Link>
      </div>

      {/*
        One panel of hairline-divided rows rather than five more cards. The
        page already has three card grids; this is the block that most needed
        to stop being another one.
      */}
      <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(({ title, icon, body, hash }) => (
          <li key={title} className="bg-surface">
            <Link
              href={`/player/${SAMPLE_PLAYER_TAG}${hash}`}
              className="group flex h-full flex-col p-4 transition-colors hover:bg-surface-2 sm:p-5"
            >
              {/* The profile's own section heading, at a smaller size. */}
              <span className="flex items-center gap-2.5">
                <span aria-hidden className="rule" />
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2">
                  {icon}
                </span>
                <span className="display min-w-0 flex-1 truncate text-base uppercase leading-none">
                  {title}
                </span>
              </span>
              <span className="mt-2.5 text-sm leading-relaxed text-muted">{body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
