'use client';

import { Expand, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The map image on a ranked card, expandable to full size.
 *
 * A Brawl Stars map is a layout, not a picture: which walls are where is the
 * whole reason to look at it, and the card-sized thumbnail is too small to
 * read one off. So the thumbnail is a button, and the real map opens over the
 * page at whatever size the viewport allows.
 *
 * Built on native `<dialog>`, which brings focus trapping, the top layer and
 * Escape-to-close with it. Only `showModal()` and the backdrop click need
 * wiring, so this is the smallest amount of client JavaScript the interaction
 * can cost.
 */
export function MapPreview({
  imageUrl,
  mapName,
  modeLabel,
  accent,
}: {
  imageUrl?: string;
  mapName: string;
  modeLabel: string;
  accent: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // `showModal` has to run as an effect rather than in the click handler:
    // the dialog is only mounted once React has re-rendered with `open`.
    if (open && !dialog.open) dialog.showModal();
  }, [open]);

  if (!imageUrl) {
    return (
      <div className="grid h-44 w-full place-items-center bg-surface-2 text-xs text-muted">
        No map preview
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Expand the ${mapName} map layout`}
        className="group relative block h-44 w-full cursor-zoom-in overflow-hidden bg-surface-2 focus-visible:outline-offset-[-2px]"
      >
        {/* Maps are portrait and the card is landscape, so drawing one whole
            leaves two dead columns either side. The same image, blown up and
            blurred behind it, fills them with the map's own colours. The card
            picks up the environment's palette instead of a grey void. */}
        <Image
          src={imageUrl}
          alt=""
          aria-hidden
          fill
          sizes="24rem"
          className="scale-125 object-cover opacity-30 blur-xl saturate-150"
          loading="lazy"
          unoptimized
        />
        <Image
          src={imageUrl}
          alt={`${mapName} map layout`}
          fill
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 92vw"
          className="object-contain p-2 transition-transform duration-200 group-hover:scale-[1.04]"
          loading="lazy"
          unoptimized
        />
        <span
          aria-hidden
          className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg bg-background/70 text-muted opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Expand className="size-3.5" />
        </span>
      </button>

      {open ? (
        <dialog
          ref={dialogRef}
          onClose={() => setOpen(false)}
          // A click that lands on the dialog element itself is a click on the
          // backdrop: the content sits in a child box that stops propagation.
          onClick={close}
          className="m-auto max-h-[92dvh] w-[min(46rem,92vw)] rounded-2xl border border-border-strong bg-surface p-0 text-foreground backdrop:bg-background/80 backdrop:backdrop-blur-sm"
        >
          <div onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <p className="eyebrow" style={{ color: accent }}>
                  {modeLabel}
                </p>
                <h2 className="display mt-1.5 truncate text-xl">{mapName}</h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close map preview"
                className="row-interactive -mr-1 shrink-0 rounded-lg p-1.5 text-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <Image
              src={imageUrl}
              alt={`${mapName} map layout`}
              width={900}
              height={1400}
              sizes="(min-width: 640px) 46rem, 92vw"
              className="max-h-[74dvh] w-full object-contain p-4"
              unoptimized
            />
          </div>
        </dialog>
      ) : null}
    </>
  );
}
