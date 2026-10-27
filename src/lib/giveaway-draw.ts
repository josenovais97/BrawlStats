import { createHash, createHmac } from 'node:crypto';

/**
 * The giveaway draw (see lib/giveaway): kept apart from the rules because it
 * needs Node's crypto, and the rules also run in the browser.
 */
export interface Ticket {
  code: string;
  playerTag: string;
  entries: number;
}

/**
 * The winner, from the beacon's randomness and the closed entry list.
 *
 * Tickets are sorted by code so the list's order cannot be chosen; the HMAC
 * of the list digest under the beacon value picks a point on the line of all
 * entries, so a ticket with 5 entries is 5 times as likely as one with 1.
 */
export function drawWinner(tickets: Ticket[], randomnessHex: string): { winner: Ticket; digest: string; point: number; total: number } {
  if (!tickets.length) throw new Error('no tickets');
  const sorted = [...tickets].sort((a, b) => a.code.localeCompare(b.code));
  const digest = createHash('sha256')
    .update(sorted.map((t) => `${t.code}:${t.playerTag}:${t.entries}`).join('\n'))
    .digest('hex');
  const total = sorted.reduce((s, t) => s + t.entries, 0);
  const mac = createHmac('sha256', Buffer.from(randomnessHex, 'hex')).update(digest).digest();
  // 48 bits is plenty for any realistic total and stays exact in a double.
  const point = mac.readUIntBE(0, 6) % total;
  let at = 0;
  for (const t of sorted) {
    at += t.entries;
    if (point < at) return { winner: t, digest, point, total };
  }
  throw new Error('unreachable');
}
