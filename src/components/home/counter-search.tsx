'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { useLp } from '@/components/i18n/use-lp';
import { useT } from '@/components/i18n/use-t';

/**
 * "How to counter ___": type a brawler, land on its counters page. A plain
 * datalist rather than a custom picker -- the browser's own suggestions are
 * keyboard- and screen-reader-friendly for free, and the list is ~100 names.
 */
export function CounterSearch({ brawlers }: { brawlers: { name: string; slug: string }[] }) {
  const t = useT();
  const lp = useLp();
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState('');
  const [missing, setMissing] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const q = value.trim().toLowerCase();
    const hit = brawlers.find((b) => b.name.toLowerCase() === q) ?? brawlers.find((b) => b.name.toLowerCase().startsWith(q));
    if (!q || !hit) {
      setMissing(Boolean(q));
      return;
    }
    router.push(lp(`/brawlers/${hit.slug}/counters`));
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="flex gap-2">
        <input
          list={listId}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMissing(false);
          }}
          placeholder={t('Type a brawler, e.g. Shade')}
          aria-label={t('Brawler to counter')}
          className="min-w-0 flex-1 rounded-lg border border-border-strong/60 bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-bold text-brand-ink hover:bg-brand-strong"
        >
          <Search aria-hidden className="size-4" />
          {t('Counters')}
        </button>
      </div>
      <datalist id={listId}>
        {brawlers.map((b) => (
          <option key={b.slug} value={b.name} />
        ))}
      </datalist>
      {missing ? <p className="text-xs text-defeat">{t('No brawler by that name.')}</p> : null}
    </form>
  );
}
