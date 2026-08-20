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
    <section className="relative pt-2 sm:pt-4 lg:pt-6">
      {/* Full-bleed wash, escaping the page container and fading into the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[46rem] w-screen -translate-x-1/2 -translate-y-32 overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(48rem 24rem at 32% 32%, color-mix(in srgb, #8b6bff 30%, transparent), transparent 66%), radial-gradient(36rem 20rem at 78% 22%, color-mix(in srgb, #ffc53d 16%, transparent), transparent 68%), linear-gradient(180deg, transparent 55%, var(--background) 94%)',
          }}
        />
        {/*
          A faint square grid, faded out towards the edges. It gives the glow
          something to sit on so the top of the page does not read as an empty
          gradient, and it costs nothing: two repeating gradients, no image.
        */}
        <div
          className="absolute inset-0 opacity-[0.28]"
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
      <div className="relative grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,25rem)]">
        {/* Copy + search */}
        <div className="reveal-now">
          <span className="inline-flex items-center gap-2 rounded-full border border-border-strong/70 bg-surface/80 px-3.5 py-1.5 backdrop-blur">
            <span className="live-dot" />
            <span className="eyebrow text-brand">Live Brawl Stars data</span>
          </span>

          <h1 className="display-hero mt-5 text-balance text-[2.5rem] uppercase leading-[0.94] sm:text-5xl md:text-[2.75rem] lg:text-[3.5rem] xl:text-6xl">
            Brawl Stars stats that
            <br />
            <span className="bg-gradient-to-b from-brand via-brand to-brand-strong bg-clip-text text-transparent">
              show where you stand
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-balance leading-relaxed text-muted">
            One tag gives you a skill score out of 10, your roster read against the
            live meta, and your progression tracked over time.
          </p>

          {/*
            The search panel is raised off the hero rather than sunk into it, so
            it reads as the one thing on the page you are meant to touch first.
          */}
          <div className="card card-glow mt-7 border-border-strong/60 p-4 sm:p-6">
            <SearchBar autoFocus showRecent size="hero" />

            {/*
              For the visitor who has not got a tag to hand. It opens a real
              profile rather than a mock-up, which is the only way to show what
              a lookup returns without inventing numbers for it.
            */}
            <p className="mt-4 border-t border-border pt-3.5 text-sm text-muted">
              Haven&rsquo;t got a tag handy?{' '}
              <Link
                href={`/player/${SAMPLE_PLAYER_TAG}`}
                className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
              >
                Try a sample profile
                <ArrowUpRight className="size-3.5" />
              </Link>
            </p>
          </div>
        </div>

        {/* Character art */}
        <div
          aria-hidden
          className="relative mx-auto hidden h-[21rem] w-full max-w-md md:block lg:h-[26rem] xl:h-[30rem]"
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

      {stats ? <div className="mt-10 sm:mt-12">{stats}</div> : null}
    </section>
  );
}
