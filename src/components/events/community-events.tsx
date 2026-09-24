import Image from 'next/image';

import { formatDate } from '@/lib/format';
import { COMMUNITY_EVENTS_URL, type CommunityEvent } from '@/lib/community-events';

/**
 * The game-wide challenges, each with its milestones and what they paid out.
 *
 * Presented as a list of expandable cards rather than seven tables stacked
 * down the page. The live one is worth reading now; the finished ones are a
 * record, and a record should be available without being scrolled past — at
 * full height, six closed write-ups are several screens of table.
 *
 * `<details>` rather than state: this is a server component on a page with no
 * other interactivity, and the browser already knows how to open a disclosure.
 */
export function CommunityEvents({ events }: { events: CommunityEvent[] }) {
  if (events.length === 0) return null;

  const [latest, ...rest] = events;

  return (
    <section className="space-y-4">
      {/* The newest is open by default — if one is running, this is it. */}
      <EventCard event={latest} open />

      {rest.length > 0 ? (
        <div className="space-y-3">
          {rest.map((event) => (
            <EventCard key={event.slug} event={event} />
          ))}
        </div>
      ) : null}

      <p className="px-1 text-xs leading-relaxed text-muted">
        Milestones and rewards are written up by the{' '}
        <a
          href={COMMUNITY_EVENTS_URL}
          rel="noopener nofollow"
          className="font-medium text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-brand"
        >
          Brawl Stars wiki
        </a>{' '}
        community and read from it automatically, so a new event appears here
        without the site being changed. Text is CC BY-SA.
      </p>
    </section>
  );
}

function EventCard({ event, open = false }: { event: CommunityEvent; open?: boolean }) {
  return (
    <details
      id={event.slug}
      open={open}
      className="card group overflow-hidden [&[open]_.chev]:rotate-180"
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 transition-colors hover:bg-surface-2/50">
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-lg bg-surface-2 object-contain p-1"
            loading="lazy"
            unoptimized
          />
        ) : (
          <span aria-hidden className="size-14 shrink-0 rounded-lg bg-surface-2" />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{event.name}</span>
          <span className="block truncate text-xs text-muted">
            {event.startedOn ? `Started ${formatDate(event.startedOn)}` : 'Date unknown'}
            {event.table ? ` · ${event.table.rows.length} milestones` : ''}
          </span>
        </span>

        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="chev size-4 shrink-0 text-muted transition-transform"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <div className="space-y-4 border-t border-border p-4">
        {event.description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-muted">{event.description}</p>
        ) : null}

        {event.table ? <MilestoneTable table={event.table} /> : null}
      </div>
    </details>
  );
}

/**
 * The milestone table, whatever shape it is.
 *
 * Column counts run from two to six across the seven events on the page, so
 * nothing here assumes a layout. It scrolls inside its own container rather
 * than widening the page, because a six-column table of reward text does not
 * fit a phone and a page that scrolls sideways is worse than a table that
 * does.
 */
function MilestoneTable({ table }: { table: NonNullable<CommunityEvent['table']> }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr className="text-left">
            {table.headers.map((header, i) => (
              <th
                key={`${header}-${i}`}
                scope="col"
                className="whitespace-nowrap border-b border-border-strong px-2 py-2 text-xs font-bold uppercase tracking-wide text-muted"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {table.rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-2 py-2 leading-snug ${
                    j === 0 ? 'font-semibold tabular-nums' : 'text-muted'
                  }`}
                >
                  {cell || <span className="text-muted/50">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
