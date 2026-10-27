'use client';

import { Check, Copy, HelpCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { useLp } from '@/components/i18n/use-lp';
import { useT } from '@/components/i18n/use-t';
import { playerIconUrl } from '@/lib/brawlapi';
import { DISCORD_BONUS, FOLLOW_PLATFORMS, isCode, type FollowPlatform } from '@/lib/giveaway';
import { readRecentSearches, serverRecentSearches, subscribeRecentSearches } from '@/lib/recent-searches';

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
  followed: Record<FollowPlatform, boolean>;
  entries: { base: 1; discord: number; follows: number; referrals: number; total: number };
}

const KEY = 'bz-giveaway-gw1';
const DISCORD_URL = 'https://discord.gg/964EMQBBUJ';

/** Where each follow button goes, and its colours (the site's btn-game shape). */
const FOLLOW: Record<FollowPlatform, { url: string; label: string; done: string; className: string }> = {
  youtube: {
    url: 'https://www.youtube.com/@brawlzonenet?sub_confirmation=1',
    label: 'Subscribe on YouTube',
    done: 'Subscribed on YouTube',
    className: 'bg-[#ff0033] text-white [--btn-shadow:#a3001f]',
  },
  tiktok: {
    url: 'https://www.tiktok.com/@brawlzone.net',
    label: 'Follow on TikTok',
    done: 'Following on TikTok',
    className: 'bg-white text-[#10142a] [--btn-shadow:#9aa3c0]',
  },
  instagram: {
    url: 'https://www.instagram.com/brawlzonenet/',
    label: 'Follow on Instagram',
    done: 'Following on Instagram',
    className: 'bg-[#e1306c] text-white [--btn-shadow:#8f1c45]',
  },
};

export function GiveawayPanel({ open, closedNote }: { open: boolean; closedNote?: string }) {
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
  if (status) return <MyEntries status={status} onChange={() => load(status.code)} />;
  if (!open) {
    return (
      <div className="rounded-3xl bg-surface p-6 text-center text-muted">{closedNote ?? t('Entries are closed.')}</div>
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
  const [help, setHelp] = useState(false);
  // Profiles this browser has looked up: most visitors have searched their own.
  const recent = useSyncExternalStore(subscribeRecentSearches, readRecentSearches, serverRecentSearches)
    .filter((r) => r.kind === 'player')
    .slice(0, 3);

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
      {referredBy ? <p className="text-sm text-victory">{t('A friend sent you: entering gives them +1 point.')}</p> : null}
      <div className="space-y-2">
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between gap-3 text-sm font-semibold">
            {t('Your player tag')}
            <button
              type="button"
              onClick={() => setHelp((h) => !h)}
              aria-expanded={help}
              className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
            >
              <HelpCircle aria-hidden className="size-4" />
              {t("Where's my tag?")}
            </button>
          </span>
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
        {recent.length && !tag ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{t('Is this you?')}</span>
            {recent.map((r) => (
              <button
                key={r.tag}
                type="button"
                onClick={() => setTag(`#${r.tag}`)}
                className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 font-semibold hover:bg-surface-3"
              >
                <Image src={playerIconUrl(r.icon)} alt="" width={24} height={24} className="size-6 rounded-full" unoptimized />
                {r.name ?? `#${r.tag}`}
              </button>
            ))}
          </div>
        ) : null}
        {help ? <TagHelp /> : null}
      </div>
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

function MyEntries({ status, onChange }: { status: Status; onChange: () => Promise<void> }) {
  const t = useT();

  /* The profile opens in a new tab from the click itself (a popup opened
     after an await is blocked), and the point is claimed alongside it. */
  function follow(platform: FollowPlatform) {
    window.open(FOLLOW[platform].url, '_blank', 'noopener,noreferrer');
    fetch('/api/giveaway/follow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: status.code, platform }),
    })
      .then(() => onChange())
      .catch(() => {});
  }
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
            {entries.total} <span className="text-3xl text-white">{entries.total === 1 ? t('point') : t('points')}</span>
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
        {FOLLOW_PLATFORMS.map((p) => (
          <Row
            key={p}
            done={status.followed[p]}
            label={status.followed[p] ? t(FOLLOW[p].done) : t(FOLLOW[p].label)}
            value="+1"
            action={
              status.followed[p] ? null : (
                <button type="button" onClick={() => follow(p)} className={`btn-game inline-flex px-4 py-2 ${FOLLOW[p].className}`}>
                  {t('Follow')}
                </button>
              )
            }
          />
        ))}
        <Row
          done={entries.referrals > 0}
          label={t('Friends who entered with your link: {n}', { n: entries.referrals })}
          value={`+${entries.referrals}`}
        />
      </ul>

      <div className="space-y-3 rounded-2xl bg-surface-2 p-4">
        <p className="font-semibold">{t('Your friend link: +1 point for every friend who enters with it')}</p>
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

/**
 * Where the tag is, drawn rather than screenshotted: a mini profile card with
 * the tag marked, and the three steps. Most kids have never needed their tag,
 * and not finding it is the likeliest reason to leave without entering.
 */
function TagHelp() {
  const t = useT();
  return (
    <div className="space-y-4 rounded-2xl bg-surface-2 p-4">
      <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl border-[3px] border-[#10142a] bg-[#2b2166] p-3 pr-5 shadow-[0_4px_0_#10142a]">
        <Image src={playerIconUrl(28000000)} alt="" width={56} height={56} className="size-14 rounded-xl" unoptimized />
        <div>
          <p className="display text-lg leading-tight text-white">{t('Your name')}</p>
          <p className="relative mt-1 inline-block rounded-lg bg-brand px-2 py-0.5 font-mono text-sm font-bold text-brand-ink ring-4 ring-brand/30">
            #2PQ8LJ9V
          </p>
        </div>
        <span aria-hidden className="display text-3xl text-brand">←</span>
      </div>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm">
        <li>{t('Open Brawl Stars and tap your profile picture, top left.')}</li>
        <li>{t('Your tag is right under your name. It starts with #.')}</li>
        <li>{t('Type it here, with or without the #.')}</li>
      </ol>
    </div>
  );
}
