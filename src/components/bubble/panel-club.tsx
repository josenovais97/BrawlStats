'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { usePanelI18n } from '@/components/bubble/panel-i18n';

interface ClubMember {
  key: string;
  name: string;
  elo: number | null;
  rank: string | null;
  rankIcon: string | null;
}

interface Club {
  name: string;
  members: ClubMember[];
  you: string | null;
}

/**
 * The player's club by Ranked elo (2026-11-13), inside the player card: the
 * reader's place, the top five and their own row, everyone on request.
 * Quiet by design (owner: "don't let this be way too noisy"): nothing pushes
 * it, it loads only when the card is opened.
 */
export function PanelClub({ tag }: { tag: string }) {
  const { t, lang } = usePanelI18n();
  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [all, setAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/bubble/club?tag=${encodeURIComponent(tag)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { club: Club | null } | null) => setClub(d?.club ?? null))
      .catch(() => setClub(null));
    return () => controller.abort();
  }, [tag]);

  if (club === undefined) return <div className="skeleton h-8 rounded-lg" />;
  if (!club || club.members.length < 2) return null;
  const place = club.members.findIndex((m) => m.key === club.you);
  const shown = all
    ? club.members
    : club.members.filter((m, i) => i < 5 || m.key === club.you);

  return (
    <div className="border-t border-border/60 pt-1.5">
      <p className="flex items-center gap-1.5">
        <span className="truncate font-bold">{club.name}</span>
        {place >= 0 ? (
          <span className="shrink-0 text-muted">· {t('club.place', { n: place + 1, total: club.members.length })}</span>
        ) : null}
      </p>
      <ol className="mt-1 space-y-0.5">
        {shown.map((m) => {
          const i = club.members.indexOf(m);
          const you = m.key === club.you;
          return (
            <li key={m.key} className={`flex items-center gap-1.5 rounded px-1 ${you ? 'bg-[#ffc53d]/15' : ''}`}>
              <span className="w-4 shrink-0 text-end tabular-nums text-muted">{i + 1}</span>
              {m.rankIcon ? <Image src={m.rankIcon} alt="" width={14} height={14} unoptimized className="size-3.5 shrink-0 object-contain" /> : <span className="size-3.5 shrink-0" />}
              <span className={`min-w-0 flex-1 truncate ${you ? 'font-bold text-[#ffc53d]' : ''}`}>{you ? t('club.you', { name: m.name }) : m.name}</span>
              <span className="shrink-0 tabular-nums text-muted">{m.elo !== null ? m.elo.toLocaleString(lang) : '–'}</span>
            </li>
          );
        })}
      </ol>
      {club.members.length > shown.length || all ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 text-[10px] font-bold text-[#a3eaff]">
          {all ? t('club.less') : t('club.all', { n: club.members.length })}
        </button>
      ) : null}
    </div>
  );
}
