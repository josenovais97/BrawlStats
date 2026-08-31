import type { Metadata } from 'next';
import { CalendarDays, ExternalLink, FileText } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { getBrawlerMap } from '@/lib/brawlapi';
import { getUpcomingBrawlers } from '@/lib/announced';
import { CATEGORY_LABEL, getGameUpdates } from '@/lib/game-updates';
import { brawlerPath } from '@/lib/slugs';
import {
  getLatestReleaseNotes,
  type RichHeading,
  type RichNode,
  type RichText,
  type ReleaseSection,
} from '@/lib/release-notes';

export const metadata: Metadata = {
  alternates: { canonical: '/release-notes' },
  title: 'Brawl Stars update notes',
  description:
    'The latest official Brawl Stars release notes: new brawlers, hypercharges, balance changes and bug fixes.',
};

export const revalidate = 3600;

export default async function ReleaseNotesPage() {
  const notes = await getLatestReleaseNotes();

  if (!notes) {
    return (
      <div className="space-y-6">
        <PageHeading title="Release notes" />
        <p className="card p-6 text-sm text-muted">
          Release notes are unavailable right now. Try again shortly, or read them on{' '}
          <a
            href="https://supercell.com/en/games/brawlstars/blog/"
            target="_blank"
            rel="noreferrer"
            className="text-brand hover:underline"
          >
            supercell.com
          </a>
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
  const brawlerMeta = await getBrawlerMap().catch(() => new Map());
  const updates = await getGameUpdates([...brawlerMeta.values()].map((b) => b.name)).catch(
    () => [],
  );
  const latest = updates[0] ?? null;

  /*
   * Announced but not shipped. Curated by hand — see lib/announced for why
   * there is no source to automate against — and self-retiring: a brawler that
   * has reached the catalogue is no longer upcoming.
   */
  const upcoming = await getUpcomingBrawlers(
    [...brawlerMeta.values()].map((b) => b.name),
  ).catch(() => [] as string[]);

  return (
    <div className="space-y-8">
      <PageHeading
        title={notes.title}
        subtitle="The latest official update notes, straight from the Brawl Stars team."
        aside={
          <a
            href={notes.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
          >
            Read on supercell.com
            <ExternalLink className="size-3.5" />
          </a>
        }
      />

      {upcoming.length > 0 ? (
        <section aria-labelledby="upcoming">
          <SectionHeading
            title="Announced, not yet released"
            subtitle="Revealed but not yet in the game. Found by comparing the community brawler list against the live game catalogue, so it appears on announcement day and clears itself on release day."
          />
          <ul className="flex flex-wrap gap-2">
            {upcoming.map((name) => (
              <li
                key={name}
                className="card px-4 py-2.5 text-base font-bold capitalize"
              >
                {name.toLowerCase()}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Names only. What an unreleased brawler does is video commentary
            until it ships, and every other number on this site is measured.
          </p>
        </section>
      ) : null}

      {latest && latest.changes.length > 0 ? (
        <section aria-labelledby="who-changed">
          <SectionHeading
            title="Who changed"
            subtitle={`Brawlers touched by ${latest.title}, from the community version history.`}
          />
          <div className="space-y-4">
            {latest.changes.map((change) => (
              <div key={change.category} className="card p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {CATEGORY_LABEL[change.category]}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {change.brawlers.map((name) => {
                    const meta = [...brawlerMeta.values()].find(
                      (b) => b.name.toLowerCase() === name.toLowerCase(),
                    );
                    return (
                      <li key={name}>
                        <Link
                          href={meta ? brawlerPath(meta.id, meta.name) : '/brawlers'}
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
          <CalendarDays className="size-4" />
          Published{' '}
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
              {section.title ? <SectionHeading title={section.title} /> : null}
              <RichContent nodes={section.nodes} startLevel={section.title ? 3 : 2} />
            </section>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        Published by Supercell, reproduced here for convenience.{' '}
        <Link href="/news" className="text-brand hover:underline">
          see detected in-game changes
        </Link>{' '}
        for what we track ourselves.
      </p>
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
  const linkable = sections.filter((s) => s.title);
  if (linkable.length < 2) return null;

  return (
    <nav className="lg:sticky lg:top-24 lg:self-start">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <FileText className="size-4" />
        Contents
      </p>
      <ul className="space-y-1">
        {sections.map((section, index) =>
          section.title ? (
            <li key={`${section.title}-${index}`}>
              <a
                href={`#${sectionId(section, index)}`}
                className="block truncate rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                {section.title}
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
