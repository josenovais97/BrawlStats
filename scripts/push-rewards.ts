/**
 * Tell every subscribed browser about new free rewards (2026-10-28).
 *
 *   docker compose run --rm -T sampler node --import tsx --conditions=react-server scripts/push-rewards.ts "Mega Box" "2000 Credits"
 *
 * Called by brawlzone-rewards right after it posts a new batch. Each browser
 * gets the message in the language it subscribed from, opening /rewards in
 * that language. Subscriptions the push service calls gone (404/410) are
 * deleted. Prints "push: sent N, gone N, failed N".
 */
import { getPrisma } from '@/lib/prisma';
import { sendPush, type SendResult } from '@/lib/web-push';

const TEXT: Record<string, { title: string; body: (names: string) => string; path: string }> = {
  en: { title: '🎁 New free Brawl Stars reward!', body: (n) => `${n}. Tap to claim it before it expires.`, path: '/rewards' },
  es: { title: '🎁 ¡Nueva recompensa gratis de Brawl Stars!', body: (n) => `${n}. Toca para reclamarla antes de que expire.`, path: '/es/rewards' },
  pt: { title: '🎁 Nova recompensa grátis de Brawl Stars!', body: (n) => `${n}. Toque para resgatar antes que expire.`, path: '/pt/rewards' },
};

async function main(): Promise<void> {
  const names = process.argv.slice(2).filter(Boolean);
  if (!names.length) throw new Error('usage: push-rewards.ts <reward name> ...');
  const prisma = getPrisma();
  if (!prisma) throw new Error('no DATABASE_URL');
  const subs = await prisma.pushSubscription.findMany();
  const tally: Record<SendResult, number> = { sent: 0, gone: 0, failed: 0 };
  const listed = names.length > 3 ? `${names.slice(0, 3).join(', ')}…` : names.join(', ');
  // Ten at a time: push services answer fast, and this keeps the box calm.
  for (let i = 0; i < subs.length; i += 10) {
    await Promise.all(
      subs.slice(i, i + 10).map(async (s) => {
        const text = TEXT[s.lang] ?? TEXT.en;
        const result = await sendPush(s, { title: text.title, body: text.body(listed), url: text.path, tag: 'brawlzone-reward' });
        tally[result] += 1;
        if (result === 'gone') await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        if (result === 'sent') await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSentAt: new Date() } }).catch(() => {});
      }),
    );
  }
  console.log(`push: sent ${tally.sent}, gone ${tally.gone}, failed ${tally.failed} (of ${subs.length})`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
