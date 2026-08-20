import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Methodology, caveats and long tables, folded away.
 *
 * Every page on this site has something the reader *may* need — how a score is
 * calculated, what the sample does not cover — and pages kept paying for it
 * with two paragraphs above the thing people came for. Nothing is deleted, it
 * just stops being mandatory.
 *
 * Native `<details>` on purpose: no state, no JavaScript, keyboard operable and
 * focus-visible for free, and it stays open when the browser prints or
 * find-in-pages it. The `group-open` marker rotation is the only styling that
 * needs to know the state.
 */
export function Disclosure({
  summary,
  children,
  className = '',
  tone = 'card',
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  /** `card` sits on a surface of its own; `bare` inherits the parent's. */
  tone?: 'card' | 'bare';
}) {
  return (
    <details
      className={`group ${tone === 'card' ? 'card overflow-hidden' : ''} ${className}`}
    >
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden ${
          tone === 'card' ? 'px-4 py-3.5' : 'py-2'
        }`}
      >
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 duration-200 group-open:rotate-180 motion-safe:transition-transform"
        />
        {summary}
      </summary>
      <div
        className={
          tone === 'card'
            ? 'border-t border-border px-4 py-4 text-sm leading-relaxed text-muted'
            : 'pb-2 text-sm leading-relaxed text-muted'
        }
      >
        {children}
      </div>
    </details>
  );
}

/**
 * Long prose that collapses to a few lines until asked to open.
 *
 * Used for ability descriptions, which run from eight words to sixty: at the
 * long end one gadget can be three times the height of the card next to it,
 * and a grid of build cards stops being scannable. Short text is passed
 * through untouched, so this only appears where it earns its place.
 *
 * The text itself is the `<summary>`, which is what makes the toggle work
 * without JavaScript: closed, the clamp shows the first lines; open, the same
 * element unclamps. Nothing is hidden from a crawler or a screen reader either
 * way, since the full string is always in the markup.
 */
export function ClampedText({
  text,
  lines = 3,
  threshold = 180,
  className = '',
}: {
  text: string;
  /** Lines shown while collapsed. */
  lines?: 2 | 3 | 4;
  /** Below this many characters the text is rendered plainly. */
  threshold?: number;
  className?: string;
}) {
  if (text.length <= threshold) {
    return <p className={`text-sm leading-relaxed text-muted ${className}`}>{text}</p>;
  }

  const clamp = { 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4' }[lines];

  return (
    <details className={`group ${className}`}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span
          className={`block text-sm leading-relaxed text-muted ${clamp} group-open:line-clamp-none`}
        >
          {text}
        </span>
        <span className="mt-1 inline-block text-xs font-semibold text-brand">
          <span className="group-open:hidden">Read more</span>
          <span className="hidden group-open:inline">Show less</span>
        </span>
      </summary>
    </details>
  );
}
