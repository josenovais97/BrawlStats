import 'server-only';

import { getClub } from '@/lib/bs-api';
import { getPrisma } from '@/lib/prisma';
import { normalizeTag } from '@/lib/tags';
import type { BSClub } from '@/types/brawlstars';

/**
 * Club activity: who gained trophies this week, and who went quiet.
 *
 * The game API answers "who is in this club now" and nothing about the past,
 * so the history is ours: one snapshot of the members per club per day
 * (`club_member_snapshots`). A club is tracked from the moment its page is
 * opened, and the sampler refreshes tracked clubs once a day for as long as
 * someone has opened the page in the last 30 days -- one API call per club,
 * so a club leader who checks weekly still gets daily history.
 */

const TRACK_DAYS = 30;
const KEEP_DAYS = 60;
/** At most this many clubs refreshed per sampler run; 12 runs a day. */
const REFRESH_PER_RUN = 150;
/** A member with no trophy gain over at least this many tracked days is "inactive". */
export const INACTIVE_AFTER_DAYS = 3;

function today(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Writes today's snapshot of a club's members, once per day. */
async function snapshotClub(club: BSClub): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  const clubTag = normalizeTag(club.tag);
  const day = today();
  await prisma.clubMemberSnapshot.createMany({
    data: (club.members ?? []).map((m) => ({
      clubTag,
      day,
      playerTag: normalizeTag(m.tag),
      name: m.name,
      trophies: m.trophies,
      role: m.role,
    })),
    skipDuplicates: true,
  });
  await prisma.trackedClub.update({ where: { clubTag }, data: { lastSnapshotOn: day } });
}

/**
 * Called after a club page renders: tracks the club, and snapshots it if
 * today's snapshot is missing. Never throws -- a page view must not fail on
 * bookkeeping.
 */
export async function recordClubView(club: BSClub): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  try {
    const clubTag = normalizeTag(club.tag);
    const tracked = await prisma.trackedClub.upsert({
      where: { clubTag },
      create: { clubTag, lastViewedAt: new Date() },
      update: { lastViewedAt: new Date() },
    });
    if (!tracked.lastSnapshotOn || tracked.lastSnapshotOn < today()) await snapshotClub(club);
  } catch {
    // Bookkeeping only.
  }
}

/**
 * For the sampler: refresh tracked clubs not yet snapshotted today, forget
 * clubs nobody opened in 30 days, and prune snapshots older than 60.
 */
export async function refreshTrackedClubs(): Promise<{ refreshed: number; failed: number; forgotten: number }> {
  const prisma = getPrisma();
  if (!prisma) return { refreshed: 0, failed: 0, forgotten: 0 };
  const cutoff = new Date(Date.now() - TRACK_DAYS * 86_400_000);
  const { count: forgotten } = await prisma.trackedClub.deleteMany({ where: { lastViewedAt: { lt: cutoff } } });
  await prisma.clubMemberSnapshot.deleteMany({
    where: { day: { lt: new Date(today().getTime() - KEEP_DAYS * 86_400_000) } },
  });

  const due = await prisma.trackedClub.findMany({
    where: { OR: [{ lastSnapshotOn: null }, { lastSnapshotOn: { lt: today() } }] },
    orderBy: { lastViewedAt: 'desc' },
    take: REFRESH_PER_RUN,
  });
  let refreshed = 0;
  let failed = 0;
  for (const row of due) {
    try {
      await snapshotClub(await getClub(row.clubTag));
      refreshed += 1;
    } catch {
      failed += 1;
    }
  }
  return { refreshed, failed, forgotten };
}

export interface MemberActivity {
  tag: string;
  name: string;
  role: string;
  trophies: number;
  /** Trophies gained since the baseline; null for a member who joined since. */
  gained: number | null;
}

export interface ClubActivity {
  /** The day the baseline was taken (up to 7 days ago), or null with no history. */
  since: Date | null;
  /** Whole days between the baseline and today. */
  days: number;
  members: MemberActivity[];
  /** Sum of the gains of members present at both ends. */
  totalGained: number;
  inactive: number;
}

/**
 * This week's activity for the club's current members, against the oldest
 * snapshot within the last 7 days.
 */
export async function getClubActivity(club: BSClub): Promise<ClubActivity | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  try {
    const clubTag = normalizeTag(club.tag);
    const weekAgo = new Date(today().getTime() - 7 * 86_400_000);
    const first = await prisma.clubMemberSnapshot.findFirst({
      where: { clubTag, day: { gte: weekAgo } },
      orderBy: { day: 'asc' },
      select: { day: true },
    });
    const members = club.members ?? [];
    if (!first) {
      return {
        since: null,
        days: 0,
        members: members.map((m) => ({ tag: normalizeTag(m.tag), name: m.name, role: m.role, trophies: m.trophies, gained: null })),
        totalGained: 0,
        inactive: 0,
      };
    }
    const base = await prisma.clubMemberSnapshot.findMany({ where: { clubTag, day: first.day } });
    const before = new Map(base.map((r) => [r.playerTag, r.trophies]));
    const days = Math.round((today().getTime() - first.day.getTime()) / 86_400_000);
    const rows = members.map((m) => {
      const tag = normalizeTag(m.tag);
      const was = before.get(tag);
      return { tag, name: m.name, role: m.role, trophies: m.trophies, gained: was === undefined ? null : m.trophies - was };
    });
    rows.sort((a, b) => (b.gained ?? -Infinity) - (a.gained ?? -Infinity));
    return {
      since: first.day,
      days,
      members: rows,
      totalGained: rows.reduce((n, r) => n + (r.gained ?? 0), 0),
      inactive: days >= INACTIVE_AFTER_DAYS ? rows.filter((r) => r.gained !== null && r.gained <= 0).length : 0,
    };
  } catch {
    return null;
  }
}
