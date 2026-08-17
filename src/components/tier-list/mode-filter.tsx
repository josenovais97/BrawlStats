import Link from 'next/link';

import { humanizeMode } from '@/lib/format';
import type { TierWindowKey } from '@/lib/stats';

/**
 * Game-mode filter for the tier list.
 *
 * Plain links again, for the same reason as the window tabs: every combination
 * is its own cacheable URL and none of it needs client JavaScript. The row
 * scrolls horizontally on a phone rather than wrapping into four lines of
 * chips, which is the one place horizontal scroll is the right answer.
 */
export function ModeFilter({
  modes,
  active,
  windowKey,
}: {
  modes: { mode: string; battles: number }[];
  active?: string;
  windowKey: TierWindowKey;
}) {
  if (modes.length === 0) return null;

  function href(mode?: string) {
    const params = new URLSearchParams();
    if (windowKey !== '7d') params.set('window', windowKey);
    if (mode) params.set('mode', mode);
    const query = params.toString();
    return query ? `/tier-list?${query}` : '/tier-list';
  }

  const chip =
    'shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors';

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="group" aria-label="Game mode" className="flex w-max gap-2">
        <Link
          href={href()}
          aria-current={active ? undefined : 'page'}
          className={`${chip} ${
            active
              ? 'border-border bg-surface text-muted hover:text-foreground'
              : 'border-brand/40 bg-brand/10 text-brand'
          }`}
        >
          All modes
        </Link>

        {modes.map(({ mode, battles }) => {
          const current = mode === active;
          return (
            <Link
              key={mode}
              href={href(mode)}
              aria-current={current ? 'page' : undefined}
              title={`${battles.toLocaleString()} sampled battles`}
              className={`${chip} ${
                current
                  ? 'border-brand/40 bg-brand/10 text-brand'
                  : 'border-border bg-surface text-muted hover:text-foreground'
              }`}
            >
              {humanizeMode(mode)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
