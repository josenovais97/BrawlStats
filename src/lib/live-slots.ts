import type { BSRotationSlot } from '@/types/brawlstars';
import { logTime } from '@/lib/ranked-season';

export interface LiveSlot {
  mode: string;
  map: string;
  /** Hours left, rounded up; null when the end time is unreadable. */
  hoursLeft: number | null;
}

/** The rotation's slots that are on right now, with the hours each has left. */
export function liveSlots(slots: BSRotationSlot[], now = Date.now()): LiveSlot[] {
  const out: LiveSlot[] = [];
  for (const s of slots) {
    if (!s.event?.map) continue;
    const start = logTime(s.startTime);
    const end = logTime(s.endTime);
    if (start !== null && start > now) continue;
    if (end !== null && end <= now) continue;
    out.push({ mode: s.event.mode, map: s.event.map, hoursLeft: end === null ? null : Math.max(1, Math.ceil((end - now) / 3_600_000)) });
  }
  return out;
}
