/**
 * Post a new batch of free rewards to every Discord channel that asked for
 * them with /rewards-feed setup (2026-10-29).
 *
 *   docker compose run --rm -T sampler node --import tsx --conditions=react-server \
 *     scripts/discord-reward-feeds.ts '<rewards.json contents>' 'https://brawlzone.net/social/rewards/<id>/2.jpg'
 *
 *     scripts/discord-reward-feeds.ts --daily "100x Coins" 'https://store.supercell.com/…'
 *
 * The first is called by brawlzone-rewards right after our own server's
 * announcement; the second (2026-11-24) by brawlzone-daily-gift, for the
 * servers that also take the store's free daily reward. One
 * channel at a time, a quarter of a second apart, well inside Discord's rate
 * limits. A channel that fails FEED_GONE_AFTER times in a row is dropped.
 * Prints "discord feeds: sent N, failed N, dropped N".
 */
import { FEED_GONE_AFTER, dailyFeedMessage, postToChannel, rewardFeedMessage, type FeedReward } from '@/lib/discord-reward-feed';
import { dailyGiftUrl, nextStoreReset } from '@/lib/store-daily';
import { getPrisma } from '@/lib/prisma';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const daily = args[0] === '--daily';
  if (daily && !args[1]) throw new Error("usage: discord-reward-feeds.ts --daily '<name>' [url]");
  const rewards = daily ? [] : (JSON.parse(args[0] ?? '[]') as FeedReward[]);
  if (!daily && !rewards.length) throw new Error("usage: discord-reward-feeds.ts '<rewards json>' [image url]");
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('no DISCORD_BOT_TOKEN');
  const prisma = getPrisma();
  if (!prisma) throw new Error('no DATABASE_URL');

  const body = daily
    ? dailyFeedMessage(args[1], dailyGiftUrl(args[2]), nextStoreReset(Date.now()))
    : rewardFeedMessage(rewards, args[1] || null);
  const feeds = await prisma.discordRewardFeed.findMany(daily ? { where: { daily: true } } : undefined);
  const tally = { sent: 0, failed: 0, dropped: 0 };
  for (const feed of feeds) {
    const { result } = await postToChannel(feed.channelId, body, token);
    if (result === 'sent') {
      tally.sent += 1;
      await prisma.discordRewardFeed.update({ where: { guildId: feed.guildId }, data: { failures: 0, lastSentAt: new Date() } });
    } else if (feed.failures + 1 >= FEED_GONE_AFTER) {
      tally.dropped += 1;
      await prisma.discordRewardFeed.delete({ where: { guildId: feed.guildId } }).catch(() => {});
    } else {
      tally.failed += 1;
      await prisma.discordRewardFeed.update({ where: { guildId: feed.guildId }, data: { failures: { increment: 1 } } });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`discord feeds: sent ${tally.sent}, failed ${tally.failed}, dropped ${tally.dropped} (of ${feeds.length})`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
