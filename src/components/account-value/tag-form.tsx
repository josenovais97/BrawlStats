'use client';

import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLp } from '@/components/i18n/use-lp';
import { useT } from '@/components/i18n/use-t';

/** "#2PQ8..." in, /account-value/2PQ8... out. Same clean-up the Bubble applies. */
function cleanTag(raw: string): string {
  return raw.trim().replace(/^#/, '').toUpperCase().replace(/\s+/g, '').replace(/O/g, '0');
}

/**
 * A tag box that opens `<base>/<tag>`. Roast My Account (2026-10-27) uses it
 * with its own base and button; `cta` arrives already translated.
 */
export function AccountValueForm({
  initial = '',
  base = '/account-value',
  cta,
}: {
  initial?: string;
  base?: string;
  cta?: string;
}) {
  const t = useT();
  const lp = useLp();
  const router = useRouter();
  const [tag, setTag] = useState(initial);
  const valid = /^[0289PYLQGRJCUV]{3,15}$/.test(cleanTag(tag));

  return (
    <form
      className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(lp(`${base}/${cleanTag(tag)}`));
      }}
    >
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder={t('Your player tag, e.g. #2PQ8LJ9V')}
        autoCapitalize="characters"
        spellCheck={false}
        className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-base outline-none focus:border-brand/60"
      />
      <button
        type="submit"
        disabled={!valid}
        className="btn-game inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-strong px-6 py-3.5 text-brand-ink disabled:opacity-50"
      >
        {cta ?? t('Calculate')}
        <ArrowRight aria-hidden className="size-4" />
      </button>
    </form>
  );
}
