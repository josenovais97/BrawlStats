import { type DayTally, summarize, tallyBucket } from '@/lib/brawldle-tally';
import { getPrisma } from '@/lib/prisma';

/**
 * Everybody's results for today's challenge (2026-10-23).
 *
 * GET returns the day's counts per puzzle; POST adds one finished puzzle. No
 * player, address or device is stored, only counters. The addresses kept in
 * memory below exist to stop one caller from stuffing the counts, and are
 * forgotten when the day changes or the server restarts.
 */

export const dynamic = 'force-dynamic';

const today = () => new Date().toISOString().slice(0, 10);

/* Read often (every finished board, every page view), written rarely: half a minute is fresh enough. */
let cached: { day: string; at: number; tally: DayTally } | null = null;

async function read(day: string): Promise<DayTally | null> {
  if (cached && cached.day === day && Date.now() - cached.at < 30_000) return cached.tally;
  const prisma = getPrisma();
  if (!prisma) return null;
  const rows = await prisma.dailyChallengeTally.findMany({
    where: { day: new Date(`${day}T00:00:00Z`) },
    select: { mode: true, guesses: true, count: true },
  });
  cached = { day, at: Date.now(), tally: summarize(rows) };
  return cached.tally;
}

export async function GET() {
  const day = today();
  const tally = await read(day).catch(() => null);
  if (!tally) return Response.json({ error: 'unavailable' }, { status: 503 });
  return Response.json({ date: day, tally }, { headers: { 'cache-control': 'no-store' } });
}

/* Three puzzles a day, plus slack for a second browser behind the same address (a family, a school). */
const PER_ADDRESS = 12;
let seenDay = '';
const seen = new Map<string, number>();

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { mode?: unknown; solved?: unknown; guesses?: unknown } | null;
  const mode = typeof body?.mode === 'string' ? body.mode : '';
  const bucket = tallyBucket(mode, body?.solved === true, Number(body?.guesses));
  if (bucket === null) return Response.json({ error: 'not a result' }, { status: 400 });

  const day = today();
  if (seenDay !== day) {
    seen.clear();
    seenDay = day;
  }
  const who =
    request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const n = (seen.get(who) ?? 0) + 1;
  seen.set(who, n);
  // Accepted and ignored, so a stuffing script learns nothing from the answer.
  if (n > PER_ADDRESS) return Response.json({ ok: true });

  const prisma = getPrisma();
  if (!prisma) return Response.json({ error: 'unavailable' }, { status: 503 });
  const key = { day: new Date(`${day}T00:00:00Z`), mode, guesses: bucket };
  await prisma.dailyChallengeTally.upsert({
    where: { day_mode_guesses: key },
    create: { ...key, count: 1 },
    update: { count: { increment: 1 } },
  });
  cached = null;
  return Response.json({ ok: true });
}
