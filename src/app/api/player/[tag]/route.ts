import type { NextRequest } from 'next/server';

import { getPlayer } from '@/lib/bs-api';
import { errorResponse, okResponse } from '@/lib/route-helpers';

/**
 * GET /api/player/:tag
 *
 * `tag` arrives without the leading "#"; the API client re-adds and encodes it.
 * The bearer token lives only in this process — never in the response.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tag: string }> },
) {
  const { tag } = await params;

  try {
    return okResponse(await getPlayer(tag), 60);
  } catch (err) {
    return errorResponse(err);
  }
}
