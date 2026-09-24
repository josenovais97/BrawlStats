import { NextResponse } from 'next/server';

import { TIKTOK_REDIRECT_URI, TIKTOK_TOKEN_URL } from '@/lib/tiktok';

/**
 * Receives TikTok's authorisation code and trades it for tokens.
 *
 * It then prints them, which looks wrong and is the least-bad option
 * available. The refresh token has to end up in a file on the box that the
 * daily job can read and rewrite, and this route runs inside the app
 * container, which has no such file and is replaced on every deploy. Writing
 * it into the image would lose it within the hour.
 *
 * So the exchange happens here, where the client secret already lives, and the
 * result is shown once to the person who just authorised — no third party ever
 * sees this page, because reaching it requires the state cookie this session
 * set moments earlier. They paste the refresh token into the box's state file
 * and never come back. From then on the box rotates it alone.
 *
 * `no-store` on the response, so the one page on this site that prints a
 * credential is never held in a cache or a CDN.
 */
export const dynamic = 'force-dynamic';

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  scope?: string;
  expires_in?: number;
  refresh_expires_in?: number;
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
  if (error) {
    return text(`TikTok refused the authorisation: ${error} ${url.searchParams.get('error_description') ?? ''}`, 400);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('tiktok_oauth_state='))
    ?.slice('tiktok_oauth_state='.length);

  if (!code) return text('No authorisation code in the callback.', 400);
  // Both halves must exist. A missing cookie means this was not started by the
  // auth route, which is exactly the case the check is for.
  if (!state || !expected || state !== expected) {
    return text('State mismatch — start again from /api/tiktok/auth?key=…', 400);
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return text('TikTok credentials are not set on the server.', 500);
  }

  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    cache: 'no-store',
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: TIKTOK_REDIRECT_URI,
    }),
  });

  const body = (await res.json()) as TokenResponse;
  if (!res.ok || body.error || !body.refresh_token) {
    return text(
      `Token exchange failed (HTTP ${res.status}): ${body.error ?? ''} ${body.error_description ?? ''}`,
      502,
    );
  }

  return text(
    [
      'Authorised. Copy the line below onto the box, then close this tab.',
      '',
      `ssh brawlzone 'umask 077; cat > ~/.brawlzone-tiktok.json' <<'JSON'`,
      JSON.stringify(
        {
          open_id: body.open_id,
          refresh_token: body.refresh_token,
          scope: body.scope,
          authorised_at: new Date().toISOString(),
        },
        null,
        2,
      ),
      'JSON',
      '',
      `Scope granted: ${body.scope ?? 'unknown'}`,
      `Refresh token valid for ${Math.round((body.refresh_expires_in ?? 0) / 86400)} days.`,
      '',
      'This page is not cached and the token is not stored anywhere on the site.',
    ].join('\n'),
  );
}
