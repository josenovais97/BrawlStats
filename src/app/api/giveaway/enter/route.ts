import { GIVEAWAY_PUBLIC } from '@/lib/giveaway';
import { enter } from '@/lib/giveaway-data';

/**
 * POST /api/giveaway/enter {tag, email, consent, ref}
 *
 * The giveaway form's one write. All the rules live in `lib/giveaway-data`;
 * this only reads the body and the address. `/api/` is disallowed for
 * crawlers already, and Cloudflare's per-IP limit sits in front.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!GIVEAWAY_PUBLIC) return Response.json({ ok: false, error: 'closed' }, { status: 404 });
  let body: { tag?: unknown; email?: unknown; consent?: unknown; ref?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'tag' }, { status: 400 });
  }
  const ip =
    request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const result = await enter({
    tag: String(body.tag ?? ''),
    email: String(body.email ?? ''),
    consent: body.consent === true,
    ref: typeof body.ref === 'string' ? body.ref : null,
    ip,
  });
  return Response.json(result, { status: result.ok ? 200 : 400, headers: { 'cache-control': 'no-store' } });
}
