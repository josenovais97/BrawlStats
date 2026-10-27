import type { Metadata } from 'next';
import { ChevronDown } from 'lucide-react';

import { GiveawayBanner } from '@/components/giveaway/giveaway-banner';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { relativeTime } from '@/lib/format';
import { getFreeRewards, LIVE_DAYS, rewardArt, type FreeReward } from '@/lib/free-rewards';
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

  const [hero, ...more] = live;

  return (
    <div className="space-y-12">
      <JsonLd data={breadcrumbSchema([{ name: 'Free rewards', path: '/rewards' }])} />
      <JsonLd data={faqSchema(faq)} />

      <div className="max-w-2xl space-y-2">
        <h1 className="display text-3xl leading-tight sm:text-4xl">{t('Free Brawl Stars rewards')}</h1>
        <p className="text-muted">{t('Every free reward link Supercell gives out, as soon as it appears. Open this page on the phone with Brawl Stars, tap Claim, and the reward goes straight to your account.')}</p>
      </div>

      {hero ? <RewardStage reward={hero} total={live.length} /> : <EmptyStage />}

      <GiveawayBanner from="rewards" />

      {more.length ? (
        <section className="space-y-4">
          <h2 className="display text-2xl">{t('More free rewards live now')}</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((r) => (
              <li key={r.id} className="reward-tile flex items-center gap-4 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- a small pre-compressed icon, like the game icons */}
                <img src={r.art} alt="" width={88} height={88} className="size-20 shrink-0 object-contain drop-shadow-[0_6px_8px_rgb(0_0_0/0.5)]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="display text-game-stroke truncate text-xl text-white">{r.name}</p>
                  <p className="text-xs text-muted">{t('Found {when}', { when: relativeTime(new Date(r.postedAt)) })}</p>
                  <ClaimButton url={r.url} small />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hero ? <FollowBand /> : null}

      <section className="space-y-5">
        <h2 className="display text-2xl">{t('How to claim a free reward')}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            t('Open this page on the phone where Brawl Stars is installed and logged in to your account.'),
            t('Tap Claim. The link opens Brawl Stars by itself.'),
            t('Accept the reward in the game. It lands in your account straight away.'),
          ].map((step, i) => (
            <li key={step} className="flex gap-4 rounded-2xl bg-surface p-5">
              <span aria-hidden className="display text-game-stroke text-5xl leading-none text-brand">{i + 1}</span>
              <span className="text-sm leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted">{t('Playing on more than one account? The game claims it for the one that is open, so switch first.')}</p>
      </section>

      {earlier.length ? (
        <section className="space-y-4">
          <h2 className="display text-2xl">{t('Earlier rewards')}</h2>
          <p className="text-sm text-muted">{t('Older than {n} days. They may have expired, but some still work, so try them.', { n: LIVE_DAYS })}</p>
          <ul className="divide-y divide-border rounded-2xl bg-surface">
            {earlier.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- same art as above */}
                <img src={r.art} alt="" width={48} height={48} className="size-11 shrink-0 object-contain opacity-60 grayscale" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="text-xs text-muted">{t('Found {when}', { when: relativeTime(new Date(r.postedAt)) })}</p>
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="shrink-0 text-sm font-semibold text-brand hover:underline">
                  {t('Try it')}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="display text-2xl">{t('Questions')}</h2>
        {faq.map((f) => (
          <details key={f.question} className="group rounded-2xl bg-surface p-5 open:bg-surface-2">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <span className="flex items-center justify-between gap-4">
                {f.question}
                <ChevronDown aria-hidden className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{f.answer}</p>
          </details>
        ))}
      </section>

      <p className="text-xs leading-relaxed text-muted">
        {t('Rewards are given by Supercell, not by BrawlZone, and Supercell decides how long each one lasts. Unofficial fan project, not affiliated with Supercell.')}
      </p>
    </div>
  );
}

/** The newest live reward, as the game's own reward screen. */
function RewardStage({ reward, total }: { reward: FreeReward; total: number }) {
  const t = getT(requestLocale());
  return (
    <section className="reward-stage px-5 pb-10 pt-6 sm:px-10 sm:pb-12" aria-labelledby="reward-now">
      <div aria-hidden className="reward-rays" />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
        <span className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5">
          <span className="live-dot" />
          {t('Live, found {when}', { when: relativeTime(new Date(reward.postedAt)) })}
        </span>
        {total > 1 ? (
          <span className="rounded-full bg-brand px-3 py-1.5 text-brand-ink">{t('{n} free rewards to claim', { n: total })}</span>
        ) : null}
      </div>
      <div className="mx-auto flex max-w-md flex-col items-center pt-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small pre-compressed icon, like the game icons */}
        <img src={reward.art} alt="" width={260} height={260} className="reward-float size-52 object-contain sm:size-64" />
        <p className="mt-4 text-sm font-semibold text-white/70">{t('Free reward')}</p>
        <h2 id="reward-now" className="display text-game-stroke mt-1 text-4xl leading-none text-white sm:text-6xl">{reward.name}</h2>
        <div className="mt-8 w-full max-w-xs">
          <ClaimButton url={reward.url} />
        </div>
        <p className="mt-3 text-xs text-white/60">{t('Opens Brawl Stars. An official Supercell link.')}</p>
      </div>
    </section>
  );
}

/** Nothing live: the stage stays, locked, and the way to the next one is right on it. */
function EmptyStage() {
  const t = getT(requestLocale());
  return (
    <section className="reward-stage px-5 py-10 text-center sm:px-10">
      <div aria-hidden className="reward-rays opacity-40" />
      {/* eslint-disable-next-line @next/next/no-img-element -- same art as above */}
      <img src={rewardArt('Mega Box')} alt="" width={200} height={200} className="reward-locked mx-auto size-44 object-contain" />
      <h2 className="display text-game-stroke mt-4 text-3xl text-white sm:text-4xl">{t('No free reward right now')}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-white/75">{t('Supercell drops them a few times a month, often during events. Follow below and you will hear about the next one the minute it appears.')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <FollowButtons />
      </div>
    </section>
  );
}

function FollowBand() {
  const t = getT(requestLocale());
  return (
    <section className="flex flex-col gap-5 rounded-2xl bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md space-y-1">
        <h2 className="display text-2xl">{t('Get the next one first')}</h2>
        <p className="text-sm text-muted">{t('A new link goes to these the moment it is found, often hours before other sites have it.')}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <FollowButtons />
      </div>
    </section>
  );
}

function FollowButtons() {
  const t = getT(requestLocale());
  return (
    <>
      <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn-game inline-flex items-center gap-2 bg-[#25d366] px-5 py-3 text-[#06260f] [--btn-shadow:#12803c]">
        {t('WhatsApp channel')}
      </a>
      <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn-game inline-flex items-center gap-2 bg-[#5865f2] px-5 py-3 text-white [--btn-shadow:#343c9e]">
        {t('Discord server')}
      </a>
    </>
  );
}

/** The game's green claim button, in the site's btn-game shape. */
function ClaimButton({ url, small = false }: { url: string; small?: boolean }) {
  const t = getT(requestLocale());
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`btn-game inline-flex items-center justify-center bg-[#3ddc63] text-[#0b2a14] [--btn-shadow:#1a7a33] hover:bg-[#52e676] ${
        small ? 'px-4 py-2 text-base' : 'w-full px-8 py-4 text-3xl'
      }`}
    >
      {t('Claim')}
    </a>
  );
}
