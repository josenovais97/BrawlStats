import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SearchBar } from '@/components/search-bar';
import { brawlerModelUrl } from '@/lib/brawlapi';
import { SAMPLE_PLAYER_TAG } from '@/lib/site';

/**
 * Landing hero, built as a full-bleed stage.
 *
 * The version this replaced was boxed inside the site's 72rem content column,
 * which is why no amount of tuning made it feel like anything: on a wide
 * screen it was a small rectangle of content floating in the middle of an
 * empty page, and every light, every character and every panel was confined to
 * it. Content that stops short of the edges reads as a document. Content that
 * runs to them reads as a product.
 *
 * So the section escapes the column and the copy does not. The background,
 * the stage lighting and the cast run edge to edge; the headline, the search
 * and the proof band stay on the same alignment line as every other section on
 * the page, because breaking that would be chaos rather than drama.
 *
 * The cast uses full-body renders rather than the square portrait tiles. The
 * tiles carry their own rarity-coloured background, so overlapping them just
 * produced a pile of rotated rectangles; the renders are cut out and can stand
 * on a stage as a group.
 */

/**
 * The line-up, drawn back to front.
 *
 * Positioned as percentages of the art stage rather than of the page, so the
 * group holds its composition from a 20rem column up to a 46rem one instead of
 * drifting apart on wide screens.
 */
const CAST = [
  {
    id: 16000024,
    name: 'Crow',
    glow: '#8b6bff',
    className: 'left-[2%] bottom-0 w-[34%] opacity-85 z-10',
  },
  {
    id: 16000019,
    name: 'Spike',
    glow: '#35d07f',
    className: 'right-[1%] bottom-[2%] w-[36%] opacity-90 z-20',
  },
  {
    id: 16000000,
    name: 'Shelly',
    glow: '#ffc53d',
    className: 'left-[22%] bottom-0 w-[48%] z-30',
  },
];

