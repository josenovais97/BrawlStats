import type { Metadata } from 'next';
import { ArrowRight, CalendarDays, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { PageHeading, SectionHeading } from '@/components/ui/section-heading';

import { getUpcomingBrawlers, type UpcomingBrawler } from '@/lib/announced';

import { brawlerPath, slugify } from '@/lib/slugs';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { CHANGE_LABEL, changesFromNotes, getLatestReleaseNotes } from '@/lib/release-notes';
import { formatDate } from '@/lib/format';
import { getSeasonState } from '@/lib/ranked-seasons';
import { currentMonth } from '@/lib/site';
import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

/*
 * Titled for the searches that already find this page ("brawl stars update",
 * "new update", "buffs and nerfs", positions 26-80 in Search Console on
 * 2026-10-16), with the month as the freshness signal every result above it
 * carries.
 */
export function generateMetadata(): Metadata {
  const t = getT(requestLocale());
  return {
    alternates: { canonical: '/release-notes' },
    title: t('Brawl Stars update: patch notes, new brawlers and balance changes ({v})', { v: currentMonth() }),
    description: t('The latest Brawl Stars update at a glance: new brawlers, hypercharges, balance changes and whether they worked, plus what is coming next.'),
  };
}

export const revalidate = 3600;

export default async function ReleaseNotesPage() {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const notes = await getLatestReleaseNotes();

  if (!notes) {
    return (
      <div className="space-y-6">
        <PageHeading title={t('Release notes')} />
        <p className="card p-6 text-sm text-muted">{t('Release notes are unavailable right now. Try again shortly, or read them on')}{' '}
          <a
            href="https://supercell.com/en/games/brawlstars/blog/"
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:underline"
          >{t('supercell.com')}</a>
          .
        </p>
      </div>
    );
  }

  const published = notes.publishedAt ? new Date(notes.publishedAt) : null;

  /*
   * Who the update actually touched.
   *
   * Supercell's post is prose, so it cannot answer "did my brawler change?" —
   * which is the question in the hours after an update, exactly when the
   * searches happen and almost nobody has published yet. The wiki's version
   * history is structured, so this turns it into a list that links straight to
   * the brawler pages people are searching for.
   */
  const brawlerMeta = await getBrawlerArtMap().catch(() => new Map());
  const liveNames = [...brawlerMeta.values()].map((b) => b.name);

  /*
   * Announced but not shipped: the wiki's brawler category minus the game's
   * catalogue (lib/announced), so nothing to curate and self-retiring -- a
   * brawler that has reached the catalogue is no longer upcoming. The health
   * check alerts if the two ever stop agreeing on names.
   */
  const upcoming = await getUpcomingBrawlers(liveNames).catch(() => [] as UpcomingBrawler[]);

  /*
   * Who this update touched, read from the notes being displayed rather than
   * from the wiki. Unreleased brawlers are included in the names to match
   * against, because a "new brawlers" section names exactly the ones the game
   * API does not have yet.
   */
  const changes = changesFromNotes(notes, [...liveNames, ...upcoming.map((b) => b.name)]);
  const season = await getSeasonState().catch(() => null);
  const counts = changes
    .map((c) => ({ label: t(CHANGE_LABEL[c.category]), n: c.brawlers.length, category: c.category }))
    .filter((c) => c.n > 0);

  return (
    <div className="space-y-8">
      <PageHeading
        eyebrow={t(notes.title)}
        title={t('Latest Brawl Stars update')}
        subtitle={t('What the latest update changed, which brawlers it touched, and what is coming next.')}
        aside={
          <a
            href={lp(notes.url)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
          >{t('Read on supercell.com')}<ExternalLink className="size-3.5" />
          </a>
        }
      />

      {/*
        The update at a glance, and what is next. Only dates that are actually
        known: the Ranked season boundary is a published rule, a Brawl Talk
        date is not announced ahead, so none is guessed.
      */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card card-glow space-y-4 p-5">
          <h2 className="font-bold">{t('This update at a glance')}</h2>
          {published ? <p className="text-sm text-muted">{t('Published {date}', { date: formatDate(published) })}</p> : null}
          {counts.length ? (
            <ul className="flex flex-wrap gap-2">
              {counts.map((c) => (
                <li key={c.category} className="rounded-xl border border-border bg-surface-2/60 px-3 py-1.5 text-sm">
                  <span className="font-bold tabular-nums">{c.n}</span> <span className="text-muted">{c.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <Link href={lp('/patches')} className="inline-flex items-center gap-2 font-semibold text-brand hover:underline">
            {t('Did the balance changes work? See the measured impact')}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        <div className="card space-y-3 p-5">
          <h2 className="font-bold">{t('What is next')}</h2>
          {season?.nextStartsOn ? (
            <p className="text-sm">
              <span className="font-semibold">{t('Next Ranked season: {date}', { date: formatDate(season.nextStartsOn) })}</span>
              {season.daysUntilNext !== null ? (
                <span className="text-muted"> · {t('in {n} days', { n: season.daysUntilNext })}</span>
              ) : null}
            </p>
          ) : null}
          {upcoming.length > 0 ? (
            <p className="text-sm">
              <a href="#upcoming" className="font-semibold text-brand hover:underline">
                {t('{n} brawlers revealed and coming soon', { n: upcoming.length })}
              </a>
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-muted">
            {t('Supercell does not announce update or Brawl Talk dates far ahead. They appear here as soon as they are official, with the new notes the day they ship.')}
          </p>
        </div>
      </section>

      {upcoming.length > 0 ? (
        <section aria-labelledby="upcoming">
          <SectionHeading
            title={t('Announced, not yet released')}
            subtitle={t('Revealed in a Brawl Talk and coming to the game. Everything known so far.')}
          />
          <ul className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((b) => (
              <li key={b.name}>
                <Link
                  href={lp(`/brawlers/${slugify(b.name)}`)}
                  className="card card-interactive flex gap-4 p-4 transition-colors hover:border-brand/50"
                >
                {b.portraitUrl ? (
                  <Image
                    src={b.portraitUrl}
                    alt=""
                    width={72}
                    height={72}
                    className="size-18 shrink-0 self-start rounded-xl bg-surface-2 object-contain"
                    loading="lazy"
                    unoptimized
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid size-18 shrink-0 self-start place-items-center rounded-xl border border-dashed border-border bg-surface-2 text-xs text-muted"
                  >
                    ?
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold capitalize">{b.name.toLowerCase()}</p>
                  <p className="label-game mt-0.5 text-xs text-muted">
                    {[b.rarityName, b.className].filter(Boolean).join(' · ') ||
                      t('Details not published yet')}
                  </p>

                  {b.stats.length > 0 ? (
                    <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {b.stats.map((stat) => (
                        <div key={stat.label} className="flex justify-between gap-2">
                          <dt className="truncate text-muted">{t(stat.label)}</dt>
                          <dd className="shrink-0 font-semibold tabular-nums">{stat.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  {b.abilities.length > 0 ? (
                    <ul className="mt-2.5 flex flex-wrap gap-1.5">
                      {b.abilities.map((a, i) => (
                        <li
                          key={`${a.kind}-${a.name ?? i}`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 py-0.5 pl-0.5 pr-2 text-xs text-muted"
                          title={a.kind === 'gadget' ? t('Gadget') : t('Star power')}
                        >
                          {a.imageUrl ? (
                            <Image
                              src={a.imageUrl}
                              alt=""
                              width={20}
                              height={20}
                              className="size-5 shrink-0"
                              loading="lazy"
                              unoptimized
                            />
                          ) : null}
                          {a.name ?? (a.kind === 'gadget' ? t('Gadget') : t('Star power'))}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">{t('Stats and abilities come from the community wiki and fill in over the days after a reveal, so a brawler announced yesterday may show little beyond its name.')}</p>
        </section>
      ) : null}

      {changes.length > 0 ? (
        <section aria-labelledby="who-changed">
          <SectionHeading
            title={t('Who changed')}
            subtitle={t('Every brawler named in {title}, linked to its page here.', { title: notes.title })}
          />
          <div className="space-y-4">
            {changes.map((change) => (
              <div key={change.category} className="card p-4">
                <p className="label-game text-xs text-muted">
                  {CHANGE_LABEL[change.category]}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {change.brawlers.map((name) => {
                    const meta = [...brawlerMeta.values()].find(
                      (b) => b.name.toLowerCase() === name.toLowerCase(),
                    );
                    return (
                      <li key={name}>
                        <Link
                          href={lp(meta ? brawlerPath(meta.id, meta.name) : '/brawlers')}
                          className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 py-1.5 pl-1.5 pr-3 text-sm font-semibold capitalize transition-colors hover:border-brand/50 hover:text-brand"
                        >
                          {meta?.imageUrl ? (
                            <Image
                              src={meta.imageUrl}
                              alt=""
                              width={28}
                              height={28}
                              className="size-7 shrink-0 object-contain"
                              loading="lazy"
                              unoptimized
                            />
                          ) : null}
                          {name.toLowerCase()}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {published ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CalendarDays className="size-4" />{t('Published')}{' '}
          {published.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      ) : null}

      {/*
        Supercell's own notes are linked rather than reproduced (2026-10-29).
        The page used to carry their full text, ~4,900 words of someone
        else's writing, and AdSense rejected the site as "low value content".
        What is ours stays: the summary, who changed, what is coming.
      */}
      <p className="card p-5 text-sm leading-relaxed">
        {t('The full patch notes are on supercell.com:')}{' '}
        <a href={notes.url} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
          {t(notes.title)}
        </a>
        {'. '}
        <Link href={lp('/patches')} className="text-brand hover:underline">{t('Did the balance changes work? See the measured impact')}</Link>
      </p>
    </div>
  );
}
