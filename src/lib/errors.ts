/**
 * A single error vocabulary shared by the API client, the route handlers and
 * the UI, so every failure surface can render a friendly message instead of a
 * raw upstream payload.
 */

export type ApiErrorCode =
  | 'invalidTag'
  | 'notFound'
  | 'rateLimited'
  | 'unauthorized'
  | 'upstreamDown'
  | 'timeout'
  | 'notConfigured'
  | 'unknown';

export class BrawlApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message?: string, status?: number) {
    super(message ?? ERROR_COPY[code].title);
    this.name = 'BrawlApiError';
    this.code = code;
    this.status = status ?? DEFAULT_STATUS[code];
  }
}

const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  invalidTag: 400,
  notFound: 404,
  rateLimited: 429,
  unauthorized: 401,
  upstreamDown: 502,
  timeout: 504,
  notConfigured: 500,
  unknown: 500,
};

/** Human-facing copy. Kept here so routes and pages never disagree. */
export const ERROR_COPY: Record<ApiErrorCode, { title: string; detail: string }> = {
  invalidTag: {
    title: 'That tag does not look right',
    detail:
      'Tags are made of the characters 0289PYLQGRJCUV, like #2V0UL0GQV8. Check for typos and try again.',
  },
  notFound: {
    title: 'Nothing found for that tag',
    detail:
      'No player or club exists with this tag. Double-check it in-game under your profile.',
  },
  rateLimited: {
    title: 'Too many requests',
    detail: 'The Brawl Stars API is rate-limiting us right now. Give it a minute and retry.',
  },
  unauthorized: {
    title: 'API key rejected',
    detail:
      'The server API key is missing, expired, or not whitelisted for the RoyaleAPI proxy IP. See the README.',
  },
  upstreamDown: {
    title: 'Brawl Stars API unavailable',
    detail:
      'The game API or the proxy is not responding. This usually clears up on its own — try again shortly.',
  },
  timeout: {
    title: 'Request timed out',
    detail: 'The Brawl Stars API took too long to answer. Try again in a moment.',
  },
  notConfigured: {
    title: 'Server not configured',
    detail: 'BRAWL_STARS_API_KEY is not set on the server. See the README for setup steps.',
  },
  unknown: {
    title: 'Something went wrong',
    detail: 'An unexpected error occurred while talking to the Brawl Stars API.',
  },
};

/** Narrows an unknown thrown value to a BrawlApiError, defaulting to `unknown`. */
export function toApiError(err: unknown): BrawlApiError {
  if (err instanceof BrawlApiError) return err;
  if (err instanceof Error && err.name === 'AbortError') {
    return new BrawlApiError('timeout');
  }
  return new BrawlApiError('unknown', err instanceof Error ? err.message : undefined);
}
