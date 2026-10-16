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

export function AccountValueForm({ initial = '' }: { initial?: string }) {
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
        if (valid) router.push(lp(`/account-value/${cleanTag(tag)}`));
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
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-bold text-brand-ink transition-opacity disabled:opacity-50"
      >
        {t('Calculate')}
        <ArrowRight aria-hidden className="size-4" />
      </button>
    </form>
  );
}
