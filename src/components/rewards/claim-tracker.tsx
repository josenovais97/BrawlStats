'use client';

import { Check } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

import { useT } from '@/components/i18n/use-t';

/*
 * Which rewards this visitor has tapped Claim on, and when they last opened
 * the page (2026-11-11). Kept on the phone only: a convenience, so a
 * returning visitor sees at a glance what is new and what is done. Storage
 * can be missing or throw (private mode, blocked site data); everything then
 * simply shows nothing extra.
 */
const CLAIMED_KEY = 'bz-claimed';
const SEEN_KEY = 'bz-rewards-seen';

let claimed: Set<string> | null = null;
/** The previous visit, read once per page load, before this visit is written. */
let lastSeen: number | null = null;
let version = 0;
const subs = new Set<() => void>();

function load() {
  if (claimed) return;
  try {
    claimed = new Set(JSON.parse(localStorage.getItem(CLAIMED_KEY) || '[]') as string[]);
    lastSeen = Number(localStorage.getItem(SEEN_KEY)) || null;
  } catch {
    claimed = new Set();
    lastSeen = null;
  }
}

function markClaimed(id: string) {
  load();
  if (claimed!.has(id)) return;
  claimed!.add(id);
  try {
    localStorage.setItem(CLAIMED_KEY, JSON.stringify([...claimed!].slice(-200)));
  } catch {
    // Kept in memory for this visit.
  }
  version += 1;
  subs.forEach((f) => f());
}

function subscribe(f: () => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** 0 on the server and before load, so server HTML never carries a guess. */
function useStore(): number {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return version + 1;
    },
    () => 0,
  );
}

/** "Claimed" or "New" beside a reward, once the phone's record is read. */
export function RewardFlag({ id, postedAt }: { id: string; postedAt: string }) {
  const t = useT();
  const ready = useStore();
  if (!ready) return null;
  if (claimed?.has(id)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-victory px-2 py-0.5 text-xs font-black text-ink">
        <Check aria-hidden className="size-3.5" strokeWidth={3} />
        {t('Claimed')}
      </span>
    );
  }
  if (lastSeen && Date.parse(postedAt) > lastSeen) {
    return <span className="rounded-full border-2 border-ink bg-brand px-2 py-0.5 text-xs font-black uppercase text-brand-ink">{t('New')}</span>;
  }
  return null;
}

/**
 * How many of the live rewards this phone has claimed, above the list. Also
 * records Claim taps (any `[data-claim][data-reward-id]` link) and, on the way
 * out of the first render, this visit's time for the next "New" badges.
 */
export function ClaimSummary({ ids }: { ids: string[] }) {
  const t = useT();
  const ready = useStore();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest<HTMLElement>('[data-claim][data-reward-id]');
      const id = link?.dataset.rewardId;
      if (id) markClaimed(id);
    };
    document.addEventListener('click', onClick, true);
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      // No record of the visit; "New" just will not show next time.
    }
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  if (!ready || ids.length === 0) return null;
  const done = ids.filter((id) => claimed?.has(id)).length;
  const all = done === ids.length;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink bg-surface px-4 py-3">
      <span className="flex gap-1.5" aria-hidden>
        {ids.map((id) => (
          <span key={id} className={`size-3 rounded-full border-2 border-ink ${claimed?.has(id) ? 'bg-victory' : 'bg-surface-3'}`} />
        ))}
      </span>
      <span className="text-sm font-bold">
        {all
          ? t('All {n} claimed. New ones show up here first.', { n: ids.length })
          : done > 0
            ? t('You claimed {done} of {n}. Tap Claim on the rest.', { done, n: ids.length })
            : t('{n} free rewards live. Tap Claim on each one and they get ticked off here.', { n: ids.length })}
      </span>
    </div>
  );
}
