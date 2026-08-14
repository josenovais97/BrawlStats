import 'server-only';

import { NextResponse } from 'next/server';

import { ERROR_COPY, toApiError } from '@/lib/errors';

/**
 * Turns anything thrown by the API client into a consistent JSON envelope.
 * Clients only ever see our vocabulary, never an upstream body.
 */
export function errorResponse(err: unknown): NextResponse {
  const apiError = toApiError(err);
  const copy = ERROR_COPY[apiError.code];

  return NextResponse.json(
    {
      error: {
        code: apiError.code,
        title: copy.title,
        detail: copy.detail,
      },
    },
    {
      status: apiError.status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

/** Success envelope with a short shared-cache window matching the API client. */
export function okResponse<T>(data: T, maxAge = 60): NextResponse {
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 5}`,
    },
  });
}

/** Shape returned by every route on failure. */
export interface ApiErrorEnvelope {
  error: { code: string; title: string; detail: string };
}
