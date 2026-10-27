import type { Metadata } from 'next';
import { Flame, ScrollText, Share2 } from 'lucide-react';

import { AccountValueForm } from '@/components/account-value/tag-form';
import { ROAST_PUBLIC } from '@/lib/roast-data';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

/**
 * Roast My Account's front door (2026-10-27): a tag box and what happens next.
 *
 * Not public yet -- see `ROAST_PUBLIC`. Until then it is `noindex`, out of the
 * sitemap, disallowed in robots.txt and linked from nowhere.
 */

export function generateMetadata(): Metadata {
  const t = getT(requestLocale());
  return {
    alternates: { canonical: '/roast' },
    title: t('Roast my Brawl Stars account'),
    description: t('Enter your player tag and get roasted by your own stats: your main, your Ranked rank, your last games. A score out of 10 and a card to share.'),
    ...(ROAST_PUBLIC ? {} : { robots: { index: false, follow: false } }),
  };
}

export const revalidate = 86400;

export default function RoastLanding() {
  const t = getT(requestLocale());
  const points = [
    { icon: Flame, title: t('Your real stats'), body: t('Your main, your Ranked rank, your win rate, your club and the brawlers you left at Power 1. Every joke is about a number on your account.') },
    { icon: ScrollText, title: t('A new roast every day'), body: t('The same roast all day, so a screenshot is your roast. Tomorrow it may find something else.') },
    { icon: Share2, title: t('A card to share'), body: t('Your score out of 10 and the best lines, story-sized, for TikTok, Instagram or your club chat.') },
  ];
  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <p className="flex items-center gap-2.5">
          <span aria-hidden className="rule h-4" />
          <span className="eyebrow">{t('Roast my account')}</span>
        </p>
        <h1 className="display text-4xl uppercase leading-[1.05] sm:text-5xl">{t('Think your account is good?')}</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          {t('Enter your player tag. BrawlZone reads your stats and tells you the truth, with no mercy and a score out of 10.')}
        </p>
        <AccountValueForm base="/roast" cta={t('Roast me')} />
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
        {t('It is a joke: the roast is about the account and the gameplay, never about the person. It uses the same public stats as your profile. Unofficial fan project, not affiliated with Supercell.')}
      </p>
    </div>
  );
}
