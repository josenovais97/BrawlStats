'use client';

import { useEffect } from 'react';

import { ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { FullPageMessage } from '@/components/ui/full-page-message';
import { useT } from '@/components/i18n/use-t';
import { useLp } from '@/components/i18n/use-lp';

/**
 * The root error boundary. Error boundaries must be Client Components.
 *
 * The recovery prop is `retry` in this version of Next, not the `reset` that
 * older examples use — passing the wrong name silently gives you a button that
 * does nothing, since it is just an undefined prop being called.
 *
 * Most failures behind this screen are upstream: the game API rate-limiting, a
 * wiki timeout, a cold database. All of those clear on their own, which is why
 * retry leads rather than being offered as an afterthought.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useT();
  const lp = useLp();
  useEffect(() => {
    // No error reporting service here, so the console is where a digest can
    // still be recovered from a user's own devtools.
    console.error(error);
  }, [error]);

  return (
    <FullPageMessage
      title={t('Something went wrong')}
      body={t('This page could not be loaded. It is usually the game API being slow or rate-limited, which clears on its own — trying again often just works.')}
    >
      <button
        type="button"
        onClick={() => retry()}
        className="btn-game inline-flex items-center gap-2 bg-brand px-6 py-3 uppercase text-[#1a1200] hover:bg-brand-strong"
      >
        <RefreshCw className="size-4" />{t('Try again')}</button>
      <Link
        href={lp('/')}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />{t('Back to search')}</Link>
    </FullPageMessage>
  );
}
