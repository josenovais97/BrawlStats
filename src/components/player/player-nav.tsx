/**
 * Anchor navigation for a profile.
 *
 * A full profile runs to a dozen sections and about four screens on a phone,
 * and the thing a returning visitor wants is usually the battle log at the
 * bottom. Plain anchor links, sticky under the header: no client JavaScript,
 * no scroll listener, and every entry is a real link that works before hydration.
 *
 * `scroll-margin-top` on the targets (set in globals.css) is what keeps a
 * jumped-to heading from landing underneath this bar.
 */
const SECTIONS: { id: string; label: string }[] = [
  { id: 'stats', label: 'Stats' },
  { id: 'progress', label: 'Progress' },
  { id: 'brawlers', label: 'Brawlers' },
  { id: 'battles', label: 'Battles' },
];

export function PlayerNav() {
  return (
    <nav
      aria-label="Profile sections"
      className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/85 px-4 backdrop-blur sm:-mx-6 sm:px-6"
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
