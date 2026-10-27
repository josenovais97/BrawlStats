import { FOLLOW_PLATFORMS, GIVEAWAY_PUBLIC, type FollowPlatform } from '@/lib/giveaway';
import { claimFollow } from '@/lib/giveaway-data';

/** POST /api/giveaway/follow {code, platform}: the follow point, on the entrant's word. */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!GIVEAWAY_PUBLIC) return Response.json({ ok: false }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { code?: unknown; platform?: unknown };
  const platform = String(body.platform ?? '') as FollowPlatform;
  if (!FOLLOW_PLATFORMS.includes(platform)) return Response.json({ ok: false }, { status: 400 });
  const ok = await claimFollow(String(body.code ?? ''), platform);
  return Response.json({ ok }, { status: ok ? 200 : 400, headers: { 'cache-control': 'no-store' } });
}
