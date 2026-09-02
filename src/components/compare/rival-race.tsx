import Image from 'next/image';

import { playerIconUrl } from '@/lib/brawlapi';
import { formatNumber } from '@/lib/format';
import type { PlayerSide } from '@/lib/player-compare';

/**
 * The two accounts as a race rather than a table.
 *
 * The comparison below already lists every figure side by side, which answers
 * "who is bigger" and nothing else. A race answers the question two friends
 * actually have — how far ahead is one, and what are they both heading for —
 * and it is the version worth sending someone.
 *
 * Stateless on purpose. The obvious build is a stored race with a target and a
 * background job refreshing both profiles; the URL already identifies the pair,
 * so the target can be derived instead and the whole thing costs no table, no
 * scheduler and no cleanup. It re-reads live every time it is opened, which is
 * the behaviour a stored race would have been built to fake.
 */

/** Milestones people actually push toward, rather than arbitrary round numbers. */
const STEP = 5_000;

function nextMilestone(leader: number): number {
  return Math.floor(leader / STEP) * STEP + STEP;
}

export function RivalRace({ a, b }: { a: PlayerSide; b: PlayerSide }) {
  const leader = a.player.trophies >= b.player.trophies ? a : b;
  const chaser = leader === a ? b : a;
  const target = nextMilestone(leader.player.trophies);
  const gap = leader.player.trophies - chaser.player.trophies;

  return (
    <section className="space-y-3">
      <div>
        <p className="flex items-center gap-2.5">
          <span aria-hidden className="rule h-4" />
          <span className="eyebrow text-accent">Race to {formatNumber(target)}</span>
        </p>
        <h2 className="display mt-2 text-2xl uppercase">
          {gap === 0 ? 'Dead level' : `${leader.player.name} leads by ${formatNumber(gap)}`}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {gap === 0
            ? 'Both accounts are on exactly the same trophy count.'
            : `${formatNumber(target - leader.player.trophies)} to go for the leader. Reload after either of you plays — this reads both profiles live.`}
        </p>
      </div>

      <div className="card space-y-4 p-5">
        {[leader, chaser].map((side) => (
          <Lane key={side.tag} side={side} target={target} />
        ))}
      </div>
    </section>
  );
}

function Lane({ side, target }: { side: PlayerSide; target: number }) {
  const share = Math.max(0, Math.min(1, side.player.trophies / target));

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <Image
          src={playerIconUrl(side.player.icon?.id)}
          alt=""
          width={32}
          height={32}
          className="size-8 shrink-0 rounded-lg bg-surface-2"
          unoptimized
        />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{side.player.name}</span>
        <span className="shrink-0 text-sm font-black tabular-nums text-brand">
          {formatNumber(side.player.trophies)}
        </span>
      </div>

      {/* A bar rather than a number, because the point of a race is the gap and
          two numbers make the reader do the subtraction. */}
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <span
          className="block h-full rounded-full bg-brand"
          style={{ width: `${(share * 100).toFixed(2)}%` }}
        />
      </div>
      <p className="mt-1 text-xs tabular-nums text-muted">
        {formatNumber(Math.max(0, target - side.player.trophies))} to go
      </p>
    </div>
  );
}
