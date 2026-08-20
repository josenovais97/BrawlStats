import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { SearchBar } from '@/components/search-bar';
import { brawlerModelUrl } from '@/lib/brawlapi';
import { SAMPLE_PLAYER_TAG } from '@/lib/site';

/**
 * Landing hero.
 *
 * Two rules, learned the hard way.
 *
 * The first is that the *lighting* goes full bleed and the *content* does not.
 * A hero boxed inside the site's 72rem column reads as a document on a wide
 * screen — the background has to run to the edges for the page to feel like a
 * product. But the moment the cast was also cut loose it grew to fill the
 * space it was given, cropped itself against the header and covered the
 * numbers underneath. Contained content, uncontained light.
 *
 * The second is that the stage has to end before the proof band starts. The
 * cast is bottom-anchored, so if it shares a positioning context with the band
 * then `bottom-0` is the bottom of the band and the artwork sits on top of the
 * statistics. They are separate blocks now, which makes that overlap
 * impossible rather than merely unlikely.
 *
 * The art uses full-body renders rather than the square portrait tiles. The
 * tiles carry their own rarity-coloured background, so overlapping them just
 * produced a pile of rotated rectangles; the renders are cut out and can stand
 * as a group.
 */

/**
 * The line-up, drawn back to front and sized as a share of the art column.
 *
 * Widths are deliberately modest. The tallest render is 22rem inside a 28rem
 * stage, which leaves headroom above the group — a cast cropped by the header
 * looks like a mistake, and one that fills every pixel looks like a banner ad.
 */
const CAST = [
  {
    id: 16000024,
    name: 'Crow',
    glow: '#8b6bff',
    className: 'left-0 bottom-0 w-[42%] opacity-85 z-10',
  },
  {
    id: 16000019,
    name: 'Spike',
    glow: '#35d07f',
    className: 'right-0 bottom-[2%] w-[44%] opacity-90 z-20',
  },
  {
    id: 16000000,
    name: 'Shelly',
    glow: '#ffc53d',
    className: 'left-[19%] bottom-0 w-[58%] z-30',
  },
];

export function HomeHero({ stats }: { stats?: ReactNode }) {
  return (
    /*
      `w-screen` centred on the page escapes `main`'s column. Safe because the
      body clips horizontal overflow — see `globals.css`.
    */
    <section className="relative left-1/2 -mt-8 w-screen -translate-x-1/2">
      {/* ------------------------------ the stage --------------------------- */}
      <div className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              background:
                /*
                 * Three lights and a fade. A purple key over the copy, a warm
                 * rim under the headline so the gold has something to sit on,
                 * a cool spot behind the cast, and a linear stop so the stage
                 * ends without a seam where it meets the page.
                 */
                'radial-gradient(52rem 26rem at 20% 24%, color-mix(in srgb, #8b6bff 34%, transparent), transparent 66%),' +
                'radial-gradient(28rem 13rem at 16% 46%, color-mix(in srgb, #ffc53d 14%, transparent), transparent 70%),' +
                'radial-gradient(34rem 28rem at 76% 30%, color-mix(in srgb, #35d0ff 12%, transparent), transparent 68%),' +
                'linear-gradient(180deg, transparent 60%, var(--background) 98%)',
            }}
          />

          {/*
            A faint square grid, masked to the middle so it fades out well
            before the edges. It gives the light something to fall on, and
            costs two repeating gradients rather than an image. Dropped on
            phones, where it is invisible and only costs paint.
          */}
          <div
            className="absolute inset-0 hidden opacity-[0.22] sm:block"
            style={{
              backgroundImage:
                'linear-gradient(to right, color-mix(in srgb, #ffffff 5%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, #ffffff 5%, transparent) 1px, transparent 1px)',
              backgroundSize: '72px 72px',
              maskImage:
                'radial-gradient(44rem 24rem at 42% 32%, #000 12%, transparent 74%)',
              WebkitMaskImage:
                'radial-gradient(44rem 24rem at 42% 32%, #000 12%, transparent 74%)',
            }}
          />
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12 lg:px-8">
          {/*
            `items-end` puts the cast on the same baseline as the search panel,
            so the two read as one scene rather than as two floating blocks.
          */}
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10">
            <div className="reveal-now pb-10 sm:pb-12">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-strong/70 bg-surface/70 px-3.5 py-1.5 backdrop-blur">
                <span className="live-dot" />
                <span className="eyebrow text-brand">Live Brawl Stars data</span>
              </span>

              {/*
                Both lines take the game's own chunky lettering. The gold half
                used to be a clipped gradient, which needs `text-transparent`
                — so `display-hero`'s black drop shadow was painted straight
                through the glyphs and the line rendered brown. Solid colour,
                same shadow.
              */}
              <h1 className="display-hero mt-5 text-[2.25rem] uppercase leading-[0.95] sm:text-[2.5rem] lg:text-[3rem]">
                Brawl Stars stats that
                <br />
                <span className="text-brand">show where you stand</span>
              </h1>

              <p className="mt-4 max-w-md leading-relaxed text-muted">
                One tag gives you a skill score out of 10, your roster read against
                the live meta, and your progression tracked over time.
              </p>

              {/*
                The one thing on the page you are meant to touch, lit like it:
                a gold hairline along the top edge and a warm bloom behind the
                panel, the way the game lights its own. The bloom is a sibling
                rather than a box-shadow so it can spill past the rounded
                corners instead of being clipped by them.
              */}
              <div className="relative mt-7 max-w-xl">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-x-8 -bottom-8 -top-5 -z-10 rounded-[2.5rem] opacity-70 blur-3xl"
                  style={{
                    background:
                      'radial-gradient(58% 58% at 28% 0%, color-mix(in srgb, #ffc53d 24%, transparent), transparent 72%)',
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
                        Secondary to the search and to the recent row below it,
                        so it is a line of text rather than a button — but it
                        opens a real profile rather than a mock-up, which is
                        the only way to show what a lookup returns without
                        inventing numbers.
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

            {/*
              Held to `lg`. At `md` the column is narrow enough that the group
              becomes three slivers, which is worse than no artwork at all.
            */}
            <div
              aria-hidden
              className="relative hidden h-[26rem] lg:block lg:h-[28rem]"
            >
              {/* Ground light, so the group is standing rather than floating. */}
              <span
                className="absolute inset-x-[10%] bottom-4 h-16 rounded-[50%] opacity-55 blur-2xl"
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
                    width={460}
                    height={670}
                    className="relative h-auto w-full select-none object-contain drop-shadow-[0_20px_32px_rgba(0,0,0,0.65)]"
                    /*
                     * Decorative and desktop-only. Left lazy on purpose: a
                     * phone never paints this column, so it should never pay
                     * for it.
                     */
                    loading="lazy"
                    fetchPriority="low"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------ the proof --------------------------- */}
      {/*
        Its own block, outside the stage. That is what guarantees the cast can
        never reach it: there is no shared positioning context for `bottom-0`
        to resolve against. The rule and ground run the full width; the numbers
        stay on the content column so they line up with every section below.
      */}
      {stats ? (
        <div className="relative border-t border-border/70 bg-background/50 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">{stats}</div>
        </div>
      ) : null}
    </section>
  );
}
