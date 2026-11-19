import 'server-only';

import { randomInt } from 'node:crypto';

import { getPrisma } from '@/lib/prisma';

/**
 * Friend invites from the Bubble app (1.42).
 *
 * A player taps "Invite a friend" and shares brawlzone.net/bubble/invite#CODE.
 * The page shows who invited you and sends you to the app (or to Google Play,
 * with the code as the install referrer). The app that opens it adds the
 * inviter to its friends and records the accept here, and the inviter's app
 * picks it up on its next hourly check and adds them back: both end up on
 * each other's ladder without typing a tag.
 *
 * One code per inviting tag, so every link a player ever shared keeps
 * working. Codes skip look-alike letters (no 0/O, 1/I/L).
 */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE = /^[2-9A-HJKMNP-Z]{8}$/;
/** Enough for any real friend group; stops a public link becoming a list of strangers. */
const MAX_ACCEPTS = 50;

function newCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export async function inviteCode(inviter: string): Promise<string | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const found = await prisma.bubbleInvite.findUnique({ where: { inviter } });
  if (found) return found.code;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const row = await prisma.bubbleInvite.create({ data: { code: newCode(), inviter } });
      return row.code;
    } catch {
      // A code collision, or the same tag created a moment ago in parallel.
      const again = await prisma.bubbleInvite.findUnique({ where: { inviter } });
      if (again) return again.code;
    }
  }
  return null;
}

export async function inviter(code: string): Promise<string | null> {
  const prisma = getPrisma();
  if (!prisma || !CODE.test(code)) return null;
  const row = await prisma.bubbleInvite.findUnique({ where: { code } });
  return row?.inviter ?? null;
}

/** Records that `invitee` opened `code` in the app; returns the inviter's tag. */
export async function accept(code: string, invitee: string): Promise<string | null> {
  const prisma = getPrisma();
  if (!prisma || !CODE.test(code)) return null;
  const row = await prisma.bubbleInvite.findUnique({ where: { code } });
  if (!row) return null;
  if (row.inviter === invitee) return row.inviter;
  const count = await prisma.bubbleInviteAccept.count({ where: { code } });
  if (count < MAX_ACCEPTS) {
    await prisma.bubbleInviteAccept.upsert({
      where: { code_invitee: { code, invitee } },
      create: { code, invitee },
      update: {},
    });
  }
  return row.inviter;
}

/** Everyone who opened the code in the last 30 days, oldest first. */
export async function accepted(code: string): Promise<{ tag: string; at: string }[]> {
  const prisma = getPrisma();
  if (!prisma || !CODE.test(code)) return [];
  const rows = await prisma.bubbleInviteAccept.findMany({
    where: { code, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    orderBy: { createdAt: 'asc' },
    take: MAX_ACCEPTS,
  });
  return rows.map((r) => ({ tag: r.invitee, at: r.createdAt.toISOString() }));
}
