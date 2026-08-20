import type { Metadata } from 'next';
import { Lock, Shield, UserPlus } from 'lucide-react';

import { FavoriteButton } from '@/components/favorite-button';
import { PlayersIcon, TrophyIcon } from '@/components/game-icons';
import Image from 'next/image';

import { ClubInsights } from '@/components/club/club-insights';
import { ClubMembers } from '@/components/club/club-members';
import { ErrorState } from '@/components/ui/error-state';
import { RecentSearchRecorder } from '@/components/recent-search-recorder';
import { SectionHeading } from '@/components/ui/section-heading';
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
      alternates: { canonical: `/club/${normalizeTag(club.tag)}` },
      // Indexable pages must be a deliberate set. This one is not: the
      // combinations are effectively unbounded, and a crawler walking them costs
      // real API and function budget for pages nobody searched for. `follow` is
      // kept so the links out of them still pass value to the pages that matter.
      robots: { index: false, follow: true },
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
        icon={club.badgeId}
      />
      <header className="card card-glow relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-[0.14]"
          style={{
            background:
              'radial-gradient(40rem 12rem at 18% 0%, var(--accent), transparent 70%)',
          }}
        />
        <div className="relative flex flex-wrap items-center gap-5 p-6 sm:p-7">
          <div className="relative shrink-0">
            <span
              aria-hidden
              className="absolute -inset-1.5 rounded-[1.4rem] bg-accent opacity-25 blur-md"
            />
            <Image
              src={clubBadgeUrl(club.badgeId)}
              alt=""
              width={88}
              height={88}
              className="relative size-[88px] rounded-2xl bg-surface-2 p-1 ring-1 ring-border-strong"
              priority
              unoptimized
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="display truncate text-4xl uppercase sm:text-5xl">
              {club.name}
            </h1>
            <p className="mt-1 font-mono text-sm text-muted">{club.tag}</p>
            {club.description ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                {club.description}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2.5">
            <div className="flex flex-col items-end gap-1 rounded-2xl border border-border bg-surface-2/60 px-5 py-4">
              <span className="flex items-center gap-2 text-3xl font-black tabular-nums text-brand sm:text-4xl">
                <TrophyIcon className="size-7" />
                {formatNumber(club.trophies)}
              </span>
              <span className="text-xs text-muted">Club trophies</span>
            </div>
            <FavoriteButton kind="club" tag={normalizeTag(club.tag)} name={club.name} />
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          node={<PlayersIcon className="size-6" />}
          label="Members"
          value={`${members.length}/30`}
          tone="text-accent"
        />
        <StatCard
          node={<TrophyIcon className="size-6" />}
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

      <ClubInsights club={club} />

      <section>
        <SectionHeading title="Members" aside={`${members.length} of 30`} />
        <ClubMembers members={members} />
      </section>
    </div>
  );
}
