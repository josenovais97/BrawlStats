'use client';

import { Search, Shield, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CrownIcon, PlayersIcon } from '@/components/game-icons';

import { TrophyIcon } from '@/components/game-icons';
import { playerIconUrl } from '@/lib/brawlapi';
import { formatNumber, humanizeRole, nameColorToCss } from '@/lib/format';
import { normalizeTag } from '@/lib/tags';
import type { BSClubMember, BSClubRole } from '@/types/brawlstars';

/** Higher is more senior — drives the default ordering and badge styling. */
const ROLE_WEIGHT: Record<string, number> = {
  president: 4,
  vicePresident: 3,
  senior: 2,
  member: 1,
};

const ROLE_STYLE: Record<
  string,
  { icon: (props: { className?: string }) => React.ReactNode; className: string }
> = {
  president: { icon: CrownIcon, className: 'bg-brand/15 text-brand' },
  vicePresident: { icon: Shield, className: 'bg-accent/20 text-accent' },
  senior: { icon: Star, className: 'bg-victory/15 text-victory' },
  member: { icon: PlayersIcon, className: 'bg-surface-2 text-muted' },
};

export function ClubMembers({ members }: { members: BSClubMember[] }) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<BSClubRole | 'all'>('all');

  const roles = useMemo(() => {
    const present = new Set(members.map((m) => m.role));
    return (['president', 'vicePresident', 'senior', 'member'] as BSClubRole[]).filter(
      (r) => present.has(r),
    );
  }, [members]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => (roleFilter === 'all' ? true : m.role === roleFilter))
      .filter(
        (m) =>
          !q ||
          m.name.toLowerCase().includes(q) ||
          normalizeTag(m.tag).toLowerCase().includes(normalizeTag(q).toLowerCase()),
      )
      .sort(
        (a, b) =>
          (ROLE_WEIGHT[b.role] ?? 0) - (ROLE_WEIGHT[a.role] ?? 0) ||
          b.trophies - a.trophies,
      );
  }, [members, query, roleFilter]);

  if (members.length === 0) {
    return <p className="card p-6 text-sm text-muted">This club has no members listed.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members by name or tag"
            aria-label="Search club members"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-brand/60"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {(['all', ...roles] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role as BSClubRole | 'all')}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                roleFilter === role
                  ? 'bg-brand text-[#1a1200]'
                  : 'border border-border text-muted hover:text-foreground'
              }`}
            >
              {role === 'all' ? 'All' : humanizeRole(role)}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="card p-6 text-sm text-muted">No members match that search.</p>
      ) : (
        <ol className="space-y-2">
          {visible.map((member, index) => {
            const style = ROLE_STYLE[member.role] ?? ROLE_STYLE.member;
            const RoleIcon = style.icon;

            return (
              <li key={member.tag}>
                <Link
                  href={`/player/${normalizeTag(member.tag)}`}
                  className="card card-interactive flex items-center gap-3 p-3"
                >
                  <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted">
                    {index + 1}
                  </span>
                  <Image
                    src={playerIconUrl(member.icon?.id)}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 shrink-0 rounded-lg bg-surface-2"
                    unoptimized
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate font-semibold"
                      style={{ color: nameColorToCss(member.nameColor) }}
                    >
                      {member.name}
                    </p>
                    <p className="truncate font-mono text-xs text-muted">{member.tag}</p>
                  </div>
                  <span
                    className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${style.className}`}
                  >
                    <RoleIcon className="size-3" />
                    {humanizeRole(member.role)}
                  </span>
                  <span className="flex w-24 shrink-0 items-center justify-end gap-1.5 font-bold tabular-nums text-brand">
                    <TrophyIcon className="size-4" />
                    {formatNumber(member.trophies)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
