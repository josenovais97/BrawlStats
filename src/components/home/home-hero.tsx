import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { HomeHeroInsight } from '@/components/home/home-hero-insight';
import { SearchBar } from '@/components/search-bar';
import { brawlerModelUrl } from '@/lib/brawlapi';
import { SAMPLE_PLAYER_TAG } from '@/lib/site';

/**
 * The hero, as a command centre.
 *
 * Three ideas hold it together, and each replaced something that was not
 * working.
 *
 * The scene is lit, not decorated. Lighting runs full bleed while content
 * stays on the site's column, so the page reads as a product on a wide screen
 * without the artwork escaping into the margins and covering things.
 *
 * The console is a console. A form in a rounded rectangle is what every stats
 * site has; slicing two corners off the panel and running a lit hairline along
 * its top edge is a structural signature that costs one clip-path.
 *
 * The characters stand on something. An arena floor, concentric rings and a
 * spotlight give the renders a place to be, which is the whole difference
 * between a staged scene and three PNGs in a row.
 */

/**
 * The line-up, drawn back to front and sized as a share of the stage.
 *
 * Widths are deliberately modest: the tallest render is 22rem inside a 28rem
 * stage, leaving headroom above the group. A cast cropped by the header looks
 * like a mistake, and one filling every pixel looks like a banner.
 */
const CAST = [
  {
    id: 16000024,
    name: 'Crow',
    glow: '#8b6bff',
    className: 'left-0 bottom-[6%] w-[40%] opacity-80 z-10',
  },
  {
    id: 16000019,
    name: 'Spike',
    glow: '#35d0ff',
    className: 'right-[1%] bottom-[7%] w-[42%] opacity-85 z-20',
  },
  {
    id: 16000000,
    name: 'Shelly',
    glow: '#ffc53d',
    className: 'left-[20%] bottom-[3%] w-[56%] z-30',
  },
];

