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
/**
 * `video.list` is what lets the site show its own newest post. It is a read of
 * our own account and nothing else, but it is a separate scope and has to be
 * enabled in the TikTok portal before a re-authorisation will grant it --
 * asking for a scope the app is not configured for fails the whole consent
 * screen rather than dropping that one scope.
 */
export const TIKTOK_SCOPES = 'user.info.basic,video.upload,video.list';

/**
 * Guards the two OAuth routes.
 *
 * Without it, a stranger who found the path could start an authorisation
 * against their own account and be shown their own tokens. Harmless to this
 * site, but a page that hands out credentials to anyone who asks is not one
 * worth having.
 *
 * Its own variable rather than `CRON_SECRET`, which was the first attempt and
 * could never have worked: that secret is base64 and contains `+`, which a
 * query string decodes as a space, so the comparison failed every time and the
 * route answered 404 to the one person entitled to use it. A key that travels
 * in a URL has to be URL-safe, and reusing one that was only ever sent in a
 * header does not make it so.
 *
 * Short-lived by intention. It exists to authorise an account once; delete the
 * line from `.env.production` afterwards and the routes close themselves.
 */
export function setupKeyValid(url: URL): boolean {
  const secret = process.env.TIKTOK_SETUP_KEY;
  if (!secret) return false;
  return url.searchParams.get('key') === secret;
}
