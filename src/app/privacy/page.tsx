import type { Metadata } from 'next';
import { BellRing, Database, HardDrive, Megaphone, Server, Shield, Smartphone, Trash2, User } from 'lucide-react';
import Link from 'next/link';

import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { CONTACT_EMAIL } from '@/lib/site';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

/**
 * What the site and the app collect, which is very little.
 *
 * Written as a description of the build rather than as a legal document,
 * because a policy that does not match the code is worse than none: it teaches
 * the one reader careful enough to check that the page is decoration. Every
 * claim here is something in this repository — the storage keys are the ones
 * `grep` finds, the third-party hosts are the ones `next.config.ts` allows, and
 * the analytics script is the one `layout.tsx` loads.
 *
 * It exists because the site now distributes software. An APK asks for more
 * trust than a web page, and "we collect nothing" is worth stating precisely
 * when it happens to be true.
 */

export const metadata: Metadata = {
  alternates: { canonical: '/privacy' },
  title: 'Privacy',
  description:
    'What BrawlZone and the BrawlZone Bubble app store, what they do not, and what the app sends. No accounts, and ads only on the website.',
};

const NOTHING = [
  'No account, because there is nothing to sign in to.',
  'No cookies of our own. The website\'s ads may set some, and in Europe only after you agree.',
  'No trackers beyond Google\'s ad service on the website, and none at all in the Android app.',
  'No email address, name, phone number or payment details — none are ever asked for.',
];

