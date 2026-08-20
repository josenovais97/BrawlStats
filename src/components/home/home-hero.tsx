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
 * Deliberately asymmetric: copy and search on the left, character art on the
 * right. A centred headline over a centred search box is the default shape of
 * every SaaS template, and it is what made this read as generic.
 *
 * The art uses the full-body character renders rather than the square portrait
 * tiles. The tiles carry their own rarity-coloured background, so overlapping
 * them just produced a pile of rotated rectangles; the renders are cut out and
 * can stand on the page as a group.
 */

/** A line-up standing on the hero's baseline, drawn back to front. */
const CAST = [
  {
    id: 16000024,
    name: 'Crow',
    glow: '#8b6bff',
    className: 'left-0 bottom-0 w-[38%] opacity-80 z-10',
  },
  {
    id: 16000019,
    name: 'Spike',
    glow: '#35d07f',
    className: 'right-0 bottom-[3%] w-[40%] opacity-90 z-20',
  },
  {
    id: 16000000,
    name: 'Shelly',
    glow: '#ffc53d',
    className: 'left-[24%] bottom-0 w-[50%] z-30',
  },
];

export function HomeHero({ stats }: { stats?: ReactNode }) {
  return (
    <section className="relative -mt-2 sm:mt-0">
      {/* Full-bleed wash, escaping the page container and fading into the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[34rem] w-screen -translate-x-1/2 -translate-y-28 overflow-hidden sm:h-[46rem] sm:-translate-y-32"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              /*
               * Three lights rather than two: a purple key behind the copy, a
               * warm rim just under the headline so the gold has something to
               * sit on, and a cool spotlight over the cast. The linear stop at
               * the end is what stops the wash becoming a visible band where
               * it meets the page.
               */
              'radial-gradient(46rem 22rem at 26% 26%, color-mix(in srgb, #8b6bff 34%, transparent), transparent 64%),' +
              'radial-gradient(26rem 12rem at 22% 46%, color-mix(in srgb, #ffc53d 14%, transparent), transparent 70%),' +
              'radial-gradient(30rem 26rem at 76% 30%, color-mix(in srgb, #35d0ff 12%, transparent), transparent 66%),' +
              'linear-gradient(180deg, transparent 52%, var(--background) 94%)',
          }}
        />
        {/*
          A faint square grid, faded out towards the edges. It gives the glow
          something to sit on so the top of the page does not read as an empty
          gradient, and it costs nothing: two repeating gradients, no image.
        */}
        <div
          className="absolute inset-0 hidden opacity-[0.28] sm:block"
          style={{
            backgroundImage:
              'linear-gradient(to right, color-mix(in srgb, #ffffff 5%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, #ffffff 5%, transparent) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage:
              'radial-gradient(38rem 22rem at 50% 34%, #000 20%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(38rem 22rem at 50% 34%, #000 20%, transparent 78%)',
          }}
        />
      </div>

      {/*
        The art column comes in at `md`. Held back to `lg` it left tablets
        staring at half an empty hero, which is the widest gap on the page.
      */}
      <div className="relative grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] md:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
        {/* Copy + search */}
        <div className="reveal-now">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-strong/70 bg-surface/80 px-3.5 py-1.5 backdrop-blur">
            <span className="live-dot" />
            <span className="eyebrow text-brand">Live Brawl Stars data</span>
          </span>

          {/*
            Two lines, not four.
            
            At 60px in a half-width column this ran to four lines and became
            the whole hero, pushing the search card and the proof strip off a
            laptop screen. The break is forced so the gold half is always its
            own line rather than wherever the wrap happens to fall.
          */}
          <h1 className="display-hero mt-4 text-[2.25rem] uppercase leading-[0.95] sm:text-[2.5rem] md:text-[2rem] lg:text-[2.875rem]">
            Brawl Stars stats that
            <br />
            {/*
              Solid gold, not a clipped gradient.
              
              `display-hero` carries the game's own drop shadow, and a gradient
              needs `text-transparent` to show through — which means that black
              shadow was being painted *through* the glyphs. The white line
              rendered crisp and the gold line rendered brown, and no amount of
              tuning the gradient stops could fix it because the gradient was
              never the problem.
              
              Both lines now take the same chunky in-game lettering.
            */}
            <span className="text-brand">show where you stand</span>
          </h1>

          <p className="mt-3 max-w-lg leading-relaxed text-muted">
            One tag gives you a skill score out of 10, your roster read against the
            live meta, and your progression tracked over time.
          </p>

          {/*
            The one thing on the page you are meant to touch, lit like it.
            
            A gold hairline along the top edge and a warm bloom behind the
            panel: the game's own panels are lit from above, and without it
            this was a grey rectangle sitting on a dark page. The glow is a
            sibling rather than a box-shadow so it can spill past the card's
            rounded corners without being clipped by them.
          */}
          <div className="relative mt-5">
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-x-6 -bottom-6 -top-4 -z-10 rounded-[2rem] opacity-70 blur-2xl"
              style={{
                background:
                  'radial-gradient(60% 60% at 30% 0%, color-mix(in srgb, #ffc53d 22%, transparent), transparent 70%)',
              }}
            />
            <div className="card card-glow overflow-hidden border-border-strong/60 p-4 sm:p-5">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, color-mix(in srgb, var(--brand) 70%, transparent) 30%, color-mix(in srgb, var(--brand) 45%, transparent) 70%, transparent)',
                }}
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
                  what a lookup returns without inventing numbers for it.
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

        {/* Character art */}
        <div
          aria-hidden
          className="relative mx-auto hidden h-[20rem] w-full max-w-md md:block lg:h-[25rem] xl:h-[28rem]"
        >
          {/* Ground glow, so the group reads as standing rather than floating. */}
          <span
            className="absolute inset-x-4 bottom-2 h-16 rounded-[50%] opacity-50 blur-2xl"
            style={{
              background:
                'radial-gradient(closest-side, #8b6bff, color-mix(in srgb, #8b6bff 20%, transparent), transparent)',
            }}
          />

          {CAST.map((brawler) => (
            <div key={brawler.id} className={`absolute ${brawler.className}`}>
              <span
                className="absolute inset-x-[10%] bottom-[8%] top-[18%] rounded-full opacity-30 blur-3xl"
                style={{ background: brawler.glow }}
              />
              <Image
                src={brawlerModelUrl(brawler.id)}
                alt=""
                width={420}
                height={620}
                className="relative h-auto w-full select-none object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.65)]"
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
      </div>

      {stats ? <div className="mt-6 sm:mt-7">{stats}</div> : null}
    </section>
  );
}
