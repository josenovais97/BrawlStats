'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { usePanelI18n } from '@/components/bubble/panel-i18n';
import { useBubbleAccount } from '@/components/bubble/use-bubble-account';
import { humanizeMode } from '@/lib/format';

interface Pick {
  brawlerId: number;
  name: string;
  icon: string;
  rate: number;
  trophies: number | null;
}

interface TrophyEvent {
  mode: string;
  map: string;
  endsAt: string;
  image: string | null;
  modeIcon: string | null;
  best: Pick[];
  yours: Pick[];
}

interface PushData {
  events: TrophyEvent[];
  prestige: { brawlerId: number; name: string; icon: string; trophies: number; toNext: number }[];
  hasTag: boolean;
}

/** "20261113T080000.000Z" -> epoch ms. */
function gameTime(value: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(value ?? '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

/**
 * The Trophies tab (2026-11-13): the live trophy events, each with the
 * map's best three on the ladder and, with a tag, the account's own best
 * three at power 9+ with their trophies, then the brawlers closest to their
 * next prestige. For the players who push trophies as much as they play
 * Ranked. From /api/bubble/push.
 */
export function PanelTrophies() {
  const { t, name } = usePanelI18n();
  const { tag } = useBubbleAccount();
  const [data, setData] = useState<PushData | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bubble/push${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: PushData) => {
        setData(d);
        setNow(Date.now());
      })
      .catch((e) => {
        if ((e as Error).name !== 'AbortError') setFailed(true);
      });
    return () => controller.abort();
  }, [tag]);

  if (!data) {
    return (
      <div className="space-y-2 px-1" aria-busy={!failed}>
        {failed ? (
          <p className="bz-panel px-3 py-3 text-[12px] text-muted">{t('trophies.empty')}</p>
        ) : (
          [0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)
        )}
      </div>
    );
  }
  if (data.events.length === 0) {
    return <p className="bz-panel mx-1 px-3 py-3 text-[12px] text-muted">{t('trophies.empty')}</p>;
  }

  const left = (endsAt: string) => {
    const end = gameTime(endsAt);
    if (end === null) return '';
    const hours = Math.ceil((end - now) / 3_600_000);
    return hours <= 1 ? t('trophies.soon') : t('trophies.left', { h: hours });
  };
  const faces = (picks: Pick[], mine: boolean) =>
    picks.map((p) => (
      <span key={p.brawlerId} className="flex flex-col items-center" title={name(p.name)}>
        <Image src={p.icon} alt={name(p.name)} width={26} height={26} unoptimized className="size-[26px] rounded-md border border-ink bg-surface-3" />
        {mine && p.trophies !== null ? <span className="mt-0.5 text-[9px] font-bold leading-none tabular-nums text-[#ffc53d]">{p.trophies}</span> : null}
      </span>
    ));

  return (
    <div className="space-y-2 px-1">
      <ul className="space-y-1.5">
        {data.events.map((e) => (
          <li key={`${e.mode}-${e.map}`} className="bz-panel flex items-center gap-2.5 px-2.5 py-2">
            <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-ink bg-surface-3">
              {e.image ? (
                <Image src={e.image} alt="" fill unoptimized sizes="44px" className="object-cover" />
              ) : e.modeIcon ? (
                <Image src={e.modeIcon} alt="" fill unoptimized sizes="44px" className="object-contain p-1.5" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="display block truncate text-[13px] leading-tight text-[#a3eaff]">{name(e.map)}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                {e.modeIcon ? <Image src={e.modeIcon} alt="" width={12} height={12} unoptimized className="size-3" /> : null}
                {/* The API still reports Brawl Hockey under its old hash. */}
                <span className="truncate">{name(e.mode === 'airHockey' ? 'Brawl Hockey' : humanizeMode(e.mode))}</span>
                <span>·</span>
                <span className="shrink-0">{left(e.endsAt)}</span>
              </span>
            </span>
            {/* One label column for both rows, as wide as the longer word
                ("Seninkiler", "Melhores"), so the faces line up in every language. */}
            <span className="grid shrink-0 grid-cols-[auto_auto] items-center gap-x-1.5 gap-y-1">
              <span className="whitespace-nowrap text-end text-[9px] font-bold uppercase text-muted">{t('trophies.top')}</span>
              <span className="flex gap-1">{faces(e.best, false)}</span>
              {e.yours.length > 0 ? (
                <>
                  <span className="mt-1.5 self-start whitespace-nowrap text-end text-[9px] font-bold uppercase text-[#ffc53d]">{t('trophies.you')}</span>
                  <span className="flex items-start gap-1">{faces(e.yours, true)}</span>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {data.prestige.length > 0 ? (
        <div className="bz-panel px-3 py-2.5">
          <p className="text-[11px] font-bold text-muted">{t('trophies.prestige')}</p>
          <ul className="mt-1.5 flex gap-2.5 overflow-x-auto">
            {data.prestige.map((p) => (
              <li key={p.brawlerId} className="flex shrink-0 flex-col items-center">
                <Image src={p.icon} alt={name(p.name)} width={32} height={32} unoptimized className="size-8 rounded-md border border-ink bg-surface-3" />
                <span className="mt-0.5 text-[10px] font-bold tabular-nums text-[#ffc53d]">{p.trophies}</span>
                <span className="text-[9px] text-muted">{t('trophies.toNext', { n: p.toNext })}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
