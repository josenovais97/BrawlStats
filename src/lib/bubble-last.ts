import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/prisma';

/**
 * The last good answer per tag for the Bubble app's account reads
 * (2026-11-11).
 *
 * Supercell takes the game API down for every update. /api/bubble/roster and
 * /api/bubble/me answered every failure with "not found", and the app reads
 * that as a tag that does not exist: it reopened the tag field, said "No
 * account with that tag", showed the "Add your player tag" card and dropped
 * the player's icon, and the My rank widget asked for a tag too. Serving the
 * last good answer during an outage keeps the account in place, for every
 * app version, without an app update.
 */

type Kind = 'roster' | 'me';

const MAX_AGE_MS = 30 * 86_400_000;

export async function rememberBubble(kind: Kind, tag: string, value: unknown): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  const key = `${kind}:${tag}`;
  const json = value as Prisma.InputJsonValue;
  await prisma.bubbleLastRead.upsert({
    where: { key },
    create: { key, value: json },
    update: { value: json, savedAt: new Date() },
  });
  // Now and then, drop accounts nobody has opened in two months.
  if (Math.random() < 0.01) {
    await prisma.bubbleLastRead.deleteMany({ where: { savedAt: { lt: new Date(Date.now() - 60 * 86_400_000) } } });
  }
}

/** The saved answer, or null when there is none or it is over 30 days old. */
export async function lastBubble<T>(kind: Kind, tag: string): Promise<T | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  try {
    const row = await prisma.bubbleLastRead.findUnique({ where: { key: `${kind}:${tag}` } });
    if (!row || Date.now() - row.savedAt.getTime() > MAX_AGE_MS) return null;
    return row.value as T;
  } catch {
    return null;
  }
}
