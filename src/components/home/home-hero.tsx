import Image from 'next/image';

import { SearchBar } from '@/components/search-bar';
import { brawlerPortraitUrl } from '@/lib/brawlapi';

/**
 * Landing hero.
 *
 * The background bleeds edge to edge behind the header rather than sitting in
 * a bounded panel — a hard-edged rectangle floating on the page was the main
 * thing making this read as a template.
 *
 * Brawler art does the heavy lifting: a game site with no characters on it
 * feels empty no matter how the type is set. The portraits are decorative, so
 * they are masked, dimmed and hidden on small screens where they would crowd
 * the search box.
 */

/** Recognisable faces, arranged left-to-right across the hero. */
const CAST = [
  { id: 16000000, name: 'Shelly', className: 'left-[2%] w-40 rotate-[-8deg] xl:w-52' },
  { id: 16000029, name: 'Leon', className: 'left-[15%] w-36 rotate-[6deg] xl:w-44' },
  { id: 16000019, name: 'Spike', className: 'right-[15%] w-36 rotate-[-6deg] xl:w-44' },
  { id: 16000024, name: 'Crow', className: 'right-[2%] w-40 rotate-[9deg] xl:w-52' },
];

export function HomeHero() {
  return (
    <section className="relative">
      {/* Full-bleed background, escaping the page container. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[46rem] w-screen -translate-x-1/2 -translate-y-24 overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(52rem 26rem at 50% 18%, color-mix(in srgb, #8b6bff 26%, transparent), transparent 68%), radial-gradient(40rem 22rem at 15% 8%, color-mix(in srgb, #ffc53d 14%, transparent), transparent 70%), radial-gradient(40rem 22rem at 85% 8%, color-mix(in srgb, #35d0ff 12%, transparent), transparent 70%)',
          }}
        />

        {/* Brawler cast, faded into the background. */}
        <div className="absolute inset-x-0 top-28 hidden lg:block">
          {CAST.map((brawler) => (
            <Image
              key={brawler.id}
              src={brawlerPortraitUrl(brawler.id)}
              alt=""
              width={280}
              height={280}
              className={`absolute select-none object-contain opacity-[0.45] drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)] ${brawler.className}`}
              unoptimized
            />
          ))}
        </div>

        {/* Fade the art out into the page so there is no visible seam. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, transparent 40%, var(--background) 88%)',
          }}
        />
      </div>

      <div className="relative flex flex-col items-center pt-10 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand backdrop-blur">
          <span className="size-1.5 animate-pulse rounded-full bg-victory" />
          Live Brawl Stars data
        </span>

        <h1 className="display-hero mt-6 max-w-4xl text-balance text-5xl uppercase leading-[0.95] sm:text-7xl lg:text-8xl">
          Know exactly
          <br />
          <span className="bg-gradient-to-b from-brand to-brand-strong bg-clip-text text-transparent drop-shadow-none">
            where you stand
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-balance text-lg leading-relaxed text-muted">
          Trophies, world rankings, recent form and full progression — for any player
          or club, in one search.
        </p>

        <div className="mt-9 w-full max-w-2xl">
          <div className="card card-glow border-border-strong/60 p-4 sm:p-5">
            <SearchBar autoFocus showRecent />
          </div>
        </div>
      </div>
    </section>
  );
}
