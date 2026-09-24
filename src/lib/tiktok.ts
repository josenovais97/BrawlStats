import 'server-only';

/**
 * Shared constants for the TikTok integration.
 *
 * The site's part is small and deliberately so: it holds the two OAuth
 * endpoints, because a redirect URI has to live on a real domain, and nothing
 * else. Everything that happens every day — refreshing the token, rendering
 * the caption, sending the post — runs from `deploy/bin/brawlzone-tiktok` on
 * the box, beside the other scheduled jobs, where it can keep state.
 *
 * That split is forced by one detail of the protocol: TikTok rotates the
 * refresh token on every use. Whatever holds it must be able to write it back,
 * and the app container cannot — it is rebuilt on every deploy and its
 * filesystem goes with it.
 */

export const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
export const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

export const TIKTOK_REDIRECT_URI = 'https://brawlzone.net/api/tiktok/callback';

/**
 * `user.info.basic` identifies which account a token belongs to;
 * `video.upload` is what sends the daily card. `video.publish` is absent on
 * purpose — it is only useful after TikTok's audit, and an unused scope in a
 * review submission delays the review.
 */
export const TIKTOK_SCOPES = 'user.info.basic,video.upload';

/**
 * Guards the two OAuth routes.
 *
 * Without it, a stranger who found the path could start an authorisation
 * against their own account and be shown their own tokens. Harmless to this
 * site, but a page that hands out credentials to anyone who asks is not a page
 * worth having. Shares `CRON_SECRET` rather than adding a second one: it is
 * the same class of thing — a key for an operation only the operator performs.
 */
export function setupKeyValid(url: URL): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return url.searchParams.get('key') === secret;
}
