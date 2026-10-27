/**
 * Draw the giveaway winner (see lib/giveaway, lib/giveaway-draw).
 *
 *   docker compose run --rm -T sampler node --import tsx --conditions=react-server scripts/giveaway-draw.ts [skip-tag ...]
 *
 * Only after entries close. Uses the first drand round published at or after
 * the close, so the randomness did not exist while anyone could still enter.
 * Prints the winner (tag, name, email: for the owner only) and writes the
 * public proof -- every tag with its entries, the list digest, the round and
 * its randomness, no emails -- to stdout as one JSON line prefixed PROOF.
 *
 * A winner who does not reply in 14 days, or breaks the rules, is passed as
 * skip-tag and the draw is run again: same round, same list minus them.
 */
import { GIVEAWAY, entriesFor } from '@/lib/giveaway';
import { drawWinner, type Ticket } from '@/lib/giveaway-draw';
import { getPrisma } from '@/lib/prisma';

const DRAND = 'https://api.drand.sh';

async function main(): Promise<void> {
  const close = Date.parse(GIVEAWAY.closesAt);
  if (Date.now() < close) throw new Error(`entries are open until ${GIVEAWAY.closesAt}`);
  const skip = new Set(process.argv.slice(2).map((t) => `#${t.replace(/^#/, '').toUpperCase()}`));

  const prisma = getPrisma();
  if (!prisma) throw new Error('no DATABASE_URL');
  const rows = await prisma.giveawayEntry.findMany({
    where: { giveaway: GIVEAWAY.id, createdAt: { lt: new Date(close) } },
  });
  const valid = rows.filter((r) => !skip.has(r.playerTag));
  const validCodes = new Set(valid.map((r) => r.code));
  // A referral counts only if the friend's own entry is still in the draw.
  const referrals = new Map<string, number>();
  for (const r of rows) {
    if (r.referredBy && validCodes.has(r.code)) referrals.set(r.referredBy, (referrals.get(r.referredBy) ?? 0) + 1);
  }
  const tickets: Ticket[] = valid.map((r) => ({
    code: r.code,
    playerTag: r.playerTag,
    entries: entriesFor(
      Boolean(r.discordUserId),
      referrals.get(r.code) ?? 0,
      Number(r.followedInstagram) + Number(r.followedTiktok) + Number(r.followedYoutube),
    ).total,
  }));

  const info = (await (await fetch(`${DRAND}/info`)).json()) as { period: number; genesis_time: number };
  const round = Math.ceil((close / 1000 - info.genesis_time) / info.period) + 1;
  const beacon = (await (await fetch(`${DRAND}/public/${round}`)).json()) as { round: number; randomness: string };
  if (beacon.round !== round || !/^[0-9a-f]{64}$/.test(beacon.randomness)) throw new Error('bad beacon reply');

  const result = drawWinner(tickets, beacon.randomness);
  const winner = valid.find((r) => r.code === result.winner.code)!;
  console.log(`entrants ${tickets.length}, entries ${result.total}, drand round ${round}`);
  console.log(`WINNER ${winner.playerTag} (${winner.playerName}) with ${result.winner.entries} entries: ${winner.email}`);
  console.log(
    'PROOF ' +
      JSON.stringify({
        giveaway: GIVEAWAY.id,
        closesAt: GIVEAWAY.closesAt,
        drand: { chain: `${DRAND}/info`, round, randomness: beacon.randomness },
        skipped: [...skip],
        digest: result.digest,
        point: result.point,
        total: result.total,
        winner: winner.playerTag,
        tickets: [...tickets].sort((a, b) => a.code.localeCompare(b.code)),
      }),
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
