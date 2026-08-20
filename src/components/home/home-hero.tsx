import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { SearchBar } from '@/components/search-bar';
import { brawlerModelUrl } from '@/lib/brawlapi';
import { getTopMetaBrawlers } from '@/lib/home-meta';
import { SAMPLE_PLAYER_TAG } from '@/lib/site';
import { brawlerPath } from '@/lib/slugs';
import { TIER_COLOR } from '@/lib/tiers';

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
 * The stand-in cast, used only when the meta is unreadable.
 *
 * Three brawlers with strong silhouettes, and no ranks or tiers attached —
 * without data there is nothing to rank, and a podium with invented numbers on
 * it would be worse than a podium with none.
 *
 * The ids the hardcoded version used were mislabelled: the array said Crow and
 * Spike while pointing at 16000024 and 16000019, which are neither.
 */
const FALLBACK_CAST = [
  { id: 16000011, name: 'Mortis' },
  { id: 16000023, name: 'Leon' },
  { id: 16000043, name: 'Edgar' },
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
                narrow column becomes three slivers.
                
                Streamed: it reads the meta to decide who is standing on it, and
                the search must never wait on a database. The column keeps its
                height either way, so nothing shifts when the cast arrives. */}
            <div className="relative hidden h-[27rem] lg:block">
              <Suspense fallback={null}>
                <Stage />
              </Suspense>
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
 * The character stage: the current top three in Ranked, standing on a podium.
 *
 * This is the idea the hero is built on. Every other Brawl Stars site puts
 * whichever brawlers the designer liked into its header and leaves them there
 * for a year. These three are the actual top of our Ranked list, read from the
 * same cached ranking the tools preview, the meta snapshot and the split
 * section all use — so the artwork changes when the meta changes, and the
 * headline's promise is demonstrated by the picture rather than described by
 * it.
 *
 * The podium arrangement is the real one: second on the left, first on the
 * raised centre, third on the right. Each step's lip and each figure's rim
 * light take that brawler's live tier colour, so the lighting is data too.
 *
 * Zero upstream cost: the query is already made three times further down the
 * page and `cache` collapses them into one.
 */
async function Stage() {
  const top = await getTopMetaBrawlers(3).catch(() => []);
  const ranked = top.length === 3;

  /*
   * Podium order, not list order: 2 — 1 — 3. Without live data the same three
   * slots carry the stand-in cast, with no numerals and no caption, because
   * there is no ranking to claim.
   */
  const slots = ranked
    ? [
        { ...top[1], rank: 2 },
        { ...top[0], rank: 1 },
        { ...top[2], rank: 3 },
      ]
    : FALLBACK_CAST.map((b) => ({
        brawlerId: b.id,
        name: b.name,
        tier: null,
        rank: null,
      }));

  const [left, centre, right] = slots;

  return (
    <>
      {/* Spotlight from above, narrowing toward the podium. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[8%] -top-6 bottom-[16%] opacity-70"
        style={{
          background:
            'radial-gradient(60% 80% at 50% 0%, color-mix(in srgb, #ffffff 9%, transparent), transparent 70%)',
        }}
      />

      {/* Floor bloom under the whole stand. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[6%] bottom-[3%] h-16 rounded-[50%] opacity-60 blur-2xl"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in srgb, #8b6bff 80%, transparent), transparent)',
        }}
      />

      <Plinth className="bottom-[6%] left-0 h-14 w-[34%]" rank={left.rank} tier={left.tier} />
      <Plinth
        className="bottom-[6%] left-[28%] h-20 w-[44%]"
        rank={centre.rank}
        tier={centre.tier}
        centre
      />
      <Plinth className="bottom-[6%] right-0 h-14 w-[34%]" rank={right.rank} tier={right.tier} />

      {/* Contact shadows, one per step, so each figure is planted on the
          surface it is standing on rather than on the stage floor. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[18%] left-[4%] z-10 h-3 w-[26%] rounded-[50%] bg-black/55 blur-[6px]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[18%] right-[4%] z-10 h-3 w-[26%] rounded-[50%] bg-black/55 blur-[6px]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[23%] left-[33%] z-10 h-3.5 w-[34%] rounded-[50%] bg-black/60 blur-[6px]"
      />

      <Figure slot={left} className="bottom-[18%] left-0 h-52 w-[34%] z-20" />
      <Figure slot={right} className="bottom-[18%] right-0 h-52 w-[34%] z-20" />
      <Figure slot={centre} className="bottom-[23%] left-[24%] h-76 w-[52%] z-30" />

      {/* The six words that explain the whole conceit. Anchored under the
          podium rather than floated beside it. */}
      {ranked ? (
        <p className="absolute inset-x-0 bottom-0 text-center text-xs font-semibold uppercase tracking-[0.16em] text-muted/80">
          Top 3 in Ranked right now
        </p>
      ) : null}
    </>
  );
}

