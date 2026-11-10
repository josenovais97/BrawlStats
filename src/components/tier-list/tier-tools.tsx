'use client';

import { ArrowDown, LayoutGrid, Rows3, Search, UserRound, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useMemo, useState, useSyncExternalStore, type FormEvent, type MouseEvent, type ReactNode } from 'react';

import { useLocale } from '@/components/i18n/use-locale';
import { useLp } from '@/components/i18n/use-lp';
import { useT } from '@/components/i18n/use-t';
import { NUMBER_LOCALE, type Locale } from '@/lib/i18n';
import { readRosters, saveRoster, serverRosters, subscribeRosters } from '@/lib/roster';
import { normalizeTag } from '@/lib/tags';
import { TIER_COLOR, TIER_ORDER } from '@/lib/tiers';
import type { TierBrawlerDetail } from '@/lib/tier-brawler';
import type { Tier } from '@/types/stats';

import { TierDrawer } from './tier-drawer';

/** What the toolbar needs of each rated brawler. */
export interface TierToolEntry {
  id: number;
  name: string;
  href: string;
  image: string | null;
  framed: boolean;
  tier: Tier;
  score: number | null;
  winRate: number | null;
  pickRate: number | null;
  games: number;
}

type View = 'grid' | 'table';
type Scope = 'all' | 'owned' | 'power11';
type SortKey = 'score' | 'winRate' | 'pickRate' | 'games' | 'name';

