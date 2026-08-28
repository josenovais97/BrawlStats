import { RankedIcon, TrophyIcon } from '@/components/game-icons';
import Link from 'next/link';

import { humanizeMode } from '@/lib/format';
import { tierListHref } from '@/lib/tier-list-route';
import { TIER_WINDOWS, type TierFormat, type TierWindowKey } from '@/lib/stats';

/**
 * The three controls above a tier list: format, window, mode.
 *
 * All plain links, so every combination is its own cacheable URL and none of it
 * needs client JavaScript. They live in one file because they are one control
 * surface — each row has to know the other two rows' state to build a link that
 * changes only its own dimension, and splitting that across three components
 * meant three copies of the query-string logic drifting apart.
 */

/* The URL scheme lives with the routes that implement it. */
export { tierListHref };

const FORMATS: {
  key: TierFormat;
  label: string;
  sublabel: string;
  icon: (props: { className?: string }) => React.ReactNode;
}[] = [
  { key: 'ranked', label: 'Ranked', sublabel: 'Competitive', icon: RankedIcon },
  { key: 'trophy', label: 'Trophy', sublabel: 'Ladder', icon: TrophyIcon },
];

export function TierListControls({
  format,
  windowKey,
  mode,
  modes,
}: {
  format: TierFormat;
  windowKey: TierWindowKey;
  mode?: string;
  modes: { mode: string; battles: number }[];
}) {
  return (
    <div className="space-y-3">
      {/* Format and window share a line where there is room — they are both
          "which numbers", where the mode chips below are "which subset". They
          wrap onto separate lines rather than shrinking, because a segmented
          control that has to scroll is worse than one that wraps. */}
      <div className="flex flex-wrap items-center gap-2">
        <FormatTabs format={format} windowKey={windowKey} />
        <WindowTabs format={format} windowKey={windowKey} mode={mode} />
      </div>
      <ModeFilter format={format} windowKey={windowKey} mode={mode} modes={modes} />
    </div>
  );
}

/**
 * The primary switch, and styled as one: the other two rows narrow a list,
 * this one swaps which game is being ranked.
 *
 * Deliberately drops the mode filter when switching. The two rotations barely
 * overlap — carrying `mode=soloShowdown` onto the Ranked list would land on a
 * mode that has no competitive data at all, and the page would open empty for
 * no reason the reader can see.
 */
function FormatTabs({ format, windowKey }: { format: TierFormat; windowKey: TierWindowKey }) {
  return (
    <div
      role="group"
      aria-label="Tier list format"
      className="inline-flex gap-1 rounded-2xl border border-border bg-surface-2/70 p-1"
    >
      {FORMATS.map(({ key, label, sublabel, icon: Icon }) => {
        const current = key === format;
        return (
          <Link
            key={key}
            href={tierListHref(key, windowKey)}
            aria-current={current ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-colors ${
              current
                ? 'bg-brand text-brand-ink shadow-[0_1px_2px_rgb(0_0_0/0.35)]'
                : 'text-muted hover:bg-surface-3/60 hover:text-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span className="text-left leading-tight">
              <span className="block text-sm font-bold">{label}</span>
              <span
                className={`block text-xs font-semibold ${
                  current ? 'text-brand-ink/70' : 'text-muted'
                }`}
              >
                {sublabel}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Window switcher. Carries the mode filter across, unlike the format switch:
 * the same mode exists in every window, so dropping it here would just undo
 * the reader's last click.
 */
function WindowTabs({
  format,
  windowKey,
  mode,
}: {
  format: TierFormat;
  windowKey: TierWindowKey;
  mode?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Tier list window"
      className="inline-flex rounded-xl border border-border bg-surface-2/70 p-1"
    >
      {(Object.keys(TIER_WINDOWS) as TierWindowKey[]).map((key) => {
        const { label, sublabel } = TIER_WINDOWS[key];
        const current = key === windowKey;
        return (
          <Link
            key={key}
            href={tierListHref(format, key, mode)}
            aria-current={current ? 'page' : undefined}
            className={`flex items-baseline gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              current ? 'bg-surface-3 text-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {label}
            <span className={`text-xs font-bold ${current ? 'text-foreground' : 'text-muted'}`}>
              {sublabel}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Game-mode filter. The row scrolls horizontally on a phone rather than
 * wrapping into four lines of chips, which is the one place horizontal scroll
 * is the right answer.
 */
function ModeFilter({
  format,
  windowKey,
  mode,
  modes,
}: {
  format: TierFormat;
  windowKey: TierWindowKey;
  mode?: string;
  modes: { mode: string; battles: number }[];
}) {
  if (modes.length === 0) return null;

  const chip = 'shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors';
  const on = 'border-brand/40 bg-brand/10 text-brand';
  const off = 'border-border bg-surface text-muted hover:text-foreground';

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="group" aria-label="Game mode" className="flex w-max gap-2">
        <Link
          href={tierListHref(format, windowKey)}
          aria-current={mode ? undefined : 'page'}
          className={`${chip} ${mode ? off : on}`}
        >
          All modes
        </Link>

        {modes.map((entry) => {
          const current = entry.mode === mode;
          return (
            <Link
              key={entry.mode}
              href={tierListHref(format, windowKey, entry.mode)}
              aria-current={current ? 'page' : undefined}
              title={`${entry.battles.toLocaleString()} sampled battles`}
              className={`${chip} ${current ? on : off}`}
            >
              {humanizeMode(entry.mode)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
