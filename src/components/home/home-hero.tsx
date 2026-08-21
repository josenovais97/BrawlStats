import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { SearchBar } from '@/components/search-bar';
import { brawlerModelUrl, brawlerPortraitUrl, hasBrawlerModel } from '@/lib/brawlapi';
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
                height either way, so nothing shifts when the cast arrives.
                
                `drift-fore` lifts it against the page as you scroll, on the
                compositor's scroll timeline rather than a scroll handler — the
                copy stays put, the cast rises, and the two columns stop reading
                as one flat picture. */}
            <div className="drift-fore relative hidden h-[27rem] lg:block">
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
 * raised centre, third on the right. Each step carries that brawler's name,
 * tier and rank, and each step's lip and each figure's rim light take the tier
 * colour, so the lighting is data too.
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
  const slots: Slot[] = ranked
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

  /*
   * The cast is chosen by the meta, so the stage cannot assume its art exists:
   * whoever is winning this week is exactly the brawler whose full-body render
   * the CDN has not published yet. Asking first is what stopped the third slot
   * rendering a broken-image box.
   *
   * Decided for the whole podium rather than per figure, and by the weakest
   * link. One framed portrait standing between two full bodies reads as a
   * failure; three framed portraits read as a deliberate treatment.
   */
  const available = await Promise.all(slots.map((s) => hasBrawlerModel(s.brawlerId)));
  const treatment: Treatment = available.every(Boolean) ? 'model' : 'portrait';

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

      {/* Three steps that meet exactly — 31 / 38 / 31 — so no edge is drawn
          over its neighbour and the podium reads as one object. */}
      <Plinth className="bottom-[8%] left-0 h-20 w-[31%]" slot={left} place="left" />
      <Plinth className="bottom-[8%] left-[31%] h-32 w-[38%]" slot={centre} place="centre" />
      <Plinth className="bottom-[8%] right-0 h-20 w-[31%]" slot={right} place="right" />

      {/* Contact shadows, one per step, so each figure is planted on the
          surface it is standing on rather than on the stage floor. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[26%] left-[2%] z-10 h-3 w-[27%] rounded-[50%] bg-black/55 blur-[6px]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[26%] right-[2%] z-10 h-3 w-[27%] rounded-[50%] bg-black/55 blur-[6px]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[37%] left-[33%] z-10 h-3.5 w-[34%] rounded-[50%] bg-black/60 blur-[6px]"
      />

      <Figure slot={left} treatment={treatment} className={`z-20 ${FIGURE[treatment].left}`} />
      <Figure slot={right} treatment={treatment} className={`z-20 ${FIGURE[treatment].right}`} />
      <Figure slot={centre} treatment={treatment} className={`z-30 ${FIGURE[treatment].centre}`} />

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
 * How the cast is drawn.
 *
 * `model` is the full-body render the stage is designed around. `portrait` is
 * the framed head shot, and exists because the render does not always: the CDN
 * ships `/model/` weeks after a release, and the two newest brawlers 404 today.
 * Falling back to the portrait keeps the *right* three on the podium, which
 * matters more than the pose — swapping in a fourth-place brawler with nicer
 * art would quietly make the caption a lie.
 */
type Treatment = 'model' | 'portrait';

/** Which step of the podium, which decides its scale and its outside edge. */
type Place = 'left' | 'centre' | 'right';

/**
 * Each treatment needs its own geometry, not a shared box.
 *
 * A render is a tall irregular silhouette standing on the step, so its box is
 * anchored at the step's surface and overlaps its neighbours to read as a
 * group. A disc has no feet: it hangs above its step, centred on it, and the
 * step's face stays clear underneath to carry the placing. Same podium, two
 * sets of numbers.
 */
const FIGURE: Record<Treatment, { left: string; centre: string; right: string }> = {
  model: {
    left: 'bottom-[26%] left-0 h-52 w-[36%]',
    centre: 'bottom-[37%] left-[24%] h-64 w-[52%]',
    right: 'bottom-[26%] right-0 h-52 w-[36%]',
  },
  /*
   * Every offset here clears the step below it. Sitting a disc down on the step
   * the way a render stands on it buries the face, and the rank, name and tier
   * go with it.
   */
  portrait: {
    left: 'bottom-[29%] left-[0.5%] size-[7.5rem]',
    centre: 'bottom-[40%] left-1/2 size-[10rem] -translate-x-1/2',
    right: 'bottom-[29%] right-[0.5%] size-[7.5rem]',
  },
};

/**
 * One figure on the podium.
 *
 * The render uses a fixed box with `object-contain object-bottom` rather than a
 * width and an automatic height: the renders are not a consistent aspect — some
 * brawlers are wide, some are tall — and anchoring the bottom edge is what keeps
 * every one of them standing on the step no matter which three the meta sends.
 *
 * The portrait is a 170px tile with an opaque background, so it cannot simply be
 * dropped in where a cut-out was; it is framed as a lit disc, rimmed in the
 * brawler's tier colour, which is a thing the stage can light rather than a
 * square photograph balanced on a step.
 */
function Figure({
  slot,
  treatment,
  className,
}: {
  slot: Slot;
  treatment: Treatment;
  className: string;
}) {
  const rim = slot.tier ? TIER_COLOR[slot.tier] : '#8b6bff';

  const art =
    treatment === 'model' ? (
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
    ) : (
      <>
        <span
          aria-hidden
          className="absolute inset-[-16%] rounded-full opacity-45 blur-2xl"
          style={{ background: rim }}
        />
        <span
          className="relative block h-full w-full overflow-hidden rounded-full"
          style={{
            /*
             * Three rings, outside in: a dark separator so overlapping discs
             * do not melt into each other, the tier colour, and the drop.
             */
            boxShadow: `0 0 0 3px #070a12, inset 0 0 0 2px color-mix(in srgb, ${rim} 85%, transparent), 0 20px 34px -14px rgb(0 0 0 / 0.9)`,
          }}
        >
          <Image
            src={brawlerPortraitUrl(slot.brawlerId)}
            alt=""
            width={170}
            height={170}
            loading="lazy"
            fetchPriority="low"
            unoptimized
            className="h-full w-full select-none object-cover"
          />
          {/* Lit from above and grounded at the bottom, like everything else
              standing on this stage. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/15 via-transparent to-black/25"
          />
        </span>
      </>
    );

  // Ranked figures are real rows and link like it; stand-ins are decoration.
  return slot.rank ? (
    <Link
      href={brawlerPath(slot.brawlerId, slot.name)}
      title={`${slot.name}: number ${slot.rank} in Ranked${slot.tier ? `, tier ${slot.tier}` : ''}`}
      className={`absolute block transition-transform duration-300 hover:-translate-y-1.5 ${className}`}
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
 * Body, top face, lit lip, and the brawler's placing carved into the face. The
 * top face is an ellipse overlapping the body's top edge, which is the cheapest
 * convincing way to imply a viewing angle without a 3D transform — and unlike
 * `rotateX`, it costs no compositing layer and cannot blur the artwork standing
 * on it.
 *
 * The face carries the rank, the name and the tier letter, because a podium
 * that shows three unnamed characters is decoration and a podium that names
 * them is the tier list in miniature. The lip takes the live tier colour, so an
 * S-tier first place is lit differently from a B-tier one — and the letter
 * beside the name is what stops that colour being a private code. Without a
 * rank the step carries nothing at all.
 *
 * Hidden from assistive tech as a whole: every fact on it is already the
 * accessible name of the figure standing above it.
 */
function Plinth({ className, place, slot }: { className: string; place: Place; slot: Slot }) {
  const centre = place === 'centre';
  const accent = slot.tier ? TIER_COLOR[slot.tier] : centre ? 'var(--brand)' : 'var(--accent)';

  /*
   * Only the outside of the podium is rounded. Rounding every step put a notch
   * at each junction where two corners curved away from each other, which read
   * as three blocks pushed together rather than one stand.
   */
  const round =
    place === 'left' ? 'rounded-bl-xl' : place === 'right' ? 'rounded-br-xl' : '';

  return (
    <span aria-hidden className={`pointer-events-none absolute ${className}`}>
      {/* Body, darkening toward the floor. */}
      <span
        className={`absolute inset-x-0 bottom-0 top-2 bg-gradient-to-b from-surface-3 via-surface-2 to-[#0a0d18] shadow-[0_18px_30px_-16px_rgb(0_0_0/0.9)] ${round}`}
      />

      {/* The first step is the tallest, which stretches the same gradient over
          half again the height and leaves it reading darker than the steps
          beside it. A sheen puts the light back where the eye expects it. */}
      {centre ? (
        <span className="absolute inset-x-0 bottom-0 top-2 bg-gradient-to-b from-white/[0.055] to-transparent" />
      ) : null}

      {/* Walls, so the stand has thickness rather than being a silhouette —
          drawn only where a wall is actually exposed. Two steps that meet do
          not each need an edge; the centre keeps both because it stands proud
          of the steps beside it. */}
      {place !== 'right' ? (
        <span className="absolute inset-y-2 left-0 w-px bg-white/[0.06]" />
      ) : null}
      {place !== 'left' ? (
        <span className="absolute inset-y-2 right-0 w-px bg-white/[0.06]" />
      ) : null}

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

      {/* The placing, on the face of the step. */}
      {slot.rank ? (
        <span className="absolute inset-x-0 bottom-1.5 top-5 flex flex-col items-center justify-center gap-1">
          <span
            className={`display leading-none ${centre ? 'text-3xl' : 'text-2xl'}`}
            style={{
              color: accent,
              textShadow: `0 2px 16px color-mix(in srgb, ${accent} 45%, transparent)`,
            }}
          >
            {slot.rank}
          </span>
          <span className="flex max-w-full items-baseline gap-1 px-1.5 text-[0.55rem] font-semibold uppercase leading-none tracking-[0.12em] text-muted">
            <span className="min-w-0 truncate">{slot.name}</span>
            {slot.tier ? (
              <span className="shrink-0" style={{ color: accent }}>
                {slot.tier}
              </span>
            ) : null}
          </span>
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