function percent(value: number | null, locale: Locale): string {
  if (value === null) return '–';
  const n = (value * 100).toLocaleString(NUMBER_LOCALE[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return locale === 'tr' ? `%${n}` : locale === 'fr' ? `${n} %` : `${n}%`;
}

/**
 * Tools over the tier rows (2026-11-10): find a brawler, light up the ones an
 * account owns, or read the whole list as a sortable table.
 *
 * The rows stay server-rendered and in the page whatever the view; finding
 * and owning only dim chips through a generated style rule, and the table is
 * drawn here from the same numbers. Owned brawlers come from the rosters the
 * profile page saves in this browser (lib/roster), or from a tag typed here.
 */
export function TierTools({
  entries,
  modes,
  children,
}: {
  entries: TierToolEntry[];
  /** On the Ranked list, its modes: the panel leaves the rest out. */
  modes?: string[];
  children: ReactNode;
}) {
  const t = useT();
  const lp = useLp();
  const locale = useLocale();
  const rosters = useSyncExternalStore(subscribeRosters, readRosters, serverRosters);
  const [view, setView] = useState<View>('grid');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [chosen, setChosen] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [tag, setTag] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [sort, setSort] = useState<SortKey>('score');
  const [openId, setOpenId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, TierBrawlerDetail | 'failed'>>({});

  const roster = rosters.find((r) => r.tag === chosen) ?? rosters[0] ?? null;
  const owned = useMemo(() => {
    if (!roster || scope === 'all') return null;
    return new Set(scope === 'power11' ? roster.power11 : roster.owned);
  }, [roster, scope]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => entries.filter((e) => (!q || e.name.toLowerCase().includes(q)) && (!owned || owned.has(e.id))),
    [entries, q, owned],
  );
  const filtering = Boolean(q) || owned !== null;

  // Dim every chip, then undim the ones that pass, by id.
  const rule = filtering
    ? `#tier-tools .tier-chip{opacity:.22;filter:grayscale(1);transition:opacity .2s}` +
      (visible.length
        ? `#tier-tools .tier-chip:is(${visible.map((e) => `[data-bid="${e.id}"]`).join(',')}){opacity:1;filter:none}`
        : '')
    : '';

  const perTier = useMemo(() => {
    if (!owned) return [];
    return TIER_ORDER.map((tier) => {
      const inTier = entries.filter((e) => e.tier === tier);
      return { tier, total: inTier.length, have: inTier.filter((e) => owned.has(e.id)).length };
    }).filter((x) => x.total > 0);
  }, [entries, owned]);

  const rows = useMemo(() => {
    const list = [...visible];
    const by = (v: (e: TierToolEntry) => number | null) => (a: TierToolEntry, b: TierToolEntry) => (v(b) ?? -1) - (v(a) ?? -1);
    switch (sort) {
      case 'winRate':
        return list.sort(by((e) => e.winRate));
      case 'pickRate':
        return list.sort(by((e) => e.pickRate));
      case 'games':
        return list.sort(by((e) => e.games));
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list.sort(by((e) => e.score));
    }
  }, [visible, sort]);
  const rank = useMemo(() => new Map([...entries].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((e, i) => [e.id, i + 1])), [entries]);

  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const close = useCallback(() => setOpenId(null), []);

  /* The panel opens on a plain tap of a chip or a table name; a tap with a
     modifier key, or no script at all, still follows the link. */
  function open(id: number) {
    setOpenId(id);
    if (details[id]) return;
    fetch(`/api/tier-brawler/${id}?lang=${locale}${modes?.length ? `&modes=${modes.join(',')}` : ''}`)
      .then((r) => (r.ok ? (r.json() as Promise<TierBrawlerDetail>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => setDetails((prev) => ({ ...prev, [id]: d })))
      .catch(() => setDetails((prev) => ({ ...prev, [id]: 'failed' })));
  }
  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-bid]');
    const id = el ? Number(el.dataset.bid) : NaN;
    if (!el || !byId.has(id)) return;
    event.preventDefault();
    event.stopPropagation();
    open(id);
  }

  async function addTag(event: FormEvent) {
    event.preventDefault();
    const clean = normalizeTag(tag);
    if (!clean) return;
    setStatus('loading');
    try {
      const res = await fetch(`/api/player/${encodeURIComponent(clean)}`);
      if (!res.ok) throw new Error(String(res.status));
      const player = (await res.json()) as { tag: string; name: string; brawlers: { id: number; power: number }[] };
      saveRoster({
        tag: normalizeTag(player.tag),
        name: player.name,
        owned: player.brawlers.map((b) => b.id),
        power11: player.brawlers.filter((b) => b.power >= 11).map((b) => b.id),
      });
      setChosen(normalizeTag(player.tag));
      setScope('owned');
      setAsking(false);
      setTag('');
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div id="tier-tools" className="space-y-4" onClickCapture={onClickCapture}>
      {rule ? <style>{rule}</style> : null}

      <div className="card flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Find a brawler')}
            aria-label={t('Find a brawler')}
            className="w-full rounded-xl border-2 border-ink bg-surface-2/70 py-2 pl-9 pr-9 text-sm outline-none focus:border-brand/70"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label={t('Clear')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          ) : null}
        </label>

        {/* Whose brawlers: a saved roster, or a tag typed here. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {roster ? (
            <>
              <Chip active={scope === 'all'} onClick={() => setScope('all')}>
                {t('All brawlers')}
              </Chip>
              <Chip active={scope === 'owned'} onClick={() => setScope('owned')}>
                <UserRound className="size-3.5" />
                {t('{name} owns', { name: roster.name })}
              </Chip>
              {roster.power11.length > 0 ? (
                <Chip active={scope === 'power11'} onClick={() => setScope('power11')}>
                  {t('Power 11')}
                </Chip>
              ) : null}
              {rosters.length > 1 ? (
                <select
                  value={roster.tag}
                  onChange={(e) => setChosen(e.target.value)}
                  aria-label={t('Account')}
                  className="rounded-lg border-2 border-ink bg-surface-2 px-2 py-1 text-xs"
                >
                  {rosters.map((r) => (
                    <option key={r.tag} value={r.tag}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          ) : asking ? (
            <form onSubmit={addTag} className="flex items-center gap-1.5">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="#2PP"
                aria-label={t('Your player tag')}
                autoFocus
                className="w-32 rounded-lg border-2 border-ink bg-surface-2/70 px-2 py-1.5 text-sm uppercase outline-none focus:border-brand/70"
              />
              <button type="submit" disabled={status === 'loading'} className="btn-game bg-brand px-3 py-1.5 text-sm text-brand-ink disabled:opacity-60">
                {status === 'loading' ? '…' : t('Show')}
              </button>
              {status === 'error' ? <span className="text-xs text-defeat">{t('Player not found')}</span> : null}
            </form>
          ) : (
            <Chip active={false} onClick={() => setAsking(true)}>
              <UserRound className="size-3.5" />
              {t('Mark my brawlers')}
            </Chip>
          )}
        </div>

        <div className="flex shrink-0 gap-1.5" role="group" aria-label={t('View')}>
          <Chip active={view === 'grid'} onClick={() => setView('grid')}>
            <LayoutGrid className="size-3.5" />
            {t('Tiers')}
          </Chip>
          <Chip active={view === 'table'} onClick={() => setView('table')}>
            <Rows3 className="size-3.5" />
            {t('Table')}
          </Chip>
        </div>
      </div>

      {/* How much of each tier the account can field. */}
      {perTier.length > 0 && roster ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{t('{name} has', { name: roster.name })}</span>
          {perTier.map(({ tier, have, total }) => (
            <span
              key={tier}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-surface-2/70 py-0.5 pl-0.5 pr-2.5 font-bold tabular-nums"
            >
              <span className="display grid size-6 place-items-center rounded-full text-sm text-white" style={{ background: TIER_COLOR[tier] }}>
                {tier}
              </span>
              {have}/{total}
            </span>
          ))}
        </div>
      ) : null}

      <div hidden={view !== 'grid'}>{children}</div>

      {view === 'table' ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs text-muted">
                <th className="py-2.5 pl-3 pr-1 font-semibold">#</th>
                <SortHead label={t('Brawler')} on={sort === 'name'} onClick={() => setSort('name')} />
                <th className="hidden px-2 py-2.5 font-semibold sm:table-cell">{t('Tier')}</th>
                <SortHead label={t('Score')} on={sort === 'score'} onClick={() => setSort('score')} right />
                <SortHead label={t('Win rate')} on={sort === 'winRate'} onClick={() => setSort('winRate')} right />
                <SortHead label={t('Pick rate')} on={sort === 'pickRate'} onClick={() => setSort('pickRate')} right />
                <SortHead label={t('Battles')} on={sort === 'games'} onClick={() => setSort('games')} right wide />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-surface-2/50">
                  <td className="py-1.5 pl-3 pr-1 tabular-nums text-muted">{rank.get(e.id)}</td>
                  <td className="px-2 py-1.5">
                    <Link href={lp(e.href)} data-bid={e.id} className="flex min-w-0 items-center gap-2.5 font-bold hover:text-brand">
                      {e.image ? (
                        <Image
                          src={e.image}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized
                          className={e.framed ? 'size-8 shrink-0 object-contain sm:size-9' : 'size-8 shrink-0 rounded-md border-2 border-ink object-cover sm:size-9'}
                        />
                      ) : null}
                      <span className="truncate capitalize">{e.name.toLowerCase()}</span>
                    </Link>
                  </td>
                  <td className="hidden px-2 py-1.5 sm:table-cell">
                    <span className="display grid size-7 place-items-center rounded-lg border-2 border-ink text-sm text-white" style={{ background: TIER_COLOR[e.tier] }}>
                      {e.tier}
                    </span>
                  </td>
                  <td className="display px-2 py-1.5 text-right text-lg tabular-nums" style={{ color: TIER_COLOR[e.tier] }}>
                    {e.score !== null ? e.score.toLocaleString(NUMBER_LOCALE[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{percent(e.winRate, locale)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{percent(e.pickRate, locale)}</td>
                  <td className="hidden px-3 py-1.5 text-right tabular-nums text-muted sm:table-cell">{e.games.toLocaleString(NUMBER_LOCALE[locale])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="p-6 text-center text-sm text-muted">{t('No brawlers match “{query}”.', { query })}</p> : null}
        </div>
      ) : null}

      {openId !== null && byId.has(openId) ? (
        <TierDrawer
          entry={byId.get(openId)!}
          detail={details[openId] && details[openId] !== 'failed' ? (details[openId] as TierBrawlerDetail) : null}
          failed={details[openId] === 'failed'}
          locale={locale}
          href={lp(byId.get(openId)!.href)}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-sm ${active ? 'bz-chip-on' : 'bz-chip hover:text-white'}`}
    >
      {children}
    </button>
  );
}

function SortHead({ label, on, onClick, right = false, wide = false }: { label: string; on: boolean; onClick: () => void; right?: boolean; wide?: boolean }) {
  return (
    <th className={`px-2 py-2.5 font-semibold ${right ? 'text-right' : ''} ${wide ? 'hidden sm:table-cell' : ''}`}>
      <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 ${on ? 'text-brand' : 'hover:text-foreground'}`}>
        {label}
        {on ? <ArrowDown className="size-3" /> : null}
      </button>
    </th>
  );
}
