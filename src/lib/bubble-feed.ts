import 'server-only';

import { getPlayer } from '@/lib/bs-api';
import { parsePostId, type FeedReaction } from '@/lib/bubble-feed-id';
import { isOptedOut } from '@/lib/opted-out';
import { getPrisma } from '@/lib/prisma';

/**
 * Reactions in the Bubble app's squad feed (1.42).
 *
 * The feed's posts are made on each phone; only reactions live here, so a
 * friend's 🔥 on your rank-up reaches your phone. A reaction is one of six
 * fixed emoji, and the name shown with it comes from the official API rather
 * than from the app, so nothing anyone types ever reaches another player.
 * One reaction per player per post; kept 30 days.
 */

const KEEP_DAYS = 30;
/** Far above anyone tapping emoji on a few friends' posts; stops a script. */
const MAX_PER_DAY = 300;

export interface FeedReactionRow {
  tag: string;
  name: string;
  r: string;
}

/** Sets (or with `reaction` null, removes) `tag`'s reaction on `post`. */
export async function react(post: string, tag: string, reaction: FeedReaction | null): Promise<'ok' | 'bad' | 'busy'> {
  const prisma = getPrisma();
  const parsed = parsePostId(post);
  if (!prisma || !parsed) return 'bad';
  if (isOptedOut(tag) || parsed.tags.some((t) => isOptedOut(t))) return 'bad';
  if (reaction === null) {
    await prisma.bubbleReaction.deleteMany({ where: { post, tag } });
    return 'ok';
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await prisma.bubbleReaction.count({ where: { tag, createdAt: { gte: since } } })) >= MAX_PER_DAY) return 'busy';
  let name: string;
  try {
    name = (await getPlayer(tag)).name.slice(0, 40);
  } catch {
    return 'bad';
  }
  await prisma.bubbleReaction.upsert({
    where: { post_tag: { post, tag } },
    create: { post, tag, subject: parsed.tags[0], name, emoji: reaction },
    update: { emoji: reaction, name, createdAt: new Date() },
  });
  // Housekeeping now and then, rather than a timer for a table this small.
  if (Math.random() < 0.02) {
    await prisma.bubbleReaction
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }
  return 'ok';
}

/** Everyone's reactions on these posts. */
export async function reactionsFor(posts: string[]): Promise<Record<string, FeedReactionRow[]>> {
  const prisma = getPrisma();
  const ids = posts.filter((p) => parsePostId(p) !== null);
  const out: Record<string, FeedReactionRow[]> = {};
  if (!prisma || ids.length === 0) return out;
  const rows = await prisma.bubbleReaction.findMany({ where: { post: { in: ids } }, orderBy: { createdAt: 'asc' } });
  for (const row of rows) (out[row.post] ??= []).push({ tag: row.tag, name: row.name, r: row.emoji });
  return out;
}

/** Other players' reactions on posts about `subject` since a moment: the app's "Leo reacted 🔥" notification. */
export async function reactionsAbout(subject: string, since: Date) {
  const prisma = getPrisma();
  if (!prisma || isOptedOut(subject)) return [];
  const rows = await prisma.bubbleReaction.findMany({
    where: { subject, createdAt: { gt: since }, NOT: { tag: subject } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return rows.map((row) => ({ post: row.post, tag: row.tag, name: row.name, r: row.emoji, at: row.createdAt.getTime() }));
}