export function HomeHero({ stats }: { stats?: ReactNode }) {
  return (
    /*
      `w-screen` centred on the page escapes `main`'s column. Safe because the
      body clips horizontal overflow — see `globals.css`.
    */
    <section className="relative left-1/2 -mt-8 w-screen -translate-x-1/2">
      {/* ------------------------------ the scene --------------------------- */}
      <div className="relative overflow-hidden">
        <Backdrop />

        <div className="mx-auto w-full max-w-6xl px-4 pb-9 pt-8 sm:px-6 sm:pb-10 sm:pt-10 lg:px-8">
          {/*
            Order matters more than columns here. On a phone the console has to
            come before the artwork, so the stage is a later sibling that the
            desktop grid pulls up beside the copy.
          */}
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:gap-10">
            <div className="reveal-now min-w-0">
              <Eyebrow />

              {/*
                Three lines, and only the last one gold.
                
                Both halves used to be a clipped gradient, which needs
                `text-transparent` — so `display-hero`'s black drop shadow was
                painted straight through the glyphs and the line rendered
                brown. Solid colour, same shadow, and the highlight now falls
                on the four words that carry the promise.
              */}
              <h1 className="display-hero mt-5 text-[1.875rem] uppercase leading-[0.92] sm:text-[2.5rem] lg:text-[3.25rem]">
                Brawl Stars
                <br />
                stats that show
                <br />
                <span className="text-brand">where you stand</span>
              </h1>

              <p className="mt-3.5 max-w-md leading-relaxed text-muted">
                Search any player or club. See skill score, roster gaps, progression
                and live meta context in seconds.
              </p>

              <Console />
            </div>

            {/* The stage. Hidden below `lg`, where a three-figure group in a
                narrow column becomes three slivers. */}
            <div className="relative hidden h-[27rem] lg:block">
              <Stage />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------- the rail --------------------------- */}
      {/*
        Its own block, outside the scene. That is what guarantees the cast can
        never reach it: there is no shared positioning context for `bottom-0`
        to resolve against. The rule and ground run the full width; the numbers
        stay on the content column so they line up with every section below.
      */}
      {stats ? (
        <div className="relative border-y border-border/60 bg-background/55 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">{stats}</div>
          {/* The handover: the rail's edge dissolves into the page instead of
              stopping on a hard line. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-full h-16 bg-gradient-to-b from-background/70 to-transparent"
          />
        </div>
      ) : null}
    </section>
  );
}

/** The live-data marker, built into the composition rather than floated on it. */
function Eyebrow() {
  return (
    <p className="flex items-center gap-2.5">
      <span aria-hidden className="rule h-4" />
      <span className="live-dot" />
      <span className="eyebrow text-brand">Live Brawl Stars data</span>
    </p>
  );
}

/**
 * The lookup console.
 *
 * Two stacked clipped surfaces: the outer one is the edge colour, the inner
 * one sits a pixel inside it, and that difference reads as a hairline that
 * follows the cut corners exactly. A `border` cannot do this — it follows the
 * box, so the diagonal would go unpainted.
 */
function Console() {
  return (
    <div className="relative mt-6 max-w-xl">
      {/* Warm bloom behind the panel, as a sibling so it can spill past the
          clip instead of being cut by it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-8 -bottom-8 -top-5 -z-10 rounded-[2.5rem] opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(58% 58% at 26% 0%, color-mix(in srgb, #ffc53d 24%, transparent), transparent 72%)',
        }}
      />

      <div className="clip-console bg-border-strong/70 p-px shadow-[0_28px_60px_-28px_rgb(0_0_0/0.95)]">
        <div className="clip-console relative bg-surface p-4 sm:p-5">
          {/* Inner top light, so the panel reads as lit from above. */}
          <span
            aria-hidden
            className="console-edge pointer-events-none absolute inset-x-0 top-0 h-px"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/[0.04] to-transparent"
          />

          <SearchBar
            autoFocus
            showRecent
            size="hero"
            footer={
              /*
                Secondary to the search and to the recent row below it, so it
                is a line of text rather than a button — but it opens a real
                profile rather than a mock-up, which is the only way to show
                what a lookup returns without inventing numbers.
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
  );
}

/**
 * The character stage: an arena floor, a spotlight, and the cast standing on
 * it, with one real readout pinned clear of every face.
 */
function Stage() {
  return (
    <>
      {/* Spotlight from above, narrowing toward the floor. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[8%] -top-6 bottom-[16%] opacity-70"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 0%, color-mix(in srgb, #ffffff 9%, transparent), transparent 70%)',
        }}
      />

      {/* Arena floor: concentric ellipses, brightest at the group's feet. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[4%] bottom-[8%] h-24 rounded-[50%] border border-accent/25"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[16%] bottom-[11%] h-16 rounded-[50%] border border-accent/20"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[10%] bottom-[9%] h-20 rounded-[50%] opacity-70 blur-2xl"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in srgb, #8b6bff 75%, transparent), transparent)',
        }}
      />
      {/* Contact shadow, tight and dark, so the group is planted. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[22%] bottom-[9%] h-6 rounded-[50%] bg-black/60 blur-md"
      />

      {CAST.map((brawler) => (
        <div key={brawler.id} className={`absolute ${brawler.className}`}>
          <span
            aria-hidden
            className="absolute inset-x-[12%] bottom-[10%] top-[18%] rounded-full opacity-30 blur-3xl"
            style={{ background: brawler.glow }}
          />
          <Image
            src={brawlerModelUrl(brawler.id)}
            alt=""
            width={460}
            height={670}
            /*
             * Decorative and desktop-only. Left lazy on purpose: a phone never
             * paints this column, so it should never pay for it.
             */
            loading="lazy"
            fetchPriority="low"
            unoptimized
            className="relative h-auto w-full select-none object-contain drop-shadow-[0_22px_34px_rgba(0,0,0,0.7)]"
          />
        </div>
      ))}

      {/* Real product evidence, pinned top-left — clear of every face, and
          streamed so the search never waits on a database. */}
      <div className="pointer-events-none absolute -left-6 top-2 z-40">
        <Suspense fallback={null}>
          <HomeHeroInsight />
        </Suspense>
      </div>
    </>
  );
}

/** Full-bleed lighting and geometry, behind everything. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div
        className="absolute inset-0"
        style={{
          background:
            /*
             * Three lights and a fade: a purple key over the copy, a warm rim
             * under the headline so the gold has something to sit on, a cool
             * spot behind the stage, and a linear stop so the scene ends
             * without a seam where it meets the rail.
             */
            'radial-gradient(50rem 26rem at 18% 22%, color-mix(in srgb, #8b6bff 36%, transparent), transparent 66%),' +
            'radial-gradient(26rem 13rem at 15% 48%, color-mix(in srgb, #ffc53d 13%, transparent), transparent 70%),' +
            'radial-gradient(34rem 30rem at 78% 34%, color-mix(in srgb, #35d0ff 14%, transparent), transparent 68%),' +
            'linear-gradient(180deg, transparent 62%, var(--background) 99%)',
        }}
      />

      {/*
        Arena geometry: a square grid faded to the middle, plus two slow
        diagonals that run from the copy toward the stage and tie the two
        halves together. Dropped on phones, where it is invisible and only
        costs paint.
      */}
      <div
        className="absolute inset-0 hidden opacity-[0.22] sm:block"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in srgb, #ffffff 5%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, #ffffff 5%, transparent) 1px, transparent 1px)',
          backgroundSize: '76px 76px',
          maskImage: 'radial-gradient(42rem 24rem at 44% 34%, #000 10%, transparent 74%)',
          WebkitMaskImage:
            'radial-gradient(42rem 24rem at 44% 34%, #000 10%, transparent 74%)',
        }}
      />
      <div
        className="absolute inset-0 hidden opacity-[0.5] lg:block"
        style={{
          background:
            'linear-gradient(104deg, transparent 46%, color-mix(in srgb, var(--brand) 10%, transparent) 46.15%, transparent 46.3%),' +
            'linear-gradient(104deg, transparent 58%, color-mix(in srgb, var(--accent) 12%, transparent) 58.15%, transparent 58.3%)',
          maskImage: 'linear-gradient(90deg, transparent, #000 40%, transparent 92%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 40%, transparent 92%)',
        }}
      />

      {/* Vignette, so the text always has ground under it. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(0 0 0 / 0.45) 100%)',
        }}
      />
    </div>
  );
}