export function HomeHero({ stats }: { stats?: ReactNode }) {
  return (
    /*
      `w-screen` centred on the page is the escape hatch out of `main`'s
      column. Safe because the body clips horizontal overflow — see
      `globals.css` — which is the one thing that makes this pattern viable
      without a scrollbar appearing on desktop.
    */
    <section className="relative left-1/2 -mt-8 w-screen -translate-x-1/2 overflow-hidden">
      {/* ---------------------------- the stage ---------------------------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              /*
               * Four lights. A purple key over the copy, a warm rim under the
               * headline so the gold has something to sit on, a cool spot over
               * the cast, and a linear fade into the page so the stage ends
               * without a seam.
               */
              'radial-gradient(52rem 26rem at 22% 22%, color-mix(in srgb, #8b6bff 36%, transparent), transparent 66%),' +
              'radial-gradient(30rem 14rem at 18% 44%, color-mix(in srgb, #ffc53d 15%, transparent), transparent 70%),' +
              'radial-gradient(38rem 30rem at 78% 26%, color-mix(in srgb, #35d0ff 13%, transparent), transparent 68%),' +
              'linear-gradient(180deg, transparent 55%, var(--background) 96%)',
          }}
        />

        {/*
          A faint square grid, masked to the middle. It gives the light
          something to fall on so the top of the page is not an empty
          gradient, and it costs two repeating gradients rather than an image.
          Dropped on phones, where it is invisible and only costs paint.
        */}
        <div
          className="absolute inset-0 hidden opacity-[0.25] sm:block"
          style={{
            backgroundImage:
              'linear-gradient(to right, color-mix(in srgb, #ffffff 5%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, #ffffff 5%, transparent) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage:
              'radial-gradient(46rem 26rem at 45% 30%, #000 15%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(46rem 26rem at 45% 30%, #000 15%, transparent 75%)',
          }}
        />
      </div>

      {/* ------------------------------ the cast ---------------------------- */}
      {/*
        Anchored to the section rather than to a grid column, which is the
        whole point of going full bleed: on a wide screen the group stands
        outside the content column instead of being squeezed beside it, and it
        is bottom-aligned to the search panel so the two read as one scene.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 hidden h-[26rem] w-[46%] max-w-[44rem] md:block lg:h-[31rem]"
      >
        {/* Ground light, so the group is standing rather than floating. */}
        <span
          className="absolute inset-x-[12%] bottom-6 h-20 rounded-[50%] opacity-55 blur-3xl"
          style={{
            background:
              'radial-gradient(closest-side, #8b6bff, color-mix(in srgb, #8b6bff 25%, transparent), transparent)',
          }}
        />

        {CAST.map((brawler) => (
          <div key={brawler.id} className={`absolute ${brawler.className}`}>
            <span
              className="absolute inset-x-[10%] bottom-[8%] top-[16%] rounded-full opacity-30 blur-3xl"
              style={{ background: brawler.glow }}
            />
            <Image
              src={brawlerModelUrl(brawler.id)}
              alt=""
              width={520}
              height={760}
              className="relative h-auto w-full select-none object-contain drop-shadow-[0_22px_36px_rgba(0,0,0,0.7)]"
              /*
               * Decorative and desktop-only. Left lazy on purpose: a phone
               * never paints this column, so it should never pay for it.
               */
              loading="lazy"
              fetchPriority="low"
              unoptimized
            />
          </div>
        ))}
      </div>

      {/* ----------------------------- the copy ----------------------------- */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <div className="reveal-now max-w-xl md:max-w-lg lg:max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-strong/70 bg-surface/70 px-3.5 py-1.5 backdrop-blur">
            <span className="live-dot" />
            <span className="eyebrow text-brand">Live Brawl Stars data</span>
          </span>

          {/*
            Both lines take the game's own chunky lettering. The gold half used
            to be a clipped gradient, which needs `text-transparent` — so
            `display-hero`'s black drop shadow was painted straight through the
            glyphs and the line rendered brown. Solid colour, same shadow.
          */}
          <h1 className="display-hero mt-5 text-[2.25rem] uppercase leading-[0.95] sm:text-[2.5rem] md:text-[2rem] lg:text-[2.875rem]">
            Brawl Stars stats that
            <br />
            <span className="text-brand">show where you stand</span>
          </h1>

          <p className="mt-3.5 max-w-lg leading-relaxed text-muted">
            One tag gives you a skill score out of 10, your roster read against the
            live meta, and your progression tracked over time.
          </p>

          {/*
            The one thing on the page you are meant to touch, lit like it: a
            gold hairline along the top edge and a warm bloom behind the panel,
            the way the game lights its own panels. The bloom is a sibling
            rather than a box-shadow so it can spill past the rounded corners
            instead of being clipped by them.
          */}
          <div className="relative mt-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-8 -bottom-8 -top-5 -z-10 rounded-[2.5rem] opacity-70 blur-3xl"
              style={{
                background:
                  'radial-gradient(58% 58% at 28% 0%, color-mix(in srgb, #ffc53d 26%, transparent), transparent 72%)',
              }}
            />
            <div className="card card-glow overflow-hidden border-border-strong/60 p-4 sm:p-5">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, color-mix(in srgb, var(--brand) 75%, transparent) 28%, color-mix(in srgb, var(--brand) 45%, transparent) 72%, transparent)',
                }}
              />
              <SearchBar
                autoFocus
                showRecent
                size="hero"
                footer={
                  /*
                    Secondary to the search and to the recent row below it, so
                    it is a line of text rather than a button — but it opens a
                    real profile rather than a mock-up, which is the only way
                    to show what a lookup returns without inventing numbers.
                  */
                  <p className="mt-2.5 text-sm text-muted">
                    No tag handy?{' '}
                    <Link
                      href={`/player/${SAMPLE_PLAYER_TAG}`}
                      className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                    >
                      Try a sample profile
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </p>
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------- the proof ----------------------------- */}
      {/*
        A band that runs the full width under the stage, the way a scoreboard
        does. Its numbers stay on the content column so they line up with
        everything below, but the rule and ground behind them do not — which is
        what makes the hero end on a line rather than on a floating box.
      */}
      {stats ? (
        <div className="relative mt-10 border-t border-border/70 bg-background/40 backdrop-blur-sm sm:mt-14">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">{stats}</div>
        </div>
      ) : null}
    </section>
  );
}
