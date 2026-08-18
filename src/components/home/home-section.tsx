import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * One heading treatment for every homepage block: eyebrow, title, one line of
 * explanation, and a single link out to the full page.
 *
 * This is separate from the site-wide `SectionHeading` on purpose — the
 * landing page runs a looser vertical rhythm and a trailing call to action
 * that the dense stat pages do not want.
 */
export function HomeSection({
  id,
  eyebrow,
  title,
  subtitle,
  ctaHref,
  ctaLabel,
  children,
}: {
  id: string;
  eyebrow?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  ctaHref: string;
  ctaLabel: string;
  children: ReactNode;
}) {
  return (
    /*
      `min-w-0` matters: when this section is a grid item, its automatic
      minimum size would otherwise be the min-content width of the ranked list
      inside it, and one long player name would push the whole page sideways
      on a narrow phone.
    */
    <section className="reveal min-w-0" aria-labelledby={id}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 id={id} className="display mt-2.5 text-2xl uppercase sm:text-3xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 max-w-xl text-sm text-muted">{subtitle}</p>
          ) : null}
        </div>

        <Link
          href={ctaHref}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-foreground transition-colors hover:border-brand/50 hover:text-brand"
        >
          {ctaLabel}
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      {children}
    </section>
  );
}
