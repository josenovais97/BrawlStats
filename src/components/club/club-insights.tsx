import { Shield, Star, TrendingUp } from 'lucide-react';

import { CrownIcon, PlayersIcon } from '@/components/game-icons';
import Image from 'next/image';
import Link from 'next/link';

import { TrophyIcon } from '@/components/game-icons';
import { SectionHeading } from '@/components/ui/section-heading';
import { playerIconUrl } from '@/lib/brawlapi';
import { formatNumber, humanizeRole } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';
import type { BSClub, BSClubMember } from '@/types/brawlstars';

/** Roster composition, trophy spread and eligibility, derived from the member list. */
export function ClubInsights({ club }: { club: BSClub }) {
  const members = club.members ?? [];
  if (members.length === 0) return null;

  const sorted = [...members].sort((a, b) => b.trophies - a.trophies);
  const trophies = sorted.map((m) => m.trophies);

  const total = trophies.reduce((sum, t) => sum + t, 0);
  const average = Math.round(total / members.length);
  const median = trophies[Math.floor(trophies.length / 2)];
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  const roleCounts = members.reduce<Record<string, number>>((acc, member) => {
    acc[member.role] = (acc[member.role] ?? 0) + 1;
    return acc;
  }, {});

  // How much of the club's total sits with its top five players.
  const topFiveShare =
    total > 0 ? trophies.slice(0, 5).reduce((sum, t) => sum + t, 0) / total : 0;

  // Members who would not meet the club's own entry requirement today.
  const belowRequirement = club.requiredTrophies
    ? members.filter((m) => m.trophies < club.requiredTrophies).length
    : 0;

  const openSlots = Math.max(0, 30 - members.length);

  return (
    <section>
      <SectionHeading title="Roster insights" />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trophy spread */}
        <div className="card card-glow p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="size-4 text-brand" />
            Trophy spread
          </h3>

          <Spread members={sorted} />

          <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
            <Row label="Average" value={formatNumber(average)} />
            <Row label="Median" value={formatNumber(median)} />
            <Row label="Highest" value={formatNumber(highest.trophies)} />
            <Row label="Lowest" value={formatNumber(lowest.trophies)} />
            <Row
              label="Top 5 share"
              value={`${Math.round(topFiveShare * 100)}%`}
            />
          </dl>
        </div>

        {/* Composition */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
            <PlayersIcon className="size-4" />
            Composition
          </h3>

          <ul className="space-y-3">
            {(
              [
                ['president', CrownIcon, 'text-brand'],
                ['vicePresident', Shield, 'text-accent'],
                ['senior', Star, 'text-victory'],
                ['member', PlayersIcon, 'text-muted'],
              ] as const
            ).map(([role, Icon, tone]) => {
              const count = roleCounts[role] ?? 0;
              const share = members.length > 0 ? count / members.length : 0;

              return (
                <li key={role}>
                  <div className="mb-1 flex items-center gap-2 text-sm">
                    <Icon className={`size-3.5 shrink-0 ${tone}`} />
                    <span className="flex-1">{humanizeRole(role)}</span>
                    <span className="tabular-nums text-muted">{count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-strong to-brand"
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <dl className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
            <Row
              label="Open slots"
              value={openSlots === 0 ? 'Full' : String(openSlots)}
            />
            {club.requiredTrophies > 0 ? (
              <Row
                label="Below entry bar"
                value={`${belowRequirement} ${belowRequirement === 1 ? 'member' : 'members'}`}
              />
            ) : null}
          </dl>
        </div>

        {/* Top contributors */}
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
            <TrophyIcon className="size-4" />
            Top contributors
          </h3>

          <ol className="space-y-1">
            {sorted.slice(0, 5).map((member, index) => (
              <li key={member.tag}>
                <Link
                  href={`/player/${normalizeTag(member.tag)}`}
                  className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                >
                  <span className="w-4 shrink-0 text-center text-xs font-black tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <Image
                    src={playerIconUrl(member.icon?.id)}
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 shrink-0 rounded-md bg-surface-2"
                    unoptimized
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {member.name}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-brand">
                    {formatNumber(member.trophies)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/**
 * A compact bar per member, tallest first. Shows at a glance whether a club is
 * evenly matched or carried by a couple of players.
 */
function Spread({ members }: { members: BSClubMember[] }) {
  const max = members[0]?.trophies || 1;

  return (
    <div className="flex h-20 items-end gap-[2px]" aria-hidden>
      {members.map((member) => (
        <span
          key={member.tag}
          title={`${member.name}: ${formatNumber(member.trophies)}`}
          className="flex-1 rounded-sm bg-gradient-to-t from-brand-strong/50 to-brand"
          style={{ height: `${Math.max((member.trophies / max) * 100, 6)}%` }}
        />
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
