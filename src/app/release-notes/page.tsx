import type { Metadata } from 'next';
import { ArrowRight, CalendarDays, ExternalLink, FileText } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { PageHeading, SectionHeading } from '@/components/ui/section-heading';

import { getUpcomingBrawlers, type UpcomingBrawler } from '@/lib/announced';

import { brawlerPath, slugify } from '@/lib/slugs';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { CHANGE_LABEL, changesFromNotes,
  getLatestReleaseNotes,
  type RichHeading,
  type RichNode,
  type RichText,
  type ReleaseSection } from '@/lib/release-notes';
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
        subtitle={t('The latest official update notes, straight from the Brawl Stars team.')}
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
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-muted">
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
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
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

      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Contents sections={notes.sections} />

        <div className="min-w-0 space-y-6">
          {notes.sections.map((section, index) => (
            <section
              key={`${section.title ?? 'section'}-${index}`}
              id={sectionId(section, index)}
              className="card scroll-mt-24 p-6"
            >
              {section.title ? <SectionHeading title={t(section.title)} /> : null}
              <RichContent nodes={section.nodes} startLevel={section.title ? 3 : 2} />
            </section>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">{t('Published by Supercell, reproduced here for convenience.')}{' '}
        <Link href={lp('/news')} className="text-brand hover:underline">{t('see detected in-game changes')}</Link>{' '}{t('for what we track ourselves.')}</p>
    </div>
  );
}

function sectionId(section: ReleaseSection, index: number): string {
  const base = section.title
    ? section.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    : `section-${index}`;
  return base || `section-${index}`;
}

/** Sticky in-page navigation — these posts are long. */
function Contents({ sections }: { sections: ReleaseSection[] }) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const linkable = sections.filter((s) => s.title);
  if (linkable.length < 2) return null;

  return (
    <nav className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <FileText className="size-4" />{t('Contents')}</p>
      <ul className="space-y-1">
        {sections.map((section, index) =>
          section.title ? (
            <li key={`${section.title}-${index}`}>
              <a
                href={lp(`#${sectionId(section, index)}`)}
                className="block truncate rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {t(section.title)}
              </a>
            </li>
          ) : null,
        )}
      </ul>
    </nav>
  );
}

/**
 * Supercell's own heading levels are not a contiguous scale.
 *
 * A section's body can contain level-3 headings with no level 2 anywhere above
 * them, and mapping level to tag directly emitted h2 -> h4 seven times over on
 * this page. Heading level is how a screen reader moves through a long
 * document, and this is the longest text page on the site.
 *
 * So the levels present are ranked rather than translated: whatever is
 * shallowest in *this* section becomes the first tag below its wrapper, and
 * anything deeper becomes exactly one step further down. The outline is then
 * contiguous no matter what the source did.
 */
function RichContent({
  nodes,
  startLevel = 3,
}: {
  nodes: RichNode[];
  /** h3 under a titled section's h2; h2 when the section has no title. */
  startLevel?: 2 | 3;
}) {
  const present = [
    ...new Set(nodes.flatMap((node) => (node.type === 'heading' ? [node.level] : []))),
  ].sort((a, b) => a - b);

  const deepest = (level: RichHeading['level']) => present.indexOf(level) > 0;

  const tagFor = (level: RichHeading['level']) =>
    (deepest(level) ? `h${startLevel + 1}` : `h${startLevel}`) as 'h2' | 'h3' | 'h4';

  return (
    <div className="space-y-3">
      {nodes.map((node, index) => {
        switch (node.type) {
          case 'heading': {
            const Tag = tagFor(node.level);
            const deep = deepest(node.level);
            return (
              <Tag
                key={index}
                className={
                  deep
                    ? 'mt-5 font-bold capitalize text-brand first:mt-0'
                    : 'mt-6 text-lg font-bold tracking-tight first:mt-0'
                }
              >
                <Spans spans={node.spans} />
              </Tag>
            );
          }

          case 'list':
            return (
              <ul key={index} className="space-y-1.5">
                {node.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2.5 text-sm leading-relaxed">
                    <span
                      aria-hidden
                      className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-brand/70"
                    />
                    <span className="min-w-0 text-muted">
                      {item.map((paragraph, pIndex) => (
                        <span key={pIndex} className="block">
                          <Spans spans={paragraph.spans} />
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            );

          default:
            return (
              <p key={index} className="text-sm leading-relaxed text-muted">
                <Spans spans={node.spans} />
              </p>
            );
        }
      })}
    </div>
  );
}

function Spans({ spans }: { spans: RichText[] }) {
  if (spans.length === 0) return null;

  return (
    <>
      {spans.map((span, index) => {
        // Preserve the newlines the source uses for spacing inside a run.
        const parts = span.value.split('\n');
        const content = parts.map((part, partIndex) => (
          <span key={partIndex}>
            {partIndex > 0 ? <br /> : null}
            {part}
          </span>
        ));

        const className = [
          span.marks.includes('bold') ? 'font-semibold text-foreground' : '',
          span.marks.includes('italic') ? 'italic' : '',
          span.marks.includes('underline') ? 'underline underline-offset-2' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return className ? (
          <span key={index} className={className}>
            {content}
          </span>
        ) : (
          <span key={index}>{content}</span>
        );
      })}
    </>
  );
}
