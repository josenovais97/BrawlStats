'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Sparkles, X } from 'lucide-react';

import type { PanelModeComps } from '@/components/bubble/panel-comps';
import { recall, useModeLabel } from '@/components/bubble/panel-chips';
import type { DraftBrawler } from '@/components/bubble/panel-draft';
import { usePanelI18n } from '@/components/bubble/panel-i18n';
import type { PanelMapPick, PanelMode } from '@/components/bubble/panel-tiers';
import { panelBracket } from '@/components/bubble/bracket-data';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { canField } from '@/lib/bubble-account';
import { buildIndex, parseAsk, type AskIntent, type AskParsed } from '@/lib/bubble-ask';
import type { UiKey } from '@/lib/bubble-ui-en';
import { panelTrack } from '@/lib/panel-telemetry';
import type { TierBrawlerDetail, TierBrawlerRef } from '@/lib/tier-brawler';

/**
 * Ask Bubble (2026-11-19, owner: "go with B, make it real nice"): a question
 * box in the panel, answered in a second from our own Ranked stats, with no
 * AI model. lib/bubble-ask understands the question; this turns it into an
 * answer card from what the panel already holds (tier lists, Ranked map
 * picks, trios) and two existing endpoints (/api/tier-brawler for counters,
 * matchups, best maps and the build; /api/v1/counters for who beats a
 * brawler on a map). Suggestions and follow-ups carry their own parsed
 * question, so they work in every language whatever the parser knows.
 */

type Counter = { brawlerId: number; winRate: number; edge: number; games: number };
type Answer =
  | { kind: 'brawler'; id: number; map: string | null; intent: AskIntent | null }
  | { kind: 'versus'; a: number; b: number; map: string | null }
  | { kind: 'map'; map: string; intent: AskIntent | null; mine: boolean }
  | { kind: 'mode'; mode: string; intent: AskIntent | null }
  | { kind: 'unknown' };
type Turn = { id: number; q: string; answer: Answer };
type Chip = { text: string; parsed: AskParsed };

const details = new Map<string, Promise<TierBrawlerDetail | null>>();
const counterCache = new Map<string, Promise<Counter[]>>();

function getDetail(id: number, modes: string[], lang: string) {
  const key = `${id}|${lang}`;
  if (!details.has(key)) {
    details.set(
      key,
      fetch(`/api/tier-brawler/${id}?${new URLSearchParams({ modes: modes.join(','), lang })}`)
        .then((r) => (r.ok ? (r.json() as Promise<TierBrawlerDetail>) : null))
        .catch(() => null),
    );
  }
  return details.get(key)!;
}

function getCounters(id: number, map: string | null, rank: string | null) {
  const params = new URLSearchParams({ brawler: String(id) });
  if (map) params.set('map', map);
  if (rank) params.set('rank', rank);
  const key = params.toString();
  if (!counterCache.has(key)) {
    counterCache.set(
      key,
      fetch(`/api/v1/counters?${params}`)
        .then((r) => (r.ok ? r.json() : { counters: [] }))
        .then((d: { counters?: Counter[] }) => d.counters ?? [])
        .catch(() => []),
    );
  }
  return counterCache.get(key)!;
}

