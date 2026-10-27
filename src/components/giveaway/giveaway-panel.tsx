'use client';

import { Check, Copy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useLp } from '@/components/i18n/use-lp';
import { useT } from '@/components/i18n/use-t';
import { DISCORD_BONUS, REFERRAL_CAP, isCode } from '@/lib/giveaway';

/**
 * The giveaway's interactive half (2026-10-27): the entry form, then the
 * entrant's own count and friend link in the same place.
 *
 * The page around it is static, so this is the only part that reads the
 * address bar: `?ref=` is whose link brought you, `?me=` is your own page.
 * Your code is also kept in this browser, so coming back shows your count
 * rather than the form again.
 */

interface Status {
  code: string;
  playerName: string;
  playerTag: string;
  discord: boolean;
  entries: { base: 1; discord: number; referrals: number; total: number };
}

const KEY = 'bz-giveaway-gw1';
const DISCORD_URL = 'https://discord.gg/964EMQBBUJ';

export function GiveawayPanel({ open }: { open: boolean }) {
  const t = useT();
  const [ref, setRef] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(code: string) {
    const res = await fetch(`/api/giveaway/status?code=${code}`, { cache: 'no-store' }).catch(() => null);
    if (res?.ok) {
      setStatus(await res.json());
      try {
        localStorage.setItem(KEY, code);
      } catch {
        // Private mode: the ?me= link still works.
      }
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('ref');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address and storage are only readable in the browser
    if (isCode(r)) setRef(r);
    let mine = params.get('me');
    if (!isCode(mine)) {
      try {
        mine = localStorage.getItem(KEY);
      } catch {
        mine = null;
      }
    }
    (isCode(mine) ? load(mine) : Promise.resolve()).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="skeleton h-80 rounded-3xl" />;
  if (status) return <MyEntries status={status} />;
  if (!open) {
    return (
      <div className="rounded-3xl bg-surface p-6 text-center text-muted">{t('Entries are closed.')}</div>
    );
  }
  return <EntryForm referredBy={ref} onEntered={load} />;
}

const ERRORS: Record<string, string> = {
  closed: 'Entries are closed.',
  consent: 'Tick the box to confirm your age and the rules.',
  email: 'That email does not look right.',
  tag: 'No Brawl Stars account has that tag. Check it under your name in game.',
  tagTaken: 'This tag is already entered. Lost your page? Write to contact@brawlzone.net.',
  emailTaken: 'This email is already entered. One entry per person.',
  tooMany: 'Too many entries from this network today. Try again tomorrow.',
  unavailable: 'Something went wrong on our side. Try again in a minute.',
};

function EntryForm({ referredBy, onEntered }: { referredBy: string | null; onEntered: (code: string) => Promise<void> }) {
  const t = useT();
  const lp = useLp();
  const [tag, setTag] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/giveaway/enter', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tag: tag.trim().replace(/^#/, ''), email, consent, ref: referredBy }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => null) : null;
    if (body?.ok) {
      window.history.replaceState(null, '', `?me=${body.code}`);
      await onEntered(body.code);
    } else {
      setError(t(ERRORS[body?.error ?? 'unavailable'] ?? ERRORS.unavailable));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl bg-surface p-6 sm:p-8">
      <h2 className="display text-2xl">{t('Enter the giveaway')}</h2>
      {referredBy ? <p className="text-sm text-victory">{t('A friend sent you: entering gives them +1 entry too.')}</p> : null}
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">{t('Your player tag')}</span>
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value.toUpperCase())}
          required
          placeholder="#2PQ8LJ9V"
          autoCapitalize="characters"
          spellCheck={false}
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-base outline-none focus:border-brand/60"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">{t('Your email, only to tell you if you win')}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-base outline-none focus:border-brand/60"
        />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" />
        <span>
          {t('I am 13 or older (under 18: a parent knows I am entering) and I accept the')}{' '}
          <Link href={lp('/giveaway/rules')} className="font-semibold text-brand underline">{t('giveaway rules')}</Link>.
        </span>
      </label>
      {error ? <p className="rounded-xl bg-defeat/15 px-4 py-3 text-sm text-defeat" role="alert">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="btn-game w-full bg-[#3ddc63] py-4 text-2xl text-[#0b2a14] [--btn-shadow:#1a7a33] hover:bg-[#52e676] disabled:opacity-60"
      >
        {busy ? t('Entering…') : t('Enter for free')}
      </button>
    </form>
  );
}

function MyEntries({ status }: { status: Status }) {
  const t = useT();
  const [copied, setCopied] = useState<string | null>(null);
  const link = `https://brawlzone.net/giveaway?ref=${status.code}`;
  const { entries } = status;
  const share = encodeURIComponent(t('Free Brawl Stars giveaway: win a €10 gift card for the Brawl Pass. Enter here:') + ' ' + link);

  function copy(text: string, what: string) {
    navigator.clipboard?.writeText(text).then(() => setCopied(what)).catch(() => {});
  }

  return (
    <div className="space-y-6 rounded-3xl bg-surface p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{t('You are in, {name}!', { name: status.playerName })}</p>
          <p className="display text-game-stroke text-6xl leading-none text-brand">
            {entries.total} <span className="text-3xl text-white">{entries.total === 1 ? t('entry') : t('entries')}</span>
          </p>
        </div>
        <p className="text-sm text-muted">
          {t('Your code')}: <span className="font-mono font-bold text-foreground">{status.code}</span>
        </p>
      </div>

      <ul className="space-y-3">
        <Row done label={t('Entered the giveaway')} value="+1" />
        <Row
          done={status.discord}
          label={status.discord ? t('Confirmed on Discord') : t('Join our Discord and type /giveaway {code}', { code: status.code })}
          value={`+${DISCORD_BONUS}`}
          action={
            status.discord ? null : (
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn-game inline-flex bg-[#5865f2] px-4 py-2 text-white [--btn-shadow:#343c9e]">
                {t('Open Discord')}
              </a>
            )
          }
        />
        <Row
          done={entries.referrals > 0}
          label={t('Friends who entered with your link: {n} of {max}', { n: entries.referrals, max: REFERRAL_CAP })}
          value={`+${entries.referrals}`}
        />
      </ul>

      <div className="space-y-3 rounded-2xl bg-surface-2 p-4">
        <p className="font-semibold">{t('Your friend link: +1 entry for every friend who enters with it')}</p>
        <div className="flex gap-2">
          <input readOnly value={link} className="min-w-0 flex-1 rounded-xl bg-background px-3 py-2.5 text-sm" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" onClick={() => copy(link, 'link')} className="btn-game inline-flex items-center gap-1.5 bg-brand px-4 text-brand-ink">
            {copied === 'link' ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
            {copied === 'link' ? t('Copied') : t('Copy')}
          </button>
        </div>
        <a
          href={`https://wa.me/?text=${share}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-game flex w-full items-center justify-center bg-[#25d366] py-3 text-lg text-[#06260f] [--btn-shadow:#12803c]"
        >
          {t('Send on WhatsApp')}
        </a>
      </div>
      <p className="text-xs text-muted">{t('Keep this page: it is saved in this browser, and the link with your code always shows it.')}</p>
    </div>
  );
}

function Row({ done, label, value, action }: { done: boolean; label: string; value: string; action?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${done ? 'bg-victory text-[#06260f]' : 'bg-surface-3 text-muted'}`}>
        {done ? <Check aria-hidden className="size-4" /> : null}
      </span>
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      {action}
      <span className={`display text-xl ${done ? 'text-victory' : 'text-muted'}`}>{value}</span>
    </li>
  );
}
