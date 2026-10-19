import { NextResponse } from 'next/server';

import { YOUTUBE_REDIRECT_URI, YOUTUBE_TOKEN_URL } from '@/lib/youtube';

/**
 * Trades Google's authorisation code for a refresh token and shows it once,
 * for the same reason /api/tiktok/callback does: the token has to end up in a
 * file on the box, and this container has none that survives a deploy.
 * Confirmation at the top, credential well below it, `no-store` throughout.
 */
export const dynamic = 'force-dynamic';

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function text(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const error = url.searchParams.get('error');
  if (error) return text(`Google refused the authorisation: ${error}`, 400);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('youtube_oauth_state='))
    ?.slice('youtube_oauth_state='.length);

  if (!code) return text('No authorisation code in the callback.', 400);
  if (!state || !expected || state !== expected) {
    return text('State mismatch — start again from /api/youtube/auth?key=…', 400);
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return text('YouTube credentials are not set on the server.', 500);

  const res = await fetch(YOUTUBE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    cache: 'no-store',
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: YOUTUBE_REDIRECT_URI,
    }),
  });

  const body = (await res.json()) as TokenResponse;
  if (!res.ok || body.error || !body.refresh_token) {
    return text(`Token exchange failed (HTTP ${res.status}): ${body.error ?? ''} ${body.error_description ?? ''}`, 502);
  }

  return text(
    [
      '  BrawlZone is now authorised to upload videos to this YouTube channel.',
      '',
      '  Scope granted: ' + (body.scope ?? 'unknown'),
      '',
      '  --- STOP RECORDING HERE ---------------------------------------',
      '',
      '  Everything below this line is a working credential.',
      '  Do not film it, screenshot it, or paste it anywhere public.',
      '',
      '',
      '',
      'Run this on the box to store it, then close this tab:',
      '',
      `umask 077; cat > ~/.brawlzone-youtube.json <<'JSON'`,
      JSON.stringify({ refresh_token: body.refresh_token, scope: body.scope, authorised_at: new Date().toISOString() }, null, 2),
      'JSON',
      '',
      'This page is not cached and the token is not stored anywhere on the site.',
    ].join('\n'),
  );
}
