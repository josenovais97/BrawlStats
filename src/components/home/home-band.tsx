import type { ReactNode } from "react";

/**
 * A full-bleed change of ground behind a run of sections.
 *
 * The landing page's problem was not the content, it was that every block sat
 * on the same background inside the same card grid, so the page read as a
 * stack of components rather than as one designed thing. A band costs no extra
 * markup per section and gives the eye somewhere to rest.
 *
 * Two tones, and the difference is direction. `raised` lifts off the page and
 * holds a group of things you can click. `deep` sinks below it, lit from one
 * side, and is for the one section that is an argument rather than a tool —
 * going darker rather than lighter is what stops the second band reading as a
 * repeat of the first.
 *
 * Escapes the content column deliberately — `w-screen` centred on the page —
 * which is safe because the body clips horizontal overflow. See `globals.css`.
 */
export function HomeBand({
  children,
  tone = "raised",
  className = "",
}: {
  children: ReactNode;
  tone?: "raised" | "deep";
  className?: string;
}) {
  const deep = tone === "deep";

  return (
    <div className={`relative py-12 sm:py-16 ${className}`}>
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 border-y ${
          deep
            ? /* Recessed rather than merely darker: the inset shadows along
                 both edges are what make the floor read as below the page
                 instead of as a slightly different shade of it. */
              "border-black/60 bg-[#03050b] shadow-[inset_0_22px_34px_-26px_rgb(0_0_0),inset_0_-22px_34px_-26px_rgb(0_0_0)]"
            : "border-border/50 bg-surface/25"
        }`}
      />

      {/* One light, from the side the copy sits on, so the deep floor is lit
          rather than merely dark. */}
      {deep ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2"
          style={{
            background:
              "radial-gradient(46rem 22rem at 24% 8%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 70%)," +
              "radial-gradient(34rem 18rem at 86% 92%, color-mix(in srgb, var(--accent-2) 12%, transparent), transparent 70%)",
          }}
        />
      ) : null}

      {children}
    </div>
  );
}
