/**
 * Tell every subscribed browser about new free rewards (2026-10-28).
 *
 *   docker compose run --rm -T sampler node --import tsx --conditions=react-server scripts/push-rewards.ts "Mega Box" "2000 Credits"
 *
 * Called by brawlzone-rewards right after it posts a new batch. Each browser
 * gets the message in the language it subscribed from, opening /rewards in
 * that language. Subscriptions the push service calls gone (404/410) are
 * deleted. Prints "push: sent N, gone N, failed N".
 *
 * 2026-11-20: the link carries ?from=push, so Umami can count the taps
 * (url_query); before that a tap looked like any direct visit.
 */
import { isIntlLocale, type Locale } from '@/lib/i18n';
import { getPrisma } from '@/lib/prisma';
import { sendPush, type SendResult } from '@/lib/web-push';

// Every live language must be here: Record<Locale, …> fails to compile otherwise.
const TEXT: Record<Locale, { title: string; body: (names: string) => string; path: string }> = {
  en: { title: '🎁 New free Brawl Stars reward!', body: (n) => `${n}. Tap to claim it before it expires.`, path: '/rewards' },
  es: { title: '🎁 ¡Nueva recompensa gratis de Brawl Stars!', body: (n) => `${n}. Toca para reclamarla antes de que expire.`, path: '/es/rewards' },
  pt: { title: '🎁 Nova recompensa grátis de Brawl Stars!', body: (n) => `${n}. Toque para resgatar antes que expire.`, path: '/pt/rewards' },
  tr: { title: '🎁 Yeni ücretsiz Brawl Stars ödülü!', body: (n) => `${n}. Süresi dolmadan almak için dokun.`, path: '/tr/rewards' },
  de: { title: '🎁 Neue Gratis-Belohnung für Brawl Stars!', body: (n) => `${n}. Tippe, um sie abzuholen, bevor sie abläuft.`, path: '/de/rewards' },
  ru: { title: '🎁 Новая бесплатная награда в Brawl Stars!', body: (n) => `${n}. Нажми, чтобы забрать, пока она не истекла.`, path: '/ru/rewards' },
  fr: { title: '🎁 Nouvelle récompense gratuite Brawl Stars !', body: (n) => `${n}. Touche pour la récupérer avant qu’elle expire.`, path: '/fr/rewards' },
};

/** Today's reward in the Supercell Store (brawlzone-daily-gift, a trial): its own words, link and tag, so one day's replaces the last. */
const DAILY: Record<Locale, { title: string; body: (name: string) => string }> = {
  en: { title: "🎁 Today's free Brawl Stars store reward", body: (n) => `${n}. Claim it before it changes.` },
  es: { title: '🎁 La recompensa gratis de hoy en la tienda de Brawl Stars', body: (n) => `${n}. Reclámala antes de que cambie.` },
  pt: { title: '🎁 A recompensa grátis de hoje na loja do Brawl Stars', body: (n) => `${n}. Resgate antes que mude.` },
  tr: { title: '🎁 Brawl Stars mağazasında bugünün ücretsiz ödülü', body: (n) => `${n}. Değişmeden al.` },
  de: { title: '🎁 Die heutige Gratis-Belohnung im Brawl-Stars-Store', body: (n) => `${n}. Hol sie ab, bevor sie wechselt.` },
  ru: { title: '🎁 Бесплатная награда дня в магазине Brawl Stars', body: (n) => `${n}. Забери, пока не сменилась.` },
  fr: { title: '🎁 La récompense gratuite du jour, boutique Brawl Stars', body: (n) => `${n}. Récupère-la avant qu’elle change.` },
};

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter(Boolean);
  const daily = args[0] === '--daily';
  const names = daily ? args.slice(1) : args;
  if (!names.length) throw new Error('usage: push-rewards.ts [--daily] <reward name> ...');
  const prisma = getPrisma();
  if (!prisma) throw new Error('no DATABASE_URL');
  const subs = await prisma.pushSubscription.findMany();
  const tally: Record<SendResult, number> = { sent: 0, gone: 0, failed: 0 };
  const listed = names.length > 3 ? `${names.slice(0, 3).join(', ')}…` : names.join(', ');
  // Ten at a time: push services answer fast, and this keeps the box calm.
  for (let i = 0; i < subs.length; i += 10) {
    await Promise.all(
      subs.slice(i, i + 10).map(async (s) => {
        const lang: Locale = isIntlLocale(s.lang) ? s.lang : 'en';
        const text = TEXT[lang];
        const message = daily
          ? { title: DAILY[lang].title, body: DAILY[lang].body(listed), url: `${text.path}?from=daily-push`, tag: 'brawlzone-daily' }
          : { title: text.title, body: text.body(listed), url: `${text.path}?from=push`, tag: 'brawlzone-reward' };
        const result = await sendPush(s, message);
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
