import 'server-only';

import { createHash, randomInt } from 'node:crypto';

import { getPlayer } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import {
  ENTRIES_PER_IP_PER_DAY,
  GIVEAWAY,
  entriesFor,
  isCode,
  isOpen,
  newCode,
  normaliseEmail,
  rank,
  type EntryCounts,
  type FollowPlatform,
} from '@/lib/giveaway';
import { getPrisma } from '@/lib/prisma';
import { normalizeTag } from '@/lib/tags';

/**
 * The giveaway's reads and writes (2026-10-27). Every rule that can be broken
 * by a request is checked here, not in the form: the tag must be a real
 * account, one entry per tag and per email, a few entries per network per
 * day, and a referral only counts from someone else's entry.
 */

export type EnterResult =
  | { ok: true; code: string }
  | { ok: false; error: 'closed' | 'consent' | 'email' | 'tag' | 'tagTaken' | 'emailTaken' | 'tooMany' | 'unavailable' };

/**
 * A salted hash of the address, never the address. The salt rotates daily,
 * which is all the per-day cap needs and means a stored hash says nothing a
 * day later.
 */
export function ipHash(ip: string, now = new Date()): string {
  const salt = process.env.GIVEAWAY_IP_SALT ?? 'brawlzone-giveaway';
  return createHash('sha256').update(`${salt}:${now.toISOString().slice(0, 10)}:${ip}`).digest('hex').slice(0, 32);
}

export async function enter(input: {
  tag: string;
  email: string;
  consent: boolean;
  ref: string | null;
  ip: string;
}): Promise<EnterResult> {
  if (!isOpen()) return { ok: false, error: 'closed' };
  if (!input.consent) return { ok: false, error: 'consent' };
  const email = normaliseEmail(input.email);
  if (!email) return { ok: false, error: 'email' };
  const prisma = getPrisma();
  if (!prisma) return { ok: false, error: 'unavailable' };

  let player;
  try {
    player = await getPlayer(input.tag);
  } catch (err) {
    const code = toApiError(err).code;
    return { ok: false, error: code === 'notFound' || code === 'invalidTag' ? 'tag' : 'unavailable' };
  }
  const playerTag = `#${normalizeTag(player.tag)}`;

  const hash = ipHash(input.ip);
  const since = new Date(Date.now() - 86_400_000);
  const fromHere = await prisma.giveawayEntry.count({
    where: { giveaway: GIVEAWAY.id, ipHash: hash, createdAt: { gte: since } },
  });
  if (fromHere >= ENTRIES_PER_IP_PER_DAY) return { ok: false, error: 'tooMany' };

  const taken = await prisma.giveawayEntry.findFirst({
    where: { giveaway: GIVEAWAY.id, OR: [{ playerTag }, { email }] },
    select: { playerTag: true },
  });
  if (taken) return { ok: false, error: taken.playerTag === playerTag ? 'tagTaken' : 'emailTaken' };

  // A referral counts only from an existing entry, and never from your own.
  let referredBy: string | null = null;
  if (isCode(input.ref)) {
    const referrer = await prisma.giveawayEntry.findUnique({ where: { code: input.ref }, select: { code: true, ipHash: true } });
    if (referrer && referrer.ipHash !== hash) referredBy = referrer.code;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode(randomInt);
    try {
      await prisma.giveawayEntry.create({
        data: { giveaway: GIVEAWAY.id, code, playerTag, playerName: player.name, email, referredBy, ipHash: hash },
      });
      return { ok: true, code };
    } catch (err) {
      // A code collision retries; a tag or email that raced in is reported as taken.
      const target = String((err as { meta?: { target?: unknown } }).meta?.target ?? '');
      if (target.includes('code')) continue;
      if (target.includes('player_tag') || target.includes('playerTag')) return { ok: false, error: 'tagTaken' };
      if (target.includes('email')) return { ok: false, error: 'emailTaken' };
      throw err;
    }
  }
  return { ok: false, error: 'unavailable' };
}

export interface EntryStatus {
  code: string;
  playerName: string;
  playerTag: string;
  discord: boolean;
  followed: Record<FollowPlatform, boolean>;
  entries: EntryCounts;
}

