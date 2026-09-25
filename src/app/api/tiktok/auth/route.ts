import { NextResponse } from 'next/server';

import {
  TIKTOK_AUTH_URL,
  TIKTOK_REDIRECT_URI,
  TIKTOK_SCOPES,
  setupKeyValid,
} from '@/lib/tiktok';

/**
 * Starts the one-time authorisation.
 *
 * Visited by hand, once, with `?key=$TIKTOK_SETUP_KEY`. It redirects to TikTok's
 * consent screen; the answer comes back to `/api/tiktok/callback`.
 *
 * `state` is required by the protocol as CSRF protection and is checked on the
 * way back. It is random per request and carried in a cookie rather than
 * stored server-side, because the app has nowhere to store it — see lib/tiktok
 * for why nothing here keeps state.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!setupKeyValid(url)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return new NextResponse('TIKTOK_CLIENT_KEY is not set on the server.', { status: 500 });
  }

  const state = crypto.randomUUID();
  const authorize = new URL(TIKTOK_AUTH_URL);
  authorize.searchParams.set('client_key', clientKey);
  authorize.searchParams.set('scope', TIKTOK_SCOPES);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', TIKTOK_REDIRECT_URI);
  authorize.searchParams.set('state', state);

  const response = NextResponse.redirect(authorize.toString());
  response.cookies.set('tiktok_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/tiktok',
    maxAge: 600,
  });
  return response;
}