function useAsync<T>(make: () => Promise<T>, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<{ deps: string; v: T } | undefined>(undefined);
  const key = JSON.stringify(deps);
  useEffect(() => {
    let live = true;
    make().then((v) => live && setValue({ deps: key, v }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value?.deps === key ? value.v : undefined;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function PanelAsk({
  modes,
  roster,
  comps,
  onClose,
  onCounters,
}: {
  modes: PanelMode[];
  roster: DraftBrawler[];
  comps: Record<string, PanelModeComps>;
  onClose: () => void;
  onCounters: (brawlerId: number) => void;
}) {
  const { t, name, lang } = usePanelI18n();
  const modeName = useModeLabel();
  const account = useBubbleAccount();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(roster.map((b) => [b.brawlerId, b])), [roster]);
  const maps = useMemo(() => {
    const out = new Map<string, { mode: PanelMode; picks: PanelMapPick[] }>();
    for (const m of modes) for (const map of m.maps) if (!out.has(map.mapName)) out.set(map.mapName, { mode: m, picks: map.picks });
    return out;
  }, [modes]);
  const ranked = useMemo(() => modes.filter((m) => m.key).map((m) => m.key as string), [modes]);
  const combined = useMemo(() => modes.find((m) => m.key === null) ?? modes[0], [modes]);
  const index = useMemo(
    () =>
      buildIndex({
        brawlers: roster.map((b) => ({ id: b.brawlerId, names: [b.brawlerName, name(b.brawlerName)] })),
        maps: [...maps.keys()].map((m) => ({ name: m, names: [m, name(m)] })),
        modes: modes.filter((m) => m.key).map((m) => ({ key: m.key as string, names: [m.label, modeName(m)] })),
      }),
    [roster, maps, modes, name, modeName],
  );
  const context = useMemo(() => {
    const saved = typeof window === 'undefined' ? { mode: null, map: null } : recall();
    const map = saved.map && maps.has(saved.map) ? saved.map : null;
    const top = (combined?.entries ?? []).filter((e) => e.metaScore !== null).sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0));
    return { map, top };
  }, [maps, combined]);
  const rank = panelBracket(account.rankName);

  const answerFor = (p: AskParsed): Answer => {
    if (p.brawlers.length >= 2) return { kind: 'versus', a: p.brawlers[0], b: p.brawlers[1], map: p.map };
    if (p.brawlers.length === 1) return { kind: 'brawler', id: p.brawlers[0], map: p.map, intent: p.intent };
    if (p.map) return { kind: 'map', map: p.map, intent: p.intent, mine: p.mine };
    if (p.mode) return { kind: 'mode', mode: p.mode, intent: p.intent };
    if ((p.mine || p.intent === 'picks' || p.intent === 'bans' || p.intent === 'trio') && context.map) {
      return { kind: 'map', map: context.map, intent: p.intent, mine: p.mine };
    }
    return { kind: 'unknown' };
  };

  const ask = (q: string, parsed?: AskParsed) => {
    const clean = q.trim();
    if (!clean) return;
    const answer = answerFor(parsed ?? parseAsk(clean, index));
    // What gets asked, and how often it is understood: the kind only, never the text.
    panelTrack('panel_ask', { kind: answer.kind, typed: !parsed });
    setTurns((list) => [...list.slice(-7), { id: Date.now(), q: clean, answer }]);
    setText('');
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [turns.length]);

  const P = (over: Partial<AskParsed>): AskParsed => ({ brawlers: [], map: null, mode: null, intent: null, mine: false, ...over });
  const local = (id: number) => name(byId.get(id)?.brawlerName ?? '');
  const suggestions: Chip[] = useMemo(() => {
    const [a, b, c] = context.top;
    const out: Chip[] = [];
    if (context.map) out.push({ text: t('ask.ex.picks', { map: name(context.map) }), parsed: P({ map: context.map, intent: 'picks' }) });
    if (a) out.push({ text: t('ask.ex.counters', { name: local(a.brawlerId) }), parsed: P({ brawlers: [a.brawlerId], intent: 'counters' }) });
    if (context.map) out.push({ text: t('ask.ex.bans', { map: name(context.map) }), parsed: P({ map: context.map, intent: 'bans' }) });
    if (account.owned && context.map) out.push({ text: t('ask.ex.mine', { map: name(context.map) }), parsed: P({ map: context.map, intent: 'picks', mine: true }) });
    if (b && c) out.push({ text: t('ask.ex.versus', { a: local(b.brawlerId), b: local(c.brawlerId) }), parsed: P({ brawlers: [b.brawlerId, c.brawlerId], intent: 'versus' }) });
    if (b) out.push({ text: t('ask.ex.build', { name: local(b.brawlerId) }), parsed: P({ brawlers: [b.brawlerId], intent: 'build' }) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, account.owned, t, name]);

  const chipRow = (chips: Chip[]) => (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <button key={c.text} type="button" onClick={() => ask(c.text, c.parsed)} className="bz-chip px-2.5 py-1 text-start text-[11px] leading-snug">
          {c.text}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 px-2 pb-2 pt-1 backdrop-blur">
        <span className="grid size-8 place-items-center rounded-full border-2 border-[#050a1f] bg-gradient-to-b from-[var(--bz-chip-top,#ffe37a)] to-[var(--brand-strong)] text-[var(--brand-ink)] shadow">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="display text-base leading-none">{t('ask.title')}</p>
          <p className="truncate text-[10px] text-muted">{t('ask.hello')}</p>
        </div>
        <button type="button" onClick={onClose} className="bz-chip grid size-8 place-items-center" aria-label={t('sheet.close')}>
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-3 px-2 pb-3">
        {turns.length === 0 ? <div className="pt-1">{chipRow(suggestions)}</div> : null}
        {turns.map((turn, i) => (
          <div key={turn.id} ref={i === turns.length - 1 ? endRef : undefined} className="space-y-1.5">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-1.5 text-[12px] font-bold text-brand-ink">{turn.q}</p>
            </div>
            <AnswerView
              answer={turn.answer}
              ctx={{ byId, maps, combined, comps, ranked, lang, rank, account, contextMap: context.map, local, t, name, modeName, ask, chipRow, P, onCounters, suggestions }}
            />
          </div>
        ))}
      </div>

      <form
        className="sticky bottom-0 flex items-center gap-1.5 border-t border-border bg-background/95 px-2 py-2 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('ask.placeholder')}
          enterKeyHint="send"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border-2 border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-brand"
        />
        <button type="submit" disabled={!text.trim()} className="bz-chip-on grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-40" aria-label={t('ask.send')}>
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- answers

type Ctx = {
  byId: Map<number, DraftBrawler>;
  maps: Map<string, { mode: PanelMode; picks: PanelMapPick[] }>;
  combined: PanelMode | undefined;
  comps: Record<string, PanelModeComps>;
  ranked: string[];
  lang: string;
  rank: string | null;
  account: ReturnType<typeof useBubbleAccount>;
  contextMap: string | null;
  local: (id: number) => string;
  t: (key: UiKey, vars?: Record<string, string | number>) => string;
  name: (english: string) => string;
  modeName: (m: Pick<PanelMode, 'key' | 'label'>) => string;
  ask: (q: string, parsed?: AskParsed) => void;
  chipRow: (chips: Chip[]) => ReactNode;
  P: (over: Partial<AskParsed>) => AskParsed;
  onCounters: (id: number) => void;
  suggestions: Chip[];
};

function Card({ children }: { children: ReactNode }) {
  return <div className="bz-panel bz-review-in space-y-2 px-2.5 py-2">{children}</div>;
}

function Face({ src, size = 32, ring }: { src?: string | null; size?: number; ring?: string }) {
  return src ? (
    <Image src={src} alt="" width={size} height={size} className={`shrink-0 rounded-lg border-2 bg-surface-2 object-cover ${ring ?? 'border-border'}`} style={{ width: size, height: size }} unoptimized />
  ) : (
    <span className="shrink-0 rounded-lg border-2 border-border bg-surface-2" style={{ width: size, height: size }} />
  );
}

/** A labelled list of brawlers with a bar each: win rate, or the score given. */
function Rows({ title, rows, max = 5 }: { title: string; rows: { key: string | number; icon?: string | null; label: string; value: number; sub?: string }[]; max?: number }) {
  if (rows.length === 0) return null;
  const list = rows.slice(0, max);
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">{title}</p>
      <ul className="space-y-1">
        {list.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <Face src={r.icon} size={26} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold leading-tight">{r.label}</span>
              <span className="relative mt-0.5 block h-1.5 overflow-hidden rounded-full bg-black/30">
                <span className="absolute inset-y-0 start-0 rounded-full bg-brand" style={{ width: `${Math.max(6, Math.min(100, (r.value - 0.4) * 250))}%` }} />
              </span>
            </span>
            <span className="shrink-0 text-end">
              <span className="block text-[12px] font-bold tabular-nums text-brand">{pct(r.value)}</span>
              {r.sub ? <span className="block text-[9px] text-muted">{r.sub}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnswerView({ answer, ctx }: { answer: Answer; ctx: Ctx }) {
  if (answer.kind === 'brawler') return <BrawlerAnswer id={answer.id} map={answer.map} intent={answer.intent} ctx={ctx} />;
  if (answer.kind === 'versus') return <VersusAnswer a={answer.a} b={answer.b} map={answer.map} ctx={ctx} />;
  if (answer.kind === 'map') return <MapAnswer map={answer.map} intent={answer.intent} mine={answer.mine} ctx={ctx} />;
  if (answer.kind === 'mode') return <ModeAnswer mode={answer.mode} intent={answer.intent} ctx={ctx} />;
  return (
    <Card>
      <p className="text-[12px] leading-snug">{ctx.t('ask.unknown')}</p>
      {ctx.chipRow(ctx.suggestions)}
    </Card>
  );
}

function Thinking({ t }: { t: Ctx['t'] }) {
  return (
    <Card>
      <p className="flex items-center gap-2 text-[12px] text-muted">
        <Sparkles className="size-3.5 animate-pulse text-brand" aria-hidden />
        {t('ask.thinking')}
      </p>
    </Card>
  );
}

function tierOf(ctx: Ctx, id: number) {
  return ctx.combined?.entries.find((e) => e.brawlerId === id) ?? null;
}

function onMapOf(ctx: Ctx, id: number, map: string | null) {
  if (!map) return null;
  const m = ctx.maps.get(map);
  if (!m) return null;
  const sorted = [...m.picks].sort((a, b) => b.score - a.score);
  const pos = sorted.findIndex((p) => p.brawlerId === id);
  return pos < 0 ? { pos: -1, total: sorted.length, score: null } : { pos: pos + 1, total: sorted.length, score: sorted[pos].score };
}

function Header({ ctx, id, map }: { ctx: Ctx; id: number; map: string | null }) {
  const b = ctx.byId.get(id);
  const tier = tierOf(ctx, id);
  const onMap = onMapOf(ctx, id, map);
  return (
    <div className="flex items-center gap-2">
      <Face src={b?.imageUrl} size={40} ring="border-brand" />
      <div className="min-w-0 flex-1">
        <p className="display truncate text-[15px] leading-tight">{ctx.local(id)}</p>
        <p className="text-[10px] text-muted">
          {tier ? `${ctx.t('ask.tier', { t: tier.tier })} · ${tier.metaScore?.toFixed(1) ?? '–'}` : ''}
          {onMap
            ? ` · ${onMap.pos > 0 ? ctx.t('ask.onMap', { map: ctx.name(map!), n: onMap.pos, total: onMap.total }) : ctx.t('ask.notOnMap', { map: ctx.name(map!) })}`
            : ''}
        </p>
      </div>
      {tier ? (
        <span className="display grid size-8 shrink-0 place-items-center rounded-lg border-2 border-[#050a1f] bg-surface-2 text-[16px]">{tier.tier}</span>
      ) : null}
    </div>
  );
}

function BrawlerAnswer({ id, map, intent, ctx }: { id: number; map: string | null; intent: AskIntent | null; ctx: Ctx }) {
  const detail = useAsync(() => getDetail(id, ctx.ranked, ctx.lang), [id, ctx.lang]);
  const counters = useAsync(() => getCounters(id, map, ctx.rank), [id, map, ctx.rank]);
  if (detail === undefined || counters === undefined) return <Thinking t={ctx.t} />;
  const refRows = (list: TierBrawlerRef[] | undefined) =>
    (list ?? []).map((r) => ({ key: r.id, icon: ctx.byId.get(r.id)?.imageUrl ?? r.icon, label: ctx.local(r.id) || ctx.name(r.name), value: r.winRate }));
  const counterRows = counters.map((c) => ({ key: c.brawlerId, icon: ctx.byId.get(c.brawlerId)?.imageUrl, label: ctx.local(c.brawlerId), value: c.winRate }));
  const sections: Record<string, ReactNode> = {
    counters: (
      <Rows
        key="counters"
        title={map ? `${ctx.t('draft.beats', { name: ctx.local(id) })} · ${ctx.name(map)}` : ctx.t('card.counteredBy')}
        rows={counterRows.length ? counterRows : refRows(detail?.weak)}
        max={intent === 'counters' ? 5 : 3}
      />
    ),
    strong: <Rows key="strong" title={ctx.t('sheet.strongAgainst')} rows={refRows(detail?.strong)} max={intent === 'strong' ? 5 : 3} />,
    mates: <Rows key="mates" title={ctx.t('sheet.bestWith')} rows={refRows(detail?.mates)} max={intent === 'mates' ? 5 : 3} />,
    maps: (
      <Rows
        key="maps"
        title={ctx.t('card.bestMaps')}
        rows={(detail?.bestMaps ?? []).map((m) => ({ key: m.name, icon: m.modeIcon, label: m.name, value: m.winRate, sub: m.modeName }))}
        max={intent === 'maps' ? 5 : 3}
      />
    ),
    build: <Build key="build" detail={detail} ctx={ctx} />,
  };
  const first = intent === 'strong' || intent === 'mates' || intent === 'maps' || intent === 'build' ? intent : 'counters';
  const order = [first, ...['counters', 'build', 'strong', 'mates', 'maps'].filter((k) => k !== first)];
  const follow: Chip[] = [];
  if (ctx.contextMap && map !== ctx.contextMap) {
    follow.push({ text: ctx.t('ask.ex.countersOn', { name: ctx.local(id), map: ctx.name(ctx.contextMap) }), parsed: ctx.P({ brawlers: [id], map: ctx.contextMap, intent: 'counters' }) });
  }
  if (intent !== 'build') follow.push({ text: ctx.t('ask.ex.build', { name: ctx.local(id) }), parsed: ctx.P({ brawlers: [id], intent: 'build' }) });
  if (intent !== 'maps') follow.push({ text: ctx.t('ask.ex.maps', { name: ctx.local(id) }), parsed: ctx.P({ brawlers: [id], intent: 'maps' }) });
  return (
    <Card>
      <Header ctx={ctx} id={id} map={map} />
      {/* The asked-for section in full, then the rest of the brawler's card, shorter. */}
      {order.slice(0, intent ? 3 : 4).map((k) => sections[k])}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <button type="button" onClick={() => ctx.onCounters(id)} className="bz-chip-on px-2.5 py-1 text-[11px]">
          {ctx.t('sheet.counterIt')}
        </button>
      </div>
      {ctx.chipRow(follow)}
    </Card>
  );
}

function Build({ detail, ctx }: { detail: TierBrawlerDetail | null; ctx: Ctx }) {
  const b = detail?.build;
  const parts = [b?.gadget, b?.starPower, ...(b?.gears ?? [])].filter((p): p is NonNullable<typeof p> => !!p);
  if (parts.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">{ctx.t('ask.build')}</p>
      <ul className="grid grid-cols-2 gap-1">
        {parts.map((p) => (
          <li key={p.name} className="flex items-center gap-1.5 rounded-md bg-surface-2/70 px-1.5 py-1">
            {p.icon ? <Image src={p.icon} alt="" width={18} height={18} className="size-[18px] shrink-0 object-contain" unoptimized /> : null}
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{ctx.name(p.name)}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted">{pct(p.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VersusAnswer({ a, b, map, ctx }: { a: number; b: number; map: string | null; ctx: Ctx }) {
  const da = useAsync(() => getDetail(a, ctx.ranked, ctx.lang), [a, ctx.lang]);
  const db = useAsync(() => getDetail(b, ctx.ranked, ctx.lang), [b, ctx.lang]);
  if (da === undefined || db === undefined) return <Thinking t={ctx.t} />;
  const ta = tierOf(ctx, a);
  const tb = tierOf(ctx, b);
  const ma = onMapOf(ctx, a, map);
  const mb = onMapOf(ctx, b, map);
  // Head to head, from either side's matchups.
  const aBeatsB = da?.strong.find((r) => r.id === b)?.winRate ?? (db?.weak.find((r) => r.id === a)?.winRate ?? null);
  const bBeatsA = db?.strong.find((r) => r.id === a)?.winRate ?? (da?.weak.find((r) => r.id === b)?.winRate ?? null);
  const scoreA = ma?.score ?? (ta?.metaScore ?? 0) / 10;
  const scoreB = mb?.score ?? (tb?.metaScore ?? 0) / 10;
  const gap = Math.abs(scoreA - scoreB);
  const close = map && ma?.score != null && mb?.score != null ? gap < 0.01 : gap < 0.03;
  const winner = scoreA >= scoreB ? a : b;
  const side = (id: number, tier: ReturnType<typeof tierOf>, onMap: ReturnType<typeof onMapOf>, lit: boolean) => (
    <div className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 ${lit ? 'bg-brand/15 ring-2 ring-brand' : 'bg-surface-2/60'}`}>
      <Face src={ctx.byId.get(id)?.imageUrl} size={44} ring={lit ? 'border-brand' : undefined} />
      <p className="display truncate text-[13px]">{ctx.local(id)}</p>
      <p className="text-[10px] text-muted">{tier ? ctx.t('ask.tier', { t: tier.tier }) : '–'}</p>
      {onMap?.score != null ? <p className="text-[12px] font-bold tabular-nums text-brand">{(onMap.score * 100).toFixed(1)}%</p> : null}
    </div>
  );
  return (
    <Card>
      <div className="flex items-stretch gap-2">
        {side(a, ta, ma, !close && winner === a)}
        <span className="display self-center text-[15px] text-brand">VS</span>
        {side(b, tb, mb, !close && winner === b)}
      </div>
      <p className="text-center text-[13px] font-bold">
        {close ? ctx.t('ask.close') : `${ctx.t('ask.better', { name: ctx.local(winner) })}${map ? ` · ${ctx.name(map)}` : ''}`}
      </p>
      {aBeatsB !== null && aBeatsB >= 0.5 ? (
        <p className="text-center text-[11px] text-muted">{ctx.t('ask.beats', { a: ctx.local(a), b: ctx.local(b), n: Math.round(aBeatsB * 100) })}</p>
      ) : bBeatsA !== null && bBeatsA >= 0.5 ? (
        <p className="text-center text-[11px] text-muted">{ctx.t('ask.beats', { a: ctx.local(b), b: ctx.local(a), n: Math.round(bBeatsA * 100) })}</p>
      ) : null}
      {ctx.chipRow(
        !map && ctx.contextMap
          ? [{ text: ctx.t('ask.ex.versusOn', { a: ctx.local(a), b: ctx.local(b), map: ctx.name(ctx.contextMap) }), parsed: ctx.P({ brawlers: [a, b], map: ctx.contextMap, intent: 'versus' }) }]
          : [],
      )}
    </Card>
  );
}

function MapAnswer({ map, intent, mine, ctx }: { map: string; intent: AskIntent | null; mine: boolean; ctx: Ctx }) {
  const m = ctx.maps.get(map);
  if (!m) return <Card><p className="text-[12px]">{ctx.t('ask.notOnMap', { map: ctx.name(map) })}</p></Card>;
  const owned = ctx.account.owned;
  const sorted = [...m.picks].sort((a, b) => b.score - a.score);
  const row = (p: PanelMapPick) => ({
    key: p.brawlerId,
    icon: ctx.byId.get(p.brawlerId)?.imageUrl ?? p.imageUrl,
    label: ctx.local(p.brawlerId) || ctx.name(p.brawlerName),
    value: p.score,
    sub: ctx.t('ask.picked', { n: (p.pickRate * 100).toFixed(1) }),
  });
  const modeKey = m.mode.key ?? '';
  const trios = ctx.comps[modeKey]?.maps[map] ?? ctx.comps[modeKey]?.mode ?? [];
  let body: ReactNode;
  if (intent === 'trio') {
    body = (
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">{ctx.t('ask.trio')}</p>
        <ul className="space-y-1">
          {trios.slice(0, 4).map((c, i) => (
            <li key={i} className="flex items-center gap-1.5 rounded-md bg-surface-2/60 px-1.5 py-1">
              {c.brawlers.map((b) => (
                <Face key={b.brawlerId} src={ctx.byId.get(b.brawlerId)?.imageUrl ?? b.imageUrl} size={26} />
              ))}
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{c.brawlers.map((b) => ctx.local(b.brawlerId) || ctx.name(b.brawlerName)).join(' · ')}</span>
              <span className="shrink-0 text-[12px] font-bold tabular-nums text-brand">{pct(c.winRate)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (intent === 'bans') {
    body = <Rows title={ctx.t('ask.bans')} rows={sorted.filter((p) => p.pickRate >= 0.01).map(row)} max={5} />;
  } else if (mine && owned) {
    body = <Rows title={ctx.t('ask.yourPicks')} rows={sorted.filter((p) => canField(owned, p.brawlerId, ctx.account.filter)).map(row)} max={5} />;
  } else {
    body = (
      <>
        {mine && !owned ? <p className="text-[11px] text-muted">{ctx.t('ask.noTag')}</p> : null}
        <Rows title={ctx.t('ask.bestPicks')} rows={sorted.map(row)} max={5} />
      </>
    );
  }
  const follow: Chip[] = [];
  if (intent !== 'bans') follow.push({ text: ctx.t('ask.ex.bans', { map: ctx.name(map) }), parsed: ctx.P({ map, intent: 'bans' }) });
  if (intent !== 'trio') follow.push({ text: ctx.t('ask.ex.trio', { map: ctx.name(map) }), parsed: ctx.P({ map, intent: 'trio' }) });
  if (owned && !(mine && intent !== 'bans' && intent !== 'trio')) follow.push({ text: ctx.t('ask.ex.mine', { map: ctx.name(map) }), parsed: ctx.P({ map, intent: 'picks', mine: true }) });
  if (intent === 'bans' || intent === 'trio' || mine) follow.push({ text: ctx.t('ask.ex.picks', { map: ctx.name(map) }), parsed: ctx.P({ map, intent: 'picks' }) });
  return (
    <Card>
      <div className="flex items-center gap-2">
        {m.mode.icon ? <Image src={m.mode.icon} alt="" width={22} height={22} className="size-[22px] object-contain" unoptimized /> : null}
        <p className="display truncate text-[15px]">{ctx.name(map)}</p>
        <span className="truncate text-[10px] text-muted">{ctx.modeName(m.mode)}</span>
      </div>
      {body}
      {ctx.chipRow(follow)}
    </Card>
  );
}

function ModeAnswer({ mode, intent, ctx }: { mode: string; intent: AskIntent | null; ctx: Ctx }) {
  const m = [...ctx.maps.values()].find((x) => x.mode.key === mode)?.mode;
  if (!m) return <Card><p className="text-[12px]">{ctx.t('ask.unknown')}</p></Card>;
  const top = [...m.entries].filter((e) => e.metaScore !== null).sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0)).slice(0, 6);
  const trios = ctx.comps[mode]?.mode ?? [];
  return (
    <Card>
      <div className="flex items-center gap-2">
        {m.icon ? <Image src={m.icon} alt="" width={22} height={22} className="size-[22px] object-contain" unoptimized /> : null}
        <p className="display truncate text-[15px]">{ctx.t('ask.bestIn', { mode: ctx.modeName(m) })}</p>
      </div>
      {intent === 'trio' && trios.length ? (
        <ul className="space-y-1">
          {trios.slice(0, 4).map((c, i) => (
            <li key={i} className="flex items-center gap-1.5 rounded-md bg-surface-2/60 px-1.5 py-1">
              {c.brawlers.map((b) => (
                <Face key={b.brawlerId} src={ctx.byId.get(b.brawlerId)?.imageUrl ?? b.imageUrl} size={26} />
              ))}
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{c.brawlers.map((b) => ctx.local(b.brawlerId)).join(' · ')}</span>
              <span className="shrink-0 text-[12px] font-bold tabular-nums text-brand">{pct(c.winRate)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5">
          {top.map((e) => (
            <li key={e.brawlerId}>
              <button
                type="button"
                onClick={() => ctx.ask(ctx.local(e.brawlerId), ctx.P({ brawlers: [e.brawlerId] }))}
                className="flex w-full items-center gap-1.5 rounded-md bg-surface-2/60 px-1.5 py-1 text-start"
              >
                <Face src={ctx.byId.get(e.brawlerId)?.imageUrl ?? e.imageUrl} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold leading-tight">{ctx.local(e.brawlerId)}</span>
                  <span className="text-[10px] text-muted">
                    {e.tier} · {e.metaScore?.toFixed(1)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {ctx.chipRow(
        m.maps.slice(0, 4).map((mp) => ({ text: ctx.t('ask.ex.picks', { map: ctx.name(mp.mapName) }), parsed: ctx.P({ map: mp.mapName, intent: 'picks' }) })),
      )}
    </Card>
  );
}