const followCount = (e: { followedInstagram: boolean; followedTiktok: boolean; followedYoutube: boolean }) =>
  Number(e.followedInstagram) + Number(e.followedTiktok) + Number(e.followedYoutube);

/** What the entrant's own page shows. Never the email. */
export async function status(code: string): Promise<EntryStatus | null> {
  if (!isCode(code)) return null;
  const prisma = getPrisma();
  if (!prisma) return null;
  const entry = await prisma.giveawayEntry.findUnique({ where: { code } });
  if (!entry || entry.giveaway !== GIVEAWAY.id) return null;
  const referrals = await prisma.giveawayEntry.count({ where: { giveaway: GIVEAWAY.id, referredBy: code } });
  return {
    code,
    playerName: entry.playerName,
    playerTag: entry.playerTag,
    discord: Boolean(entry.discordUserId),
    followed: { youtube: entry.followedYoutube, tiktok: entry.followedTiktok, instagram: entry.followedInstagram },
    entries: entriesFor(Boolean(entry.discordUserId), referrals, followCount(entry)),
  };
}

const FOLLOW_COLUMN = {
  youtube: 'followedYoutube',
  tiktok: 'followedTiktok',
  instagram: 'followedInstagram',
} as const satisfies Record<FollowPlatform, string>;

/** "I followed": taken on the entrant's word, since no platform can be asked. */
export async function claimFollow(code: string, platform: FollowPlatform): Promise<boolean> {
  if (!isOpen() || !isCode(code) || !(platform in FOLLOW_COLUMN)) return false;
  const prisma = getPrisma();
  if (!prisma) return false;
  const { count } = await prisma.giveawayEntry.updateMany({
    where: { code, giveaway: GIVEAWAY.id },
    data: { [FOLLOW_COLUMN[platform]]: true },
  });
  return count === 1;
}

export type DiscordResult = 'confirmed' | 'already' | 'unknownCode' | 'otherAccount' | 'closed';

/** `/giveaway code:<CODE>` in the BrawlZone server: one Discord account per entry. */
export async function confirmDiscord(code: string, discordUserId: string): Promise<DiscordResult> {
  if (!isOpen()) return 'closed';
  const prisma = getPrisma();
  if (!prisma || !isCode(code)) return 'unknownCode';
  const entry = await prisma.giveawayEntry.findUnique({ where: { code } });
  if (!entry || entry.giveaway !== GIVEAWAY.id) return 'unknownCode';
  if (entry.discordUserId === discordUserId) return 'already';
  if (entry.discordUserId) return 'otherAccount';
  const used = await prisma.giveawayEntry.findFirst({ where: { giveaway: GIVEAWAY.id, discordUserId } });
  if (used) return 'otherAccount';
  await prisma.giveawayEntry.update({ where: { code }, data: { discordUserId } });
  return 'confirmed';
}

export interface LeaderRow {
  playerName: string;
  points: number;
}

/**
 * The public top recruiters: in-game names and points only, never tags or
 * emails. Read by the static page, so at most every few minutes.
 */
export async function leaderboard(limit = 10): Promise<LeaderRow[]> {
  const prisma = getPrisma();
  if (!prisma) return [];
  const rows = await prisma.giveawayEntry
    .findMany({
      where: { giveaway: GIVEAWAY.id },
      select: {
        code: true,
        playerName: true,
        discordUserId: true,
        referredBy: true,
        createdAt: true,
        followedInstagram: true,
        followedTiktok: true,
        followedYoutube: true,
      },
    })
    .catch(() => []);
  const referrals = new Map<string, number>();
  for (const r of rows) if (r.referredBy) referrals.set(r.referredBy, (referrals.get(r.referredBy) ?? 0) + 1);
  return rank(
    rows.map((r) => ({
      code: r.code,
      playerName: r.playerName,
      points: entriesFor(Boolean(r.discordUserId), referrals.get(r.code) ?? 0, followCount(r)).total,
      enteredAt: r.createdAt.getTime(),
    })),
  )
    .slice(0, limit)
    .map(({ playerName, points }) => ({ playerName, points }));
}
