import Link from 'next/link';

import { Panel } from '@/components/ui/panel';
import type { ModeReadiness, RosterPlan } from '@/lib/roster-optimizer';

/**
 * The account in one block, at the top, before any of the detail.
 *
 * The profile already answers every part of this further down -- `PlayerMetaFit`
 * reads the roster against the tier list, `PlayerRankedPicks` says what to play
 * per mode, `PlayerRosterPlan` prices the fix. Each is good and each answers
 * its own question, and a reader who wants to know "am I in decent shape"
 * had to assemble the answer from four sections spread down a long page.
 *
 * So this computes nothing. Every number comes from the plan that section
 * below already built, which is the whole point: a second implementation of
 * "is this mode covered" would eventually disagree with the first, and both
 * would look right.
 *
 * Deliberately blunt. A verdict that hedges every line is not a verdict, and
 * the detail is one scroll away for anyone who wants to argue with it.
 */

const STYLE: Record<ModeReadiness['status'], { dot: string; text: string; label: string }> = {
  none: { dot: 'bg-rose-500', text: 'text-rose-400', label: 'No ready pick' },
  thin: { dot: 'bg-amber-400', text: 'text-amber-300', label: 'One ban from nothing' },
  strong: { dot: 'bg-emerald-400', text: 'text-emerald-300', label: 'Covered' },
};

export function PlayerVerdict({
  plan,
  usable,
  total,
}: {
  plan: RosterPlan;
  /** Brawlers at power 9 or above — the ones that can actually be fielded. */
  usable: number;
  /** Brawlers unlocked. */
  total: number;
}) {
  const { readiness, coveredBefore, banSafeBefore, modes, steps, totalCoins } = plan;
  if (readiness.length === 0) return null;

  const gaps = readiness.filter((m) => m.status !== 'strong');
  const worst = readiness.filter((m) => m.status === 'none');

  /*
   * The headline sentence, which has to be true in every case -- including the
   * account that is genuinely fine. An always-negative verdict is a nag, and a
   * reader learns to skip it.
   */
  const headline =
    worst.length > 0
      ? `${worst.length} ranked ${worst.length === 1 ? 'mode has' : 'modes have'} nothing you can field`
      : gaps.length > 0
        ? `Every mode is covered, but ${gaps.length} of them ${gaps.length === 1 ? 'is' : 'are'} one ban from nothing`
        : 'Every ranked mode is covered, with a pick spare';

  return (
    <Panel
      title="Your account, in short"
      subtitle="Read from the live Ranked rotation and the brawlers you have at power 9 or above."
      bodyClassName=""
    >
      <div className="relative">
        <span
          className={`block h-1 w-full ${
            worst.length > 0 ? 'bg-rose-500' : gaps.length > 0 ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
        />

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-2xl font-black tabular-nums">{usable}</p>
            <p className="text-sm text-muted">
              of your <span className="font-semibold text-foreground">{total}</span> brawlers are
              ready to play, covering{' '}
              <span className="font-bold tabular-nums text-foreground">
                {coveredBefore}/{modes}
              </span>{' '}
              modes
              {banSafeBefore > 0 ? (
                <>
                  {' '}
                  with a spare pick in{' '}
                  <span className="font-bold tabular-nums text-foreground">{banSafeBefore}</span>
                </>
              ) : null}
              .
            </p>
          </div>

          <p className="text-sm font-semibold leading-relaxed">{headline}</p>

          <ul className="grid gap-x-4 gap-y-2 @xl:grid-cols-2">
            {readiness.map((mode) => {
              const style = STYLE[mode.status];
              return (
                <li key={mode.mode} className="flex items-center gap-2.5 text-sm">
                  <span
                    aria-hidden
                    className={`size-2.5 shrink-0 rounded-full ${style.dot}`}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{mode.label}</span>
                  <span className={`shrink-0 text-xs font-semibold ${style.text}`}>
                    {/* The count, not just the colour: "2 ready" survives a
                        screenshot, a colour-blind reader and a grey print. */}
                    {mode.ready > 0 ? `${mode.ready} ready` : style.label}
                  </span>
                </li>
              );
            })}
          </ul>

          {steps.length > 0 ? (
            <p className="text-sm leading-relaxed text-muted">
              The cheapest fix is{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {totalCoins.toLocaleString('en-GB')} coins
              </span>{' '}
              — <Link href="#upgrade-next" className="font-medium text-brand hover:underline">
                see what it buys
              </Link>
              .
            </p>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
