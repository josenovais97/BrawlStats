import Image from 'next/image';

/**
 * A map thumbnail that fills its frame.
 *
 * Brawl Stars maps are tall portraits and every card that holds one is
 * landscape, so `object-contain` draws the layout small and leaves two dead
 * columns of surface either side — a grid of map cards then reads as a grid of
 * empty rectangles with a stamp in the middle of each.
 *
 * The fix is the one the expandable preview on the Ranked page already uses:
 * the same image blown up, blurred and *saturated* behind the real one, so the
 * dead columns fill with the map's own colours. The card takes the palette of
 * the environment it is showing, and the layout stays legible because the
 * foreground copy is still drawn whole.
 *
 * Two images of the same URL is one network request — the second is served
 * from the memory cache — so this costs a paint, not a fetch.
 */
export function MapArt({
  src,
  alt,
  height = 'h-24',
  sizes,
  className = '',
}: {
  src?: string | null;
  /** Empty when the surrounding link already names the map. */
  alt: string;
  /** Tailwind height class for the frame. */
  height?: string;
  sizes: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`grid w-full place-items-center bg-surface-2 text-xs text-muted ${height} ${className}`}
      >
        No preview
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden bg-surface-2 ${height} ${className}`}>
      {/*
        The backdrop is carried at real strength. At 30% opacity it read as
        grey haze rather than colour — present, but too weak to be the map's
        palette — which is what made a grid of these look unfinished. Pushing
        the blur further keeps it a field of colour that never competes with
        the layout drawn on top.
      */}
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        className="scale-150 object-cover opacity-70 blur-2xl saturate-[1.6]"
        loading="lazy"
        unoptimized
      />

      {/* A vignette, so the bright centre does not run into the frame's edges
          and the layout reads as lit from behind rather than pasted on. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(8,11,22,0.55)_100%)]"
      />

      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-contain p-2 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-[1.05]"
        loading="lazy"
        unoptimized
      />
    </div>
  );
}
