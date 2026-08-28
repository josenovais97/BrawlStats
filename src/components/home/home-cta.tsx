import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";

import { TrophyIcon } from "@/components/game-icons";
import { TagLocationHint } from "@/components/tag-location-hint";

/**
 * Closing call to action.
 *
 * The hero search is the way in; this is the second one, for people who read
 * the whole page first. It used to be a full-height glowing card with its own
 * headline block, which made the bottom of the page compete with the top for
 * the same job.
 *
 * Now it is one row: the ask, the button, and a hairline that hands over to
 * the footer directly beneath it. Same message, a fifth of the height.
 */
export function HomeCta() {
  return (
    <section
      aria-labelledby="closing-cta"
      className="card card-glow reveal relative overflow-hidden"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          background:
            "radial-gradient(28rem 12rem at 15% 0%, #ffc53d, transparent 70%), radial-gradient(24rem 12rem at 85% 110%, #8b6bff, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/15">
            <TrophyIcon className="size-7" />
          </span>
          <div className="min-w-0">
            <h2
              id="closing-cta"
              className="display text-xl uppercase sm:text-2xl"
            >
              See where you stand
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Your tag is on your in-game profile, just below your profile icon.{" "}
              <TagLocationHint />
            </p>
          </div>
        </div>

        <Link
          href="/#search"
          className="btn-game inline-flex shrink-0 items-center justify-center gap-2.5 bg-brand px-6 py-3.5 text-base uppercase text-brand-ink hover:bg-brand-strong"
        >
          <Search className="size-5" />
          Search a player
          <ArrowRight className="size-5" />
        </Link>
      </div>
    </section>
  );
}
