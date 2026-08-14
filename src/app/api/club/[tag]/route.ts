import type { NextRequest } from 'next/server';

import { getClub } from '@/lib/bs-api';
import { errorResponse, okResponse } from '@/lib/route-helpers';

/** GET /api/club/:tag — club details including the full member list. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tag: string }> },
) {
  const { tag } = await params;

  try {
    return okResponse(await getClub(tag), 60);
  } catch (err) {
    return errorResponse(err);
  }
}
