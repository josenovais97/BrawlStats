import type { Metadata } from 'next';
import { ExternalLink, Gift } from 'lucide-react';

import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { relativeTime } from '@/lib/format';
import { getFreeRewards, LIVE_DAYS, type FreeReward } from '@/lib/free-rewards';
import { currentMonth, WHATSAPP_URL } from '@/lib/site';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

/**
 * Free Brawl Stars rewards (2026-10-27): every free reward link Supercell
 * hands out, as soon as `brawlzone-rewards` finds it.
 *
 * The job had been posting each one to TikTok, YouTube, Instagram, Discord
 * and WhatsApp since 2026-10-21 while the site itself had nowhere to send
 * anyone, and "free rewards" is one of the most searched things about the
 * game. The FAQ is the other half of the page: there are no redeem codes in
 * Brawl Stars, and the searches for them mostly find gem generators.
 */

const DISCORD_URL = 'https://discord.gg/964EMQBBUJ';

export function generateMetadata(): Metadata {
  const t = getT(requestLocale());
  return {
    alternates: { canonical: '/rewards' },
    title: t('Free Brawl Stars rewards today ({v}): every claim link', { v: currentMonth() }),
    description: t('Every free reward link Supercell gives out, posted as soon as it appears: boxes, credits, power points. Tap Claim and it goes to your account. No codes, no generators.'),
  };
}

/** The feed changes when the job posts, so five minutes behind it at most. */
export const revalidate = 300;

export default async function RewardsPage() {
  const t = getT(requestLocale());
  const { live, earlier } = await getFreeRewards();

  const faq = [
    {
      question: t('Are there Brawl Stars codes for free gems?'),
      answer: t('No. Brawl Stars has no redeem codes. Free rewards come as links from Supercell that open the game and add the reward to your account. Any site that asks for a code, your login or to "verify" with a survey to get free gems is a scam.'),
    },
    {
      question: t('Why does the game say the reward expired or was already claimed?'),
      answer: t('Each link works for a limited time and usually once per account. Supercell does not say for how long, so a link here can stop working before it leaves the list. If it has expired, it is gone for everyone.'),
    },
    {
      question: t('Are these links safe?'),
      answer: t('They are Supercell\'s own links, from link.brawlstars.com or store.supercell.com, and this page shows no other kind. Claiming opens Brawl Stars and never asks for your password. BrawlZone never asks for your account either.'),
    },
    {
      question: t('Where do the links come from?'),
      answer: t('Supercell shares them on its own channels, often during events or after a live stream. BrawlZone checks for new ones every few minutes and posts them here and on Discord, WhatsApp, YouTube, TikTok and Instagram.'),
    },
  ];

  return (
    <div className="space-y-10">
      <JsonLd data={breadcrumbSchema([{ name: 'Free rewards', path: '/rewards' }])} />
      <JsonLd data={faqSchema(faq)} />

      <PageHeading
        title={t('Free Brawl Stars rewards')}
        subtitle={t('Every free reward link Supercell gives out, as soon as it appears. Open this page on the phone with Brawl Stars, tap Claim, and the reward goes straight to your account.')}
      />

      <section className="space-y-4">
        <SectionHeading title={t('Live now')} subtitle={t('Found in the last {n} days. Claim them before they expire.', { n: LIVE_DAYS })} />
        {live.length ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {live.map((r) => (
              <RewardCard key={r.id} reward={r} live />
            ))}
          </ul>
        ) : (
          <div className="card space-y-2 p-6 text-sm leading-relaxed text-muted">
            <p className="font-semibold text-foreground">{t('No free reward right now.')}</p>
            <p>{t('Supercell drops them a few times a month, often during events. Follow below and you will hear about the next one the minute it appears.')}</p>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">{t('Get the next one first')}</h2>
        <p className="text-sm leading-relaxed text-muted">{t('A new link goes to these the moment it is found, often hours before other sites have it.')}</p>
        <div className="flex flex-wrap gap-3">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-[#0b2b16]">
            {t('WhatsApp channel')}
            <ExternalLink aria-hidden className="size-4" />
          </a>
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#5865F2] px-5 py-3 font-bold text-white">
            {t('Discord server')}
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </div>
      </section>

      {earlier.length ? (
        <section className="space-y-4">
          <SectionHeading title={t('Earlier rewards')} subtitle={t('Older than {n} days. They may have expired, but some still work, so try them.', { n: LIVE_DAYS })} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {earlier.map((r) => (
              <RewardCard key={r.id} reward={r} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card space-y-3 p-6 text-sm leading-relaxed text-muted">
        <h2 className="text-base font-bold text-foreground">{t('How to claim a free reward')}</h2>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>{t('Open this page on the phone where Brawl Stars is installed and logged in to your account.')}</li>
          <li>{t('Tap Claim. The link opens Brawl Stars by itself.')}</li>
          <li>{t('Accept the reward in the game. It lands in your account straight away.')}</li>
        </ol>
        <p>{t('Playing on more than one account? The game claims it for the one that is open, so switch first.')}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">{t('Questions')}</h2>
        <dl className="space-y-4">
          {faq.map((f) => (
            <div key={f.question} className="card p-5">
              <dt className="font-semibold">{f.question}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-xs leading-relaxed text-muted">
        {t('Rewards are given by Supercell, not by BrawlZone, and Supercell decides how long each one lasts. Unofficial fan project, not affiliated with Supercell.')}
      </p>
    </div>
  );
}

function RewardCard({ reward, live = false }: { reward: FreeReward; live?: boolean }) {
  const t = getT(requestLocale());
  return (
    <li className={`card flex items-center gap-4 p-4 ${live ? 'card-glow' : 'opacity-80'}`}>
      <Gift aria-hidden className={`size-10 shrink-0 ${live ? 'text-brand' : 'text-muted'}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{reward.name}</p>
        <p className="text-xs text-muted">{t('Found {when}', { when: relativeTime(new Date(reward.postedAt)) })}</p>
      </div>
      <a
        href={reward.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold ${live ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-foreground'}`}
      >
        {t('Claim')}
        <ExternalLink aria-hidden className="size-3.5" />
      </a>
    </li>
  );
}
