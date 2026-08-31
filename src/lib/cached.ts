import { unstable_cache } from 'next/cache';

/**
 * `unstable_cache`, but it degrades instead of throwing outside Next.
 *
 * Outside a server context there is no incremental cache and `unstable_cache`
 * raises `Invariant: incrementalCache missing` rather than simply not caching.
 * Any plain script that imports a module using it therefore explodes on the
 * first call — and it is invisible to `tsc`, eslint and `next build`, because
 * none of them run the script.
 *
 * That has now cost real time twice: a Discord bot that reported "nothing
 * moved" every day while every call was failing, and a parser that could not
 * be tested outside a request. Running uncached is exactly right for a script,
 * which runs once and exits, so there is nothing for a cache to amortise.
 *
 * Matched on the specific invariant, never broadly: a genuine database or
 * network error must still reach the caller rather than being silently retried
 * and swallowed.
 */
export function cached<A extends unknown[], R>(
  key: string,
  fn: (...args: A) => Promise<R>,
  revalidate: number,
): (...args: A) => Promise<R> {
  const wrapped = unstable_cache(fn as (...args: unknown[]) => Promise<R>, [key], { revalidate });
  return async (...args: A) => {
    try {
      return await wrapped(...(args as unknown[]));
    } catch (error) {
      if (error instanceof Error && error.message.includes('incrementalCache missing')) {
        return fn(...args);
      }
      throw error;
    }
  };
}
