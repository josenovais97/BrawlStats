import { getPrisma } from '@/lib/prisma';

/**
 * POST /api/push/subscribe {subscription, lang}: remember a browser that wants
 * to hear about new free rewards. DELETE {endpoint}: forget it.
 *
 * Only push-service endpoints over https are kept, so this cannot be used to
 * make the box POST to arbitrary addresses. `/api/` is disallowed for
 * crawlers, and Cloudflare's per-IP limit sits in front.
 */
export const dynamic = 'force-dynamic';

const LANGS = new Set(['en', 'es', 'pt']);
const b64u = /^[A-Za-z0-9_-]+$/;

function valid(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    lang?: unknown;
  };
  const s = body.subscription;
  const p256dh = s?.keys?.p256dh, auth = s?.keys?.auth;
  if (!valid(s?.endpoint) || typeof p256dh !== 'string' || typeof auth !== 'string' || !b64u.test(p256dh) || !b64u.test(auth) || p256dh.length > 200 || auth.length > 50) {
    return Response.json({ ok: false }, { status: 400 });
  }
  const lang = typeof body.lang === 'string' && LANGS.has(body.lang) ? body.lang : 'en';
  const prisma = getPrisma();
  if (!prisma) return Response.json({ ok: false }, { status: 503 });
  await prisma.pushSubscription.upsert({
    where: { endpoint: s!.endpoint as string },
    create: { endpoint: s!.endpoint as string, p256dh, auth, lang },
    update: { p256dh, auth, lang },
  });
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { endpoint?: unknown };
  if (!valid(body.endpoint)) return Response.json({ ok: false }, { status: 400 });
  const prisma = getPrisma();
  if (!prisma) return Response.json({ ok: false }, { status: 503 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint } });
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
