import { ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';

import { TrophyIcon } from '@/components/game-icons';

/**
 * Closing call to action.
 *
 * The hero search is the primary path in; this is the second one, for people
 * who scrolled the whole page first. It intentionally echoes the hero's glow
 * and gold button so the page reads as bookended rather than as two unrelated
 * pitches.
 */
export function HomeCta() {
  return (
    <section
      aria-labelledby="closing-cta"
      className="card card-glow reveal relative overflow-hidden px-6 py-12 text-center sm:px-12 sm:py-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          background:
            'radial-gradient(32rem 15rem at 50% 0%, #ffc53d, transparent 70%), radial-gradient(26rem 13rem at 15% 110%, #8b6bff, transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-xl">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/15 text-brand">
          <TrophyIcon className="size-6" />
        </span>

        <h2
          id="closing-cta"
          className="display mt-5 text-balance text-3xl uppercase leading-tight sm:text-4xl"
        >
          Your next milestone starts here
        </h2>

        <p className="mt-4 text-pretty leading-relaxed text-muted">
          Search your Brawl Stars tag and see exactly how you are progressing. Your tag
          is on your in-game profile, just below your name.
        </p>

        <Link
          href="/#search"
          className="btn-game mt-8 inline-flex items-center gap-2.5 bg-brand px-8 py-4 text-lg uppercase text-brand-ink hover:bg-brand-strong"
        >
          <Search className="size-5" />
          Search a player
          <ArrowRight className="size-5" />
        </Link>
      </div>
    </section>
  );
}
