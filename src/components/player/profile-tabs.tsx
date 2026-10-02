'use client';

import { useEffect, useState, type ReactNode } from 'react';

export interface ProfileTab {
  id: string;
  label: string;
  /** Rendered on the server and passed through; switching never refetches. */
  content: ReactNode;
}

/**
 * The profile's five areas, one at a time.
 *
 * Grouping the eighteen sections was necessary and not sufficient: the page
 * was still six screens of scroll, so it read exactly as it always had. The
 * reorganisation was real and invisible, which is the worst combination.
 *
 * Tabs are what makes it a different page. The reader picks the question they
 * came with and sees one screen instead of hunting down a column for it.
 *
 * **Every tab is rendered and kept in the DOM**, hidden with the `hidden`
 * attribute rather than unmounted. All of it is server-rendered already, so
 * switching costs nothing and refetches nothing — and anything in a hidden
 * tab is still in the document for find-in-page and for anything reading the
 * markup. Unmounting would also throw away the Suspense boundaries that
 * stream the battle log and the world rank.
 *
 * The hash is kept in sync both ways, so a link to `#battles` opens on
 * Battles and a switched tab is a link worth copying. `replaceState` rather
 * than pushing, because a tab is a view of one page and filling someone's
 * back button with five entries of it is not navigation.
 */
export function ProfileTabs({ tabs }: { tabs: ProfileTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.replace('#', '');
      if (tabs.some((t) => t.id === id)) setActive(id);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [tabs]);

  const choose = (id: string) => {
    setActive(id);
    /*
     * Deliberately not `scrollIntoView`. The tab bar is directly under the
     * header and the content starts right below it, so the place to be after
     * a switch is the top of the page — which is where the reader already is.
     */
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <>
      {/*
        Five tabs do not fit across a 390px phone -- measured, the last one is
        off-screen and the one before it is clipped. The strip scrolls, which
        is fine, but a strip that scrolls with no sign that it does is a strip
        with three tabs as far as the reader is concerned.

        So: smaller type below `sm`, and a fade on the right edge that only
        appears when there is something past it. `mask-image` rather than an
        overlaid gradient, because the bar is translucent and blurred over the
        page behind it -- a solid gradient in the site's background colour
        would show as a grey block against whatever scrolled underneath.
      */}
      <div
        role="tablist"
        aria-label="Profile sections"
        className="profile-tabs sticky top-16 z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-border bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6"
      >
        {tabs.map((tab) => {
          const current = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={current}
              aria-controls={`panel-${tab.id}`}
              onClick={() => choose(tab.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors sm:px-3.5 sm:text-sm ${
                current
                  ? 'bg-brand text-brand-ink'
                  : 'text-muted hover:bg-surface-2 hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-label={tab.label}
          hidden={tab.id !== active}
          className="space-y-10"
        >
          {tab.content}
        </div>
      ))}
    </>
  );
}
