import { getEventRotation } from '@/lib/bs-api';
import { errorResponse, okResponse } from '@/lib/route-helpers';

/** GET /api/events — current event rotation with start/end times per slot. */
export async function GET() {
  try {
    return okResponse(await getEventRotation(), 120);
  } catch (err) {
    return errorResponse(err);
  }
}
