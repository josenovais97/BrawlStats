import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes /rewards in every language at once (2026-11-06).
 *
 * The page reads /social/rewards/latest.json through a 5-minute data cache
 * inside a 5-minute page cache, so a new reward took 10+ minutes to appear,
 * while brawlzone-rewards sent its push notification the same second: people
 * tapped "New free reward!" and landed on the old list. The script now calls
 * this right after writing the feed, then waits until every language's page
 * shows the reward before it notifies or posts anywhere.
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://brawlzone.net/api/cron/revalidate-rewards
 */

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: without a secret this would be an open "re-render" button.
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  revalidatePath('/rewards');
  revalidatePath('/[lang]/rewards', 'page');
  return NextResponse.json({ ok: true, revalidated: ['/rewards', '/[lang]/rewards'] });
}
