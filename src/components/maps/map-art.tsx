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
 * the same image blown up, blurred and desaturated behind the real one, so the
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
        className={`grid w-full place-items-center bg-surface-2 text-[0.625rem] text-muted ${height} ${className}`}
      >
        No preview
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden bg-surface-2 ${height} ${className}`}>
      <Image
        src={src}
        alt=""
        aria-hidden
        fill
        sizes={sizes}
        className="scale-125 object-cover opacity-30 blur-xl saturate-150"
        loading="lazy"
        unoptimized
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-[1.05]"
        loading="lazy"
        unoptimized
      />
    </div>
  );
}
