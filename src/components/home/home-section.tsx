import Link from 'next/link';
import type { ReactNode } from 'react';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

/**
 * One heading treatment for every homepage block: title, one line of
 * explanation, and a single link out to the full page.
 *
 * This is separate from the site-wide `SectionHeading` on purpose — the
 * landing page runs a looser vertical rhythm and a trailing call to action
 * that the dense stat pages do not want. `eyebrow` is accepted and ignored:
 * the labels above each title went on 2026-10-30.
 */
export function HomeSection({
  id,
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
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
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
          {/* No label above the title any more (2026-10-30): the title says it. */}
          <h2 id={id} className="display text-game-stroke text-3xl sm:text-4xl">
            {t(title)}
          </h2>
          {subtitle ? (
            <p className="mt-2 max-w-xl text-sm text-muted">{t(subtitle)}</p>
          ) : null}
        </div>

        {/* A game button rather than a text link with an arrow (2026-10-30). */}
        <Link
          href={lp(ctaHref)}
          className="btn-game inline-flex shrink-0 items-center bg-surface-3 px-4 py-2 text-base text-white [--btn-shadow:var(--ink)] hover:bg-[#31439a]"
        >
          {t(ctaLabel)}
        </Link>
      </div>

      {children}
    </section>
  );
}
