"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Shows people where their tag actually is.
 *
 * The written hint alone kept sending people to the wrong place: the tag is
 * under the profile *icon*, not under the name, and the name appears twice on
 * that screen. A picture settles it in a second.
 *
 * Drawn rather than screenshotted. A real capture would be Supercell's
 * artwork, would carry a real player's tag, and would go stale with every UI
 * refresh; a schematic in this site's own tokens stays legible in both themes,
 * scales without blurring, costs no image request, and shows a tag that
 * obviously belongs to nobody.
 */
export function TagLocationHint({
  kind = "player",
}: {
  kind?: "player" | "club";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // Native <dialog> gives focus trapping, inertness and Escape for free, but
  // only via showModal() -- the `open` attribute alone gives none of it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClick = (event: MouseEvent) => {
      // The backdrop is the dialog element itself; clicks on children bubble
      // with a different target, so this closes on backdrop only.
      if (event.target === el) el.close();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  const isClub = kind === "club";

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded font-semibold text-brand underline decoration-brand/40 underline-offset-2 transition-colors hover:decoration-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Where do I find it?
      </button>

      <dialog
        ref={ref}
        aria-labelledby="tag-hint-title"
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 id="tag-hint-title" className="display text-lg uppercase">
              {isClub ? "Finding a club tag" : "Finding your tag"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isClub
                ? "Open the club screen. The tag sits under the club name."
                : "Tap your profile icon in the top-left of the game. The tag is directly underneath it."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="shrink-0 rounded-lg border border-border p-1.5 text-muted transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5">
          <ProfileDiagram isClub={isClub} />

          <p className="mt-4 text-sm leading-relaxed text-muted">
            It always begins with{" "}
            <span className="font-mono font-semibold text-foreground">#</span>.
            You can type it with or without the{" "}
            <span className="font-mono">#</span>, and case does not matter.
          </p>
        </div>
      </dialog>
    </>
  );
}

/**
 * A schematic of the profile header, not a copy of it.
 *
 * Deliberately abstract: rounded blocks where the artwork sits, a real-looking
 * but invented tag, and one ring drawing the eye to the only part that
 * matters. Colours come from the site's tokens via `currentColor` and explicit
 * classes, so it reads correctly in both themes.
 */
function ProfileDiagram({ isClub }: { isClub: boolean }) {
  return (
    <svg
      viewBox="0 0 340 168"
      role="img"
      aria-label={
        isClub
          ? "Diagram of the club screen with the club tag highlighted beneath the club name"
          : "Diagram of the game profile screen with the player tag highlighted beneath the profile icon"
      }
      className="w-full rounded-xl border border-border bg-surface-2"
    >
      {/* Background panel */}
      <rect
        x="0"
        y="0"
        width="340"
        height="168"
        rx="12"
        className="fill-surface-2"
      />

      {/* Profile icon block */}
      <rect
        x="20"
        y="18"
        width="64"
        height="64"
        rx="12"
        className="fill-brand/20 stroke-brand/40"
        strokeWidth="2"
      />
      <circle cx="52" cy="44" r="13" className="fill-brand/50" />
      <path d="M32 72c4-11 36-11 40 0z" className="fill-brand/50" />

      {/* Name field */}
      <rect
        x="98"
        y="20"
        width="164"
        height="28"
        rx="8"
        className="fill-border/60"
      />
      <rect
        x="110"
        y="30"
        width="86"
        height="8"
        rx="4"
        className="fill-muted/50"
      />

      {/* Secondary field, the one people mistake for the tag */}
      <rect
        x="98"
        y="56"
        width="164"
        height="26"
        rx="8"
        className="fill-border/40"
      />
      <rect
        x="110"
        y="65"
        width="70"
        height="8"
        rx="4"
        className="fill-muted/30"
      />

      {/* The tag itself, highlighted */}
      <rect
        x="12"
        y="92"
        width="102"
        height="30"
        rx="9"
        className="fill-brand/15 stroke-brand"
        strokeWidth="2.5"
      />
      <text
        x="63"
        y="112"
        textAnchor="middle"
        className="fill-foreground font-mono"
        style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.02em" }}
      >
        {isClub ? "#CLUB99Z" : "#2ABC0XYZ"}
      </text>

      {/* Callout line and label */}
      <path
        d="M118 107 H196"
        className="stroke-brand"
        strokeWidth="2"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      <circle cx="196" cy="107" r="3.5" className="fill-brand" />
      <text
        x="206"
        y="112"
        className="fill-brand"
        style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em" }}
      >
        {isClub ? "CLUB TAG" : "YOUR TAG"}
      </text>

      {/* Stat blocks below, so the crop reads as a real screen */}
      <rect
        x="20"
        y="136"
        width="140"
        height="18"
        rx="6"
        className="fill-border/40"
      />
      <rect
        x="180"
        y="136"
        width="140"
        height="18"
        rx="6"
        className="fill-border/40"
      />
    </svg>
  );
}
