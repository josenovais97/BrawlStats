import type { Metadata } from 'next';
import { CalendarDays, ExternalLink, FileText } from 'lucide-react';
import Link from 'next/link';

import { PageHeading } from '@/components/ui/section-heading';
import {
  getLatestReleaseNotes,
  type RichNode,
  type RichText,
  type ReleaseSection,
} from '@/lib/release-notes';

export const metadata: Metadata = {
  title: 'Release notes',
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
              {section.title ? (
                <h2 className="mb-4 flex items-center gap-3 text-xl font-bold tracking-tight">
                  <span className="rule" aria-hidden />
                  {section.title}
                </h2>
              ) : null}
              <RichContent nodes={section.nodes} />
            </section>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        Published by Supercell. Reproduced here for convenience —{' '}
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

function RichContent({ nodes }: { nodes: RichNode[] }) {
  return (
    <div className="space-y-3">
      {nodes.map((node, index) => {
        switch (node.type) {
          case 'heading':
            return node.level === 2 ? (
              <h3
                key={index}
                className="mt-6 text-lg font-bold tracking-tight first:mt-0"
              >
                <Spans spans={node.spans} />
              </h3>
            ) : (
              <h4
                key={index}
                className="mt-5 font-bold capitalize text-brand first:mt-0"
              >
                <Spans spans={node.spans} />
              </h4>
            );

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
