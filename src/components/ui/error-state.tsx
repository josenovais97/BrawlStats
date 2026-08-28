import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { ERROR_COPY, type ApiErrorCode } from '@/lib/errors';

interface ErrorStateProps {
  code: ApiErrorCode;
  /** Overrides the default copy when a page has more specific context. */
  title?: string;
  detail?: string;
  /** Shows a "back to search" link. */
  backHref?: string;
  backLabel?: string;
}

/**
 * The single failure surface for every page. Renders friendly copy from the
 * shared vocabulary — never an upstream status code or JSON body.
 */
export function ErrorState({
  code,
  title,
  detail,
  backHref = '/',
  backLabel = 'Back to search',
}: ErrorStateProps) {
  const copy = ERROR_COPY[code];
  const isRetryable = code === 'rateLimited' || code === 'upstreamDown' || code === 'timeout';

  return (
    <div className="card card-glow mx-auto max-w-lg p-8 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-2 text-defeat">
        <AlertTriangle className="size-7" />
      </span>
      <h2 className="mt-4 text-xl font-bold">{title ?? copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{detail ?? copy.detail}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/50 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
        {isRetryable ? (
          <span className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-2 text-sm text-muted">
            <RefreshCw className="size-4" />
            Refresh to retry
          </span>
        ) : null}
      </div>
    </div>
  );
}
