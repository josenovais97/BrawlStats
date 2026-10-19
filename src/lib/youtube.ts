/**
 * YouTube Shorts uploads (2026-10-19): the daily TikTok slides also go to the
 * channel as Shorts, from the box, through YouTube Data API v3.
 *
 * Same shape as lib/tiktok: the app only hosts the one-time authorisation,
 * because the client secret lives in its environment. The refresh token is
 * shown once and stored on the box (~/.brawlzone-youtube.json), where the
 * upload job reads it. Google refresh tokens do not rotate, so nothing writes
 * it back.
 *
 * Until the API project passes YouTube's audit, every upload from it is
 * locked private -- that is YouTube's rule for unaudited projects, not a
 * setting here.
 */
export const YOUTUBE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const YOUTUBE_REDIRECT_URI = 'https://brawlzone.net/api/youtube/callback';
/** Upload only: no reading of the channel, its comments or anyone's data. */
export const YOUTUBE_SCOPES = 'https://www.googleapis.com/auth/youtube.upload';

/** Opens the two auth routes while YOUTUBE_SETUP_KEY is set; see lib/tiktok. */
export function youtubeSetupKeyValid(url: URL): boolean {
  const secret = process.env.YOUTUBE_SETUP_KEY;
  if (!secret) return false;
  return url.searchParams.get('key') === secret;
}
