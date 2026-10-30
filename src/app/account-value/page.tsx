import type { Metadata } from 'next';
import { Coins, Crown, Share2 } from 'lucide-react';

import { AccountValueForm } from '@/components/account-value/tag-form';
import { currentMonth } from '@/lib/site';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

/**
 * The account value calculator's front door: a tag box, and what it measures.
 *
 * Named and titled for what people search ("brawl stars account value",
 * "how much is my account worth"), but honest about the unit: coins and power
 * points, the in-game cost of building the account, never a money or resale
 * price -- selling accounts breaks Supercell's terms, and gem prices for coins
 * are not stable enough to quote.
 */

export function generateMetadata(): Metadata {
  const t = getT(requestLocale());
  return {
    alternates: { canonical: '/account-value' },
    title: t('Brawl Stars account value calculator ({v})', { v: currentMonth() }),
    description: t('How much is your Brawl Stars account worth? Enter your tag: the coins and power points it took to build, and how it ranks against 58,000 active players.'),
  };
}

export const revalidate = 86400;

export default function AccountValueLanding() {
  const t = getT(requestLocale());
  const points = [
    { icon: Coins, title: t('What it cost to build'), body: t('Every power level, hypercharge, star power, gadget and gear you own, priced in coins and power points.') },
    { icon: Crown, title: t('How it ranks'), body: t('Compared with about 58,000 active players we track, so you see where your account really stands.') },
    { icon: Share2, title: t('A card to share'), body: t('A story-sized picture of your result, ready for TikTok, Instagram or your club chat.') },
  ];
  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <p className="flex items-center gap-2.5">
          <span className="eyebrow">{t('Account value')}</span>
        </p>
        <h1 className="display text-game-stroke text-4xl leading-[1.05] sm:text-5xl">{t('How much is your account worth?')}</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          {t('Enter your player tag to see what your Brawl Stars account cost to build, and how it compares with other players.')}
        </p>
        <AccountValueForm />
        <p className="text-xs text-muted">{t('Your tag is under your name on your in-game profile.')}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {points.map((p) => (
          <article key={p.title} className="card p-5">
            <p.icon aria-hidden className="size-6 text-brand" />
            <h2 className="mt-3 font-bold">{p.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
          </article>
        ))}
      </section>

      <p className="text-xs leading-relaxed text-muted">
        {t('Values are in-game currency, not money: what it costs in coins and power points to build the same account. Buffies and skins are not included, because they also come from drops. Unofficial fan project, not affiliated with Supercell.')}
      </p>
    </div>
  );
}