export default function PrivacyPage() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  return (
    <div className="space-y-12">
      <PageHeading
        title={t('What we collect')}
        subtitle={t('Very little, and this page says exactly what. Every claim below is something you can check in the source.')}
      />
      {/* A translation of a legal page is a courtesy; the English is the text. */}
      {requestLocale() !== 'en' ? (
        <p className="text-sm text-muted">
          {t('This page is a translation. If it differs from the English version, the English version applies.')}{' '}
          <Link href={'/privacy'} className="font-semibold text-brand hover:underline">
            English
          </Link>
        </p>
      ) : null}

      <section className="card card-glow p-6 sm:p-8">
        <div className="flex gap-4">
          <Shield className="size-6 shrink-0 text-brand" />
          <div>
            <h2 className="font-bold">{t('The short version')}</h2>
            <ul className="mt-3 space-y-2">
              {NOTHING.map((line) => (
                <li key={line} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand/60" />
                  <span>{t(line)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex gap-4">
          <User className="size-6 shrink-0 text-brand" />
          <div className="space-y-2 text-sm leading-relaxed text-muted">
            <h2 className="font-bold text-foreground">{t('Who we are')}</h2>
            <p>{t('BrawlZone (brawlzone.net) and the BrawlZone Bubble Android app are made by Novais Labs, an independent developer in Portugal. This policy covers both. Contact:')}{' '}
              <a
                href={lp(`mailto:${CONTACT_EMAIL}`)}
                className="font-semibold text-foreground underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title={t('Analytics')}
          subtitle={t('Our own counter, plus Google Analytics.')}
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <Server className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>{t('Page views are counted by')}{' '}
                <a
                  href="https://umami.is"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground underline underline-offset-2"
                >{t('Umami')}</a>{t(', running on the same server as the site rather than at a third party. It sets no cookies and stores no personal data, so it needs no consent.')}</p>
              <p>{t('It records the page, the referrer, and coarse details your browser sends anyway: country, browser, operating system, screen size. It does not record IP addresses, and nothing links one visit to another or to a person.')}</p>
              <p>
                {/* Named because a reader is entitled to know what is being counted, and
                    because these are visible in the page source regardless. */}{t('A few named events are also counted, all of them anonymous: installing the web app, opening it, tapping the Android download, tapping the buttons that lead into the Google Play test, and sharing a page as a picture. The download event carries which page it came from and which version was offered, so an upgrade can be told apart from a first install. Nothing else.')}</p>
              <p>{t('The website also uses')}{' '}
                <a
                  href="https://policies.google.com/technologies/partner-sites"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground underline underline-offset-2"
                >{t('Google Analytics')}</a>{t(' to measure visits in aggregate, which advertising partners use to judge the site. It may set cookies. Visitors in the EEA, the UK and Switzerland are asked first, through the same Google consent message as the ads below; until they agree, no analytics cookies are set. The Bubble panel and the Android app do not load it.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title={t('Advertising')}
          subtitle={t('On the website only. The Android app shows no ads.')}
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <Megaphone className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>{t('The website shows ads served by Google AdSense, which pay for the server. Google and its partners may use cookies and similar technology to show and measure ads, including ads based on earlier visits to this and other sites. Visitors in the EEA, the UK and Switzerland are asked first, through Google\'s consent message, and can refuse.')}</p>
              <p>{t('You can turn off personalised ads in')}{' '}
                <a
                  href="https://adssettings.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground underline underline-offset-2"
                >{t('Google\'s ad settings')}</a>{t('. How Google uses this data is explained in')}{' '}
                <a
                  href="https://policies.google.com/technologies/partner-sites"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground underline underline-offset-2"
                >{t('Google\'s own policy')}</a>
                {t('. The BrawlZone Bubble app and its panel show no ads.')}
              </p>
              <p>{t('Our TikTok and YouTube channels are published from our own server: BrawlZone uses YouTube API Services only to upload its own videos to its own channel, and reads no data from visitors\' YouTube or Google accounts. YouTube\'s use of data is covered by the')}{' '}
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground underline underline-offset-2"
                >{t('YouTube Terms of Service')}</a>{t(' and the')}{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-foreground underline underline-offset-2"
                >{t('Google Privacy Policy')}</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title={t('Notifications and the giveaway')}
          subtitle={t('Only if you ask for them, and only what they need.')}
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <BellRing className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>{t('If you tap "Notify me" on the free rewards page, your browser gives us an address at its own push service (Google\'s, Apple\'s or Mozilla\'s) and two keys, and we store them with the page\'s language. They identify a browser, not a person, and are used only to tell you about new free rewards. Tap "Turn off" on the same page, or block notifications in your browser, and the subscription is deleted.')}</p>
              <p>{t('If you enter the giveaway, we store your player tag, the email you give and a scrambled, daily-changing code made from your network address (to stop one network creating fake entries). The email is used only to contact the winner, is never published or shared, and is deleted once the prize is delivered.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title={t('What stays in your browser')}
          subtitle={t('Kept on your device, never sent anywhere.')}
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <HardDrive className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>{t('A handful of preferences live in your browser\'s local storage: saved players and clubs, recent searches, saved rosters, whether you dismissed the install prompt, and — in the Android app\'s panel — the game mode and map you last looked at.')}</p>
              <p>{t('These never leave your device. They are not synced, not backed up by us, and not readable by the server. Clearing your browser data removes them, and the site works without them.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title={t('Looking up a player')}
          subtitle={t('We keep the public game profile, never who searched for it.')}
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <Database className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>{t('Searching a player tag, on the site or in the app, sends it to the official Brawl Stars API to fetch that profile. The public game stats that come back (player name, tag, trophies, rank and brawler counts) are saved once a day so the profile can show progress over time, and the account joins the pool sampled for statistics. Nothing about the person searching is stored: no IP address, no device, no link between a search and whoever made it.')}</p>
              <p>{t('Separately, BrawlZone samples public profiles and battle logs from that same official API to build the statistics the site is for — tier lists, map picks, matchups. That data is public in the game, is stored as aggregates rather than as a dossier on any player, and is bounded by retention windows. There is more about where it comes from on the')}{' '}
                <Link href={lp('/about')} className="font-semibold text-foreground underline underline-offset-2">{t('about page')}</Link>
                .
              </p>
              <p>{t('If your profile appears in the sampled data and you would rather it did not, email')}{' '}
                <a
                  href={lp(`mailto:${CONTACT_EMAIL}`)}
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  {CONTACT_EMAIL}
                </a>{' '}{t('with your tag and it will be excluded.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title={t('The Android app')}
          subtitle={t('No account, no ads, no trackers, and it cannot see your screen.')}
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <Smartphone className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>{t('The bubble needs')}{' '}<span className="font-semibold text-foreground">{t('Display over other apps')}</span>{' '}{t('so it can draw on top of the game. That permission lets it put pixels on your screen; it does not let it read them. The app never captures or reads your screen, and does not read your game account, your files, your contacts or your other apps.')}</p>
              <p>{t('If you enter your player tag, the app sends it to brawlzone.net to show your profile, your brawlers and what to upgrade next, exactly as the site does for a search (see above). The tags you have used, with their player names, and your settings are kept on your phone so you can switch accounts; they are removed when you uninstall the app or clear its data, and a long press removes one.')}</p>
              <p>{t('Its panel is a web view of')}{' '}
                <Link
                  href={lp('/bubble/panel')}
                  className="font-semibold text-foreground underline underline-offset-2"
                >{t('a page on this site')}</Link>{t(', so opening it counts as an anonymous page view here and nothing more. All traffic is encrypted (HTTPS). The app contains no advertising or analytics SDK and shares nothing with third parties.')}</p>
              <p>{t('Installed from Google Play, the app is covered by Google\'s own privacy policy for the Play Store, and Google gives us aggregate statistics such as install counts and crash reports. Downloaded from the')}{' '}
                <Link
                  href={lp('/bubble')}
                  className="font-semibold text-foreground underline underline-offset-2"
                >{t('download page')}</Link>{t(', it comes with a SHA-256 checksum so you can verify the file is the one we published.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title={t('Deleting your data')}
          subtitle={t('Nothing to delete on our side for most people.')}
        />
        <div className="card p-6">
          <div className="flex gap-4">
            <Trash2 className="size-6 shrink-0 text-brand" />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>{t('What is on your device is yours to remove: clear the site\'s data in your browser, or uninstall the app. To have a player profile\'s saved stats deleted and the tag excluded from future sampling, email')}{' '}
                <a
                  href={lp(`mailto:${CONTACT_EMAIL}`)}
                  className="font-semibold text-foreground underline underline-offset-2"
                >
                  {CONTACT_EMAIL}
                </a>{' '}{t('with the tag. It is done within 30 days, usually much sooner.')}</p>
              <p>{t('Sampled battle data is kept only as long as the statistics need it and is then deleted or reduced to aggregates that describe no individual player.')}</p>
              <p>{t('BrawlZone is not directed at children and knowingly collects no personal information from anyone, of any age.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title={t('Other people\'s servers')}
          subtitle={t('What your browser fetches from elsewhere.')}
        />
        <div className="card p-6 text-sm leading-relaxed text-muted">
          <p>{t('Artwork is served from Brawlify\'s CDN, and some images come from the Brawl Stars news feed, the community wiki and YouTube thumbnails. Loading an image means your browser contacts those hosts directly, and they see the request the way any website you visit does. We do not send them anything about you.')}</p>
          <p className="mt-3">{t('The site and the app\'s panel are delivered through Cloudflare, which handles each request (including your IP address) in order to serve and protect it, under its own privacy policy. We do not log IP addresses ourselves.')}</p>
          <p className="mt-3">{t('BrawlZone is unofficial and not endorsed by Supercell. Game data comes from the official Brawl Stars API under their developer terms.')}</p>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-bold">{t('Questions, or a change')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('Email')}{' '}
          <a
            href={lp(`mailto:${CONTACT_EMAIL}`)}
            className="font-semibold text-foreground underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>{t('. If this page ever stops matching what the site actually does, that is a bug — say so and it will be fixed.')}</p>
      </section>
    </div>
  );
}
