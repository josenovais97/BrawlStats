'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A reward's picture, falling back to our own art if the first one fails.
 *
 * The wiki's image CDN has refused a box before (2456e81), and a page whose
 * point is the picture should not show a broken one. The effect catches an
 * image that failed before hydration, when `onError` was not yet attached.
 */
export function RewardArt({ src, fallback, className, size }: { src: string; fallback: string; className?: string; size: number }) {
  const [current, setCurrent] = useState(src);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setCurrent(fallback);
  }, [fallback]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote or local art at a fixed small size
    <img ref={ref} src={current} alt="" width={size} height={size} className={className} onError={() => setCurrent(fallback)} />
  );
}
