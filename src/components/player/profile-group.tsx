import type { ReactNode } from 'react';

/**
 * One named area of a profile.
 *
 * A full profile is eighteen sections and about six screens on a phone, and
 * before this they were a single flat column. The ordering was not careless —
 * nearly every section carries a comment arguing for the one above it — but
 * local adjacency does not add up to a structure, and the symptom was visible
 * in the navigation: the bar offered four anchors while ten sections sat
 * outside any of them, so most of the page could not be reached from the only
 * means it had of moving around.
 *
 * Five groups, each a nav target, and every section inside one. The grouping
 * also separates the two questions the page was answering at once and
 * interleaving: *what is true about this account* and *what should I do about
 * it*. The advice was spread across six places between the facts; it is one
 * area now, and it comes first, because a reader who came to be told what to
 * do should not have to read a trophy history to find it.
 *
 * The groups are tabs rather than stops on a long scroll. Grouping alone was
 * necessary and not sufficient: the page was still six screens, so it read
 * exactly as it always had -- a reorganisation that was real and invisible.
 */
export function ProfileGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      {/*
        The title is for screen readers only, because the tab above it already
        says the same word -- "OVERVIEW" in the tab bar and "OVERVIEW" again as
        a 3xl heading directly beneath it, on three of the five tabs verbatim.
        Printing it twice cost about ninety pixels before any content on a
        phone, which on the first screen is the difference between seeing the
        skill score and not.
        
        It stays in the markup rather than being deleted: the tab panel is
        labelled, but a heading is still what lets someone navigating by
        headings land here.
        
        The number and the rule went earlier, with the long scroll they were
        for. This is the last of that furniture.
      */}
      <h2 className="sr-only">{title}</h2>
      {/*
        For a fact about this account, not for what the tab is for. Four of
        the five tabs used to open with a line like "Reference rather than
        news" -- the page explaining its own layout to a reader who came to
        see a number -- so those were removed and only Brawlers, whose line
        carries a count, keeps one.
      */}
      {subtitle ? (
        <p className="mb-7 max-w-2xl text-sm leading-relaxed text-muted">{subtitle}</p>
      ) : null}

      {/*
        Generous and uniform. Each section used to set its own distance from
        the next, so the gap between two readouts and the gap between two
        unrelated areas were the same — which is most of why the page read as
        one undifferentiated run. Inside a group things are close; the rule and
        the padding above are what separate the groups.
      */}
      <div className="space-y-10">{children}</div>
    </section>
  );
}
