'use client';

import Link, { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react';

/**
 * Filter navigation for the tier list that stays put and says it is working.
 *
 * The chips are plain links -- every combination is its own cacheable,
 * crawlable URL -- and that stays. Two things changed on 2026-10-13, both
 * reported by the site's owner:
 *
 * - A tap scrolled the page back to the top, so changing the mode from the
 *   middle of the list threw the reader away from what they were looking at.
 *   The links now keep the scroll position.
 * - Nothing happened on screen between the tap and the new list, which on a
 *   page nobody had opened lately could be a couple of seconds. The tapped
 *   chip now spins and the list dims under a loading bar until it arrives.
 */

const Pending = createContext<{ pending: boolean; start: () => void }>({
  pending: false,
  start: () => undefined,
});

export function TierNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  // The new page has arrived when the path changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPending(false), [pathname]);
  return <Pending.Provider value={{ pending, start: () => setPending(true) }}>{children}</Pending.Provider>;
}

/** The spinner inside the chip being loaded. */
function ChipSpinner() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span
      aria-hidden
      className="ml-1.5 inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]"
    />
  ) : null;
}

/* The map chosen under a mode (`#map=<mode>/<map>`, see RankedMapSwitch). */
const subscribeHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const readMapHash = () => (window.location.hash.startsWith('#map=') ? window.location.hash : '');

export function NavLink({
  children,
  href,
  keepMap = false,
  ...rest
}: ComponentProps<typeof Link> & {
  /**
   * Carry the chosen map across. For the rank chips: the same mode at another
   * rank has the same maps, so switching rank on Hard Rock Mine should stay
   * on Hard Rock Mine rather than fall back to every map.
   */
  keepMap?: boolean;
}) {
  const { start } = useContext(Pending);
  const pathname = usePathname();
  const hash = useSyncExternalStore(subscribeHash, keepMap ? readMapHash : () => '', () => '');
  const target = typeof href === 'string' && hash ? `${href}${hash}` : href;
  return (
    <Link
      {...rest}
      href={target}
      scroll={false}
      onNavigate={() => {
        // The chip already lit is a no-op, not a load that never finishes.
        if (typeof href === 'string' && href.split('#')[0] === pathname) return;
        start();
      }}
    >
      {children}
      <ChipSpinner />
    </Link>
  );
}

/** The list under the controls: dimmed, with a running bar, while loading. */
export function PendingArea({ children }: { children: ReactNode }) {
  const { pending } = useContext(Pending);
  return (
    <div aria-busy={pending} className="relative">
      {pending ? (
        <div className="pointer-events-none absolute inset-x-0 -top-3 z-10 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-1/3 animate-[tier-load_1s_ease-in-out_infinite] rounded-full bg-brand" />
        </div>
      ) : null}
      <div className={`transition-opacity duration-150 ${pending ? 'pointer-events-none opacity-40' : ''}`}>
        {children}
      </div>
    </div>
  );
}
