import { NextResponse } from 'next/server';

import { YOUTUBE_AUTH_URL, YOUTUBE_REDIRECT_URI, YOUTUBE_SCOPES, youtubeSetupKeyValid } from '@/lib/youtube';

/**
 * Starts the one-time authorisation, visited by hand with
 * `?key=$YOUTUBE_SETUP_KEY`. Mirrors /api/tiktok/auth, state cookie included.
 *
 * `access_type=offline` is what returns a refresh token at all, and
 * `prompt=consent` makes Google return one again on a second run -- without
 * it a re-authorisation silently comes back with an access token only.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!youtubeSetupKeyValid(url)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) {
    return new NextResponse('YOUTUBE_CLIENT_ID is not set on the server.', { status: 500 });
  }

  const state = crypto.randomUUID();
  const authorize = new URL(YOUTUBE_AUTH_URL);
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', YOUTUBE_REDIRECT_URI);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('scope', YOUTUBE_SCOPES);
  authorize.searchParams.set('access_type', 'offline');
  authorize.searchParams.set('prompt', 'consent');
  authorize.searchParams.set('state', state);

  const response = NextResponse.redirect(authorize.toString());
  response.cookies.set('youtube_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/youtube',
    maxAge: 600,
  });
  return response;
}
