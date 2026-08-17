import Link from 'next/link';

import { TIER_WINDOWS, type TierWindowKey } from '@/lib/stats';

/**
 * Window switcher for the tier list.
 *
 * Plain links rather than a client component: each window is a distinct,
 * cacheable URL, so switching costs a server render that was already going to
 * be cached and ships no JavaScript.
 */
export function WindowTabs({ active }: { active: TierWindowKey }) {
  return (
    <div
      role="group"
      aria-label="Tier list window"
      className="inline-flex rounded-xl border border-border bg-surface-2/70 p-1"
    >
      {(Object.keys(TIER_WINDOWS) as TierWindowKey[]).map((key) => {
        const { label, sublabel } = TIER_WINDOWS[key];
        const current = key === active;
        return (
          <Link
            key={key}
            href={key === '7d' ? '/tier-list' : `/tier-list?window=${key}`}
            aria-current={current ? 'page' : undefined}
            className={`flex items-baseline gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              current
                ? 'bg-brand text-brand-ink shadow-[0_1px_2px_rgb(0_0_0/0.35)]'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {label}
            <span
              className={`text-[0.6875rem] font-bold ${
                current ? 'text-brand-ink/70' : 'text-muted/70'
              }`}
            >
              {sublabel}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
