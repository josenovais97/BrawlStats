/**
 * The giveaway's final standings (see lib/giveaway): most points wins, a tie
 * goes to whoever entered first.
 *
 *   docker compose run --rm -T sampler node --import tsx --conditions=react-server scripts/giveaway-results.ts [skip-tag ...]
 *
 * Prints the top 10 with each one's friends, so the owner can check the
 * leaders for fake or duplicate friends before announcing (the rules allow
 * removing them), and the winner's email. A removed entrant is passed as
 * skip-tag: their entry and every friend point it brought are dropped.
 */
import { GIVEAWAY, entriesFor, rank } from '@/lib/giveaway';
import { getPrisma } from '@/lib/prisma';

async function main(): Promise<void> {
  const close = Date.parse(GIVEAWAY.closesAt);
  if (Date.now() < close) console.warn(`NOTE: still open until ${GIVEAWAY.closesAt}; these are standings so far.`);
  const skip = new Set(process.argv.slice(2).map((t) => `#${t.replace(/^#/, '').toUpperCase()}`));
  const prisma = getPrisma();
  if (!prisma) throw new Error('no DATABASE_URL');
  const rows = (
    await prisma.giveawayEntry.findMany({ where: { giveaway: GIVEAWAY.id, createdAt: { lt: new Date(close) } } })
  ).filter((r) => !skip.has(r.playerTag));
  const friends = new Map<string, typeof rows>();
  for (const r of rows) if (r.referredBy) friends.set(r.referredBy, [...(friends.get(r.referredBy) ?? []), r]);
  const ranked = rank(
    rows.map((r) => ({
      ...r,
      points: entriesFor(
        Boolean(r.discordUserId),
        friends.get(r.code)?.length ?? 0,
        Number(r.followedInstagram) + Number(r.followedTiktok) + Number(r.followedYoutube),
      ).total,
      enteredAt: r.createdAt.getTime(),
    })),
  );
  console.log(`entrants ${rows.length}`);
  for (const [i, r] of ranked.slice(0, 10).entries()) {
    const f = friends.get(r.code) ?? [];
    console.log(`${i + 1}. ${r.playerName} ${r.playerTag} ${r.points} pts (discord ${r.discordUserId ? 'yes' : 'no'}, friends ${f.length})`);
    for (const x of f) console.log(`     friend ${x.playerName} ${x.playerTag} ${x.createdAt.toISOString()} net ${x.ipHash.slice(0, 6)}`);
  }
  if (ranked[0]) console.log(`WINNER ${ranked[0].playerName} ${ranked[0].playerTag}: ${ranked[0].email}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
