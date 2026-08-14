import type { NextRequest } from 'next/server';

import { getBattleLog } from '@/lib/bs-api';
import { errorResponse, okResponse } from '@/lib/route-helpers';

/** GET /api/player/:tag/battlelog — last ~25 battles. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tag: string }> },
) {
  const { tag } = await params;

  try {
    return okResponse(await getBattleLog(tag), 60);
  } catch (err) {
    return errorResponse(err);
  }
}
