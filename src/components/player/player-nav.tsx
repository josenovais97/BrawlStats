/**
 * Anchor navigation for a profile.
 *
 * A full profile runs to eighteen sections and about six screens on a phone,
 * and the thing a returning visitor wants is usually the battle log at the
 * bottom. Plain anchor links, sticky under the header: no client JavaScript,
 * no scroll listener, and every entry is a real link that works before
 * hydration.
 *
 * **Every group is listed, and that is the fix rather than a detail.** This bar
 * used to offer four anchors — Stats, Progress, Brawlers, Battles — while ten
 * of the page's sections sat outside all four, including the verdict, the
 * upgrade plan and the ranked standing. The most useful parts of the page were
 * unreachable from the only means it had of moving around, and the bar implied
 * they did not exist.
 *
 * `top-16` rather than `top-0`, and that is the whole point of the bar. The
 * site header is also `sticky top-0` and sits on `z-40`; at `top-0` this one
 * docked underneath it and stayed there, so on the longest page of the site the
 * only means of moving around it vanished on the first scroll. It has to stop
 * exactly one header-height down.
 *
 * `scroll-anchor-nav` on the targets (globals.css) clears both bars, so a
 * jumped-to heading lands below this one rather than behind it.
 */
const SECTIONS: { id: string; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'account', label: 'Account' },
  { id: 'next', label: 'Do next' },
  { id: 'battles', label: 'Battles' },
  { id: 'brawlers', label: 'Brawlers' },
];

export function PlayerNav() {
  return (
    <nav
      aria-label="Profile sections"
      className="sticky top-16 z-20 -mx-4 border-b border-border bg-background/85 px-4 backdrop-blur sm:-mx-6 sm:px-6"
    >
      <ul className="flex gap-1 overflow-x-auto py-2">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="block shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
