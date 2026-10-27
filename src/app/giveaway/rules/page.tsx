import type { Metadata } from 'next';

import { DISCORD_BONUS, ENTRIES_PER_IP_PER_DAY, GIVEAWAY, GIVEAWAY_PUBLIC } from '@/lib/giveaway';
import { requestLocale } from '@/lib/request-locale';
import { CONTACT_EMAIL } from '@/lib/site';
import { getT } from '@/lib/t';

/** The giveaway's official rules (2026-10-27): plain language, every promise the page makes. */

export function generateMetadata(): Metadata {
  const t = getT(requestLocale());
  return {
    alternates: { canonical: '/giveaway/rules' },
    title: t('Giveaway rules'),
    ...(GIVEAWAY_PUBLIC ? {} : { robots: { index: false, follow: false } }),
  };
}

export const revalidate = 86400;

export default function GiveawayRules() {
  const t = getT(requestLocale());
  const locale = requestLocale();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'en' ? 'en-GB' : locale === 'es' ? 'es-419' : 'pt-BR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
    });

  const rules: [string, string][] = [
    [t('Organiser'), t('BrawlZone (brawlzone.net), an unofficial Brawl Stars fan project. Contact: {email}. This giveaway is not sponsored, endorsed or run by Supercell, Google, Apple, YouTube, TikTok, Instagram or Discord.', { email: CONTACT_EMAIL })],
    [t('Dates'), t('Entries open {open} and close {close}.', { open: fmt(GIVEAWAY.opensAt), close: fmt(GIVEAWAY.closesAt) })],
    [t('Prize'), t('One €10 gift card for Google Play or the App Store, the winner\'s choice, sent by email as a code. The prize cannot be swapped for cash.')],
    [t('Who can enter'), t('Anyone aged 13 or older with a Brawl Stars account, where giveaways like this are allowed. If you are under 18, a parent or guardian must know you are entering and may need to accept the prize for you. Entering is free and needs no purchase.')],
    [t('How to enter'), t('Enter your player tag and an email address at brawlzone.net/giveaway. One entry form per person, per player tag and per email address.')],
    [t('Points'), t('1 point for entering, +{discord} for confirming your entry with /giveaway in the BrawlZone Discord server (one Discord account per entry), +1 each for subscribing on YouTube, following on TikTok and following on Instagram, and +1 for each friend who enters with your link, with no limit. Follow points are taken on your word, and we may check the winner\'s.', { discord: DISCORD_BONUS })],
    [t('Fair play'), t('Fake tags, fake email addresses, other people\'s tags or several entries for one person are removed, along with any points they brought. At most {n} entries a day are accepted from one network. The winner is checked before being announced.', { n: ENTRIES_PER_IP_PER_DAY })],
    [t('The draw'), t('After entries close, one winner is drawn at random, weighted by points (each point is one ticket), using the first drand public randomness round after the close (drand.love). The entry list (tags and points, no emails) and the round used are published so anyone can check it. The winner is announced in a video and on brawlzone.net.')],
    [t('Claiming the prize'), t('We email the winner from {email}. If there is no reply within 14 days, or the winner breaks these rules, a new winner is drawn the same way.', { email: CONTACT_EMAIL })],
    [t('Your data'), t('Your player tag and email are used only to run this giveaway. The email is seen only by the organiser, never published or shared, and deleted once the prize is delivered. Write to {email} to remove your entry at any time.', { email: CONTACT_EMAIL })],
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="display text-3xl sm:text-4xl">{t('Giveaway rules')}</h1>
      <dl className="space-y-6">
        {rules.map(([k, v]) => (
          <div key={k}>
            <dt className="font-bold">{k}</dt>
            <dd className="mt-1 leading-relaxed text-muted">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
