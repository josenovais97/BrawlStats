import Image from 'next/image';

import { SearchBar } from '@/components/search-bar';
import { brawlerPortraitUrl } from '@/lib/brawlapi';

/**
 * Landing hero.
 *
 * Deliberately asymmetric: copy and search on the left, character art on the
 * right. A centred headline over a centred search box is the default shape of
 * every SaaS template, and it is what made this read as generic.
 *
 * The art is rendered at full strength with rarity-tinted glows rather than as
 * faded background texture — Brawl Stars is a loud, saturated game and washed
 * out portraits just look like a mistake.
 */

/** Overlapping cluster, drawn back-to-front. */
const CAST = [
  {
    id: 16000024,
    name: 'Crow',
    glow: '#8b6bff',
    className: 'left-[6%] top-[16%] w-[42%] rotate-[-10deg] z-10',
  },
  {
    id: 16000019,
    name: 'Spike',
    glow: '#35d07f',
    className: 'right-[4%] top-[6%] w-[44%] rotate-[8deg] z-20',
  },
  {
    id: 16000029,
    name: 'Leon',
    glow: '#35d0ff',
    className: 'left-[2%] bottom-[2%] w-[46%] rotate-[6deg] z-30',
  },
  {
    id: 16000000,
    name: 'Shelly',
    glow: '#ffc53d',
    className: 'right-[8%] bottom-[0%] w-[48%] rotate-[-6deg] z-40',
  },
];

export function HomeHero() {
  return (
    <section className="relative">
      {/* Full-bleed wash, escaping the page container and fading into the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[42rem] w-screen -translate-x-1/2 -translate-y-28"
        style={{
          background:
            'radial-gradient(48rem 24rem at 35% 30%, color-mix(in srgb, #8b6bff 30%, transparent), transparent 66%), radial-gradient(36rem 20rem at 75% 20%, color-mix(in srgb, #ffc53d 16%, transparent), transparent 68%), linear-gradient(180deg, transparent 55%, var(--background) 92%)',
        }}
      />

      <div className="relative grid items-center gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-8 lg:pt-10">
        {/* Copy + search */}
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-victory" />
            Live Brawl Stars data
          </span>

          <h1 className="display-hero mt-5 text-balance text-5xl uppercase leading-[0.92] sm:text-6xl xl:text-7xl">
            Know exactly
            <br />
            <span className="bg-gradient-to-b from-brand via-brand to-brand-strong bg-clip-text text-transparent">
              where you stand
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-balance text-lg leading-relaxed text-muted lg:mx-0">
            Trophies, world rankings, recent form and full progression — for any player
            or club, in one search.
          </p>

          <div className="mt-8">
            <div className="card card-glow border-border-strong/60 p-4 sm:p-5">
              <SearchBar autoFocus showRecent />
            </div>
          </div>
        </div>

        {/* Character art */}
        <div
          aria-hidden
          className="relative mx-auto hidden aspect-square w-full max-w-md lg:block"
        >
          {CAST.map((brawler) => (
            <div key={brawler.id} className={`absolute ${brawler.className}`}>
              <span
                className="absolute inset-[12%] rounded-full opacity-45 blur-2xl"
                style={{ background: brawler.glow }}
              />
              <Image
                src={brawlerPortraitUrl(brawler.id)}
                alt=""
                width={340}
                height={340}
                className="relative w-full select-none object-contain drop-shadow-[0_16px_28px_rgba(0,0,0,0.6)]"
                priority
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
