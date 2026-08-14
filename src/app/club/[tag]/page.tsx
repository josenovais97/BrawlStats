import type { Metadata } from 'next';
import { Lock, Shield, Trophy, UserPlus, Users } from 'lucide-react';
import Image from 'next/image';

import { ClubMembers } from '@/components/club/club-members';
import { ErrorState } from '@/components/ui/error-state';
import { RecentSearchRecorder } from '@/components/recent-search-recorder';
import { StatCard } from '@/components/ui/stat-card';
import { clubBadgeUrl } from '@/lib/brawlapi';
import { getClub } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { formatNumber, humanizeRole } from '@/lib/format';
import { displayTag, normalizeTag } from '@/lib/tags';

interface PageProps {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  try {
    const club = await getClub(tag);
    return {
      title: `${club.name} (${displayTag(club.tag)})`,
      description: club.description || `${club.name} club stats and member list.`,
    };
  } catch {
    return { title: `Club ${displayTag(tag)}` };
  }
}

export default async function ClubPage({ params }: PageProps) {
  const { tag } = await params;

  let club;
  try {
    club = await getClub(tag);
  } catch (err) {
    const apiError = toApiError(err);
    return (
      <ErrorState
        code={apiError.code}
        title={apiError.code === 'notFound' ? 'Club not found' : undefined}
        detail={
          apiError.code === 'notFound'
            ? `No club exists with the tag ${displayTag(tag)}. Club tags are shown on the club's info screen in-game.`
            : undefined
        }
      />
    );
  }

  const members = club.members ?? [];
  const averageTrophies =
    members.length > 0 ? Math.round(club.trophies / members.length) : 0;

  return (
    <div className="space-y-8">
      <RecentSearchRecorder
        kind="club"
        tag={normalizeTag(club.tag)}
        name={club.name}
      />
      <header className="card card-glow p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Image
            src={clubBadgeUrl(club.badgeId)}
            alt=""
            width={80}
            height={80}
            className="size-20 shrink-0 rounded-2xl bg-surface-2 p-1"
            priority
            unoptimized
          />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl font-black tracking-tight">{club.name}</h1>
            <p className="mt-1 font-mono text-sm text-muted">{club.tag}</p>
            {club.description ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                {club.description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="flex items-center gap-2 text-3xl font-black tabular-nums text-brand">
              <Trophy className="size-7" />
              {formatNumber(club.trophies)}
            </span>
            <span className="text-xs text-muted">Club trophies</span>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Members"
          value={`${members.length}/30`}
          tone="text-accent"
        />
        <StatCard
          icon={Trophy}
          label="Avg trophies"
          value={formatNumber(averageTrophies)}
        />
        <StatCard
          icon={UserPlus}
          label="Required"
          value={formatNumber(club.requiredTrophies)}
          hint="To join"
          tone="text-victory"
        />
        <StatCard
          icon={club.type === 'open' ? Shield : Lock}
          label="Type"
          value={humanizeRole(club.type)}
          hint={club.isFamilyFriendly ? 'Family friendly' : undefined}
        />
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Members</h2>
        <ClubMembers members={members} />
      </section>
    </div>
  );
}