/** Types the two shapes a podium slot can take: ranked, or a stand-in. */
interface Slot {
  brawlerId: number;
  name: string;
  tier: keyof typeof TIER_COLOR | null;
  rank: number | null;
}

/**
 * One figure on the podium.
 *
 * A fixed box with `object-contain object-bottom` rather than a width and an
 * automatic height: the renders are not a consistent aspect — some brawlers
 * are wide, some are tall — and anchoring the bottom edge is what keeps every
 * one of them standing on the step no matter which three the meta sends.
 */
function Figure({ slot, className }: { slot: Slot; className: string }) {
  const rim = slot.tier ? TIER_COLOR[slot.tier] : '#8b6bff';

  const art = (
    <>
      <span
        aria-hidden
        className="absolute inset-x-[12%] bottom-[10%] top-[18%] rounded-full opacity-30 blur-3xl"
        style={{ background: rim }}
      />
      <Image
        src={brawlerModelUrl(slot.brawlerId)}
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
        className="relative h-full w-full select-none object-contain object-bottom drop-shadow-[0_22px_34px_rgba(0,0,0,0.7)]"
      />
    </>
  );

  // Ranked figures are real rows and link like it; stand-ins are decoration.
  return slot.rank ? (
    <Link
      href={brawlerPath(slot.brawlerId, slot.name)}
      title={`${slot.name}: number ${slot.rank} in Ranked`}
      className={`absolute block ${className}`}
    >
      {art}
    </Link>
  ) : (
    <span aria-hidden className={`absolute block ${className}`}>
      {art}
    </span>
  );
}

/**
 * One step of the podium.
 *
 * Body, top face, lit lip, and the rank carved into the face. The top face is
 * an ellipse overlapping the body's top edge, which is the cheapest convincing
 * way to imply a viewing angle without a 3D transform — and unlike `rotateX`,
 * it costs no compositing layer and cannot blur the artwork standing on it.
 *
 * The lip takes the brawler's live tier colour, so an S-tier first place is lit
 * differently from a B-tier one. Without a tier it falls back to the brand
 * accent, and without a rank the step carries no numeral at all.
 */
function Plinth({
  className,
  centre = false,
  rank,
  tier,
}: {
  className: string;
  centre?: boolean;
  rank: number | null;
  tier: keyof typeof TIER_COLOR | null;
}) {
  const accent = tier ? TIER_COLOR[tier] : centre ? 'var(--brand)' : 'var(--accent)';

  return (
    <span aria-hidden className={`pointer-events-none absolute ${className}`}>
      {/* Body, darkening toward the floor. */}
      <span className="absolute inset-x-0 bottom-0 top-2 rounded-b-xl bg-gradient-to-b from-surface-3 via-surface-2 to-[#0a0d18] shadow-[0_18px_30px_-16px_rgb(0_0_0/0.9)]" />

      {/* Side walls, so the step has thickness rather than being a silhouette. */}
      <span className="absolute inset-y-2 left-0 w-px bg-white/[0.06]" />
      <span className="absolute inset-y-2 right-0 w-px bg-white/[0.06]" />

      {/* The lit lip where the top face meets the body. */}
      <span
        className="absolute inset-x-0 top-2 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${accent} 65%, transparent), transparent)`,
        }}
      />

      {/* Top face. */}
      <span className="absolute inset-x-0 top-0 h-4 rounded-[50%] bg-surface-3 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.09)]" />
      <span
        className="absolute inset-x-[12%] top-[0.35rem] h-2 rounded-[50%] opacity-70 blur-[3px]"
        style={{
          background: `radial-gradient(closest-side, color-mix(in srgb, ${accent} 30%, transparent), transparent)`,
        }}
      />

      {/* The rank, on the face of the step. */}
      {rank ? (
        <span
          className={`display absolute inset-x-0 bottom-0 top-4 grid place-items-center leading-none ${
            centre ? 'text-3xl' : 'text-xl'
          }`}
          style={{ color: `color-mix(in srgb, ${accent} 70%, var(--muted))` }}
        >
          {rank}
        </span>
      ) : null}
    </span>
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
