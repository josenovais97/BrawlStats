'use client';

import { useEffect, useState } from 'react';

import { useT } from '@/components/i18n/use-t';

/** "12d 04h 10m" to the close, ticking each minute; rendered only in the browser. */
export function Countdown({ to }: { to: string }) {
  const t = useT();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is read in the browser so the HTML never disagrees with it
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <span className="opacity-0">00d 00h 00m</span>;
  const left = Math.max(0, Date.parse(to) - now);
  if (!left) return <span>{t('Closed')}</span>;
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return (
    <span className="tabular-nums">
      {d}d {String(h).padStart(2, '0')}h {String(m).padStart(2, '0')}m
    </span>
  );
}
