/**
 * The roast story image for the Bubble app (1.44, 2026-11-23): the same image
 * as /roast/<tag>/story/<lang>, at an address Cloudflare's "challenge
 * expensive pages" rule does not cover. That rule guards every /roast/ path,
 * and an app's HTTP client cannot solve a challenge, so the app got the
 * challenge page instead of a PNG and every in-app roast failed. Rate-limited
 * on its own budget (lib/hot-path-limit), taken from /roast/'s.
 */
export { GET } from '@/app/roast/[tag]/story/[lang]/route';

export const dynamic = 'force-dynamic';
