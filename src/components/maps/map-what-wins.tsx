import { ClassIcon } from '@/components/game-icons';
import { realBrawlerClass } from '@/lib/brawlapi';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';
import type { BABrawler } from '@/types/brawlapi';
import type { ModePick } from '@/types/stats';

const CLASS_COLOR: Record<string, string> = {
  'Damage Dealer': '#ff8a3d',
  Tank: '#35d07f',
  Assassin: '#a35bff',
  Support: '#35d0ff',
  Controller: '#ffc53d',
  Marksman: '#ff5c72',
  Artillery: '#9aa6d6',
};

/**
 * Which classes the map rewards (2026-11-11): the classes among its top ten
 * picks, as a bar and a sentence. A reader who does not own the top pick can
 * still see "this is a Marksman map" and pick from their own roster.
 */
export function MapWhatWins({ picks, brawlerMeta, mapName }: { picks: ModePick[]; brawlerMeta: Map<number, BABrawler>; mapName: string }) {
  const t = getT(requestLocale());
  const top = picks.slice(0, 10);
  const counts = new Map<string, number>();
  for (const p of top) {
    const c = realBrawlerClass(brawlerMeta.get(p.brawlerId)?.class?.name);
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((n, [, x]) => n + x, 0);
  if (total < 6) return null;
  const [lead, leadN] = rows[0];
  const verdict =
    leadN >= 4
      ? t('{map} is a {class} map: {n} of the top {total} picks.', { map: mapName, class: t(lead), n: leadN, total })
      : t('No one class owns {map}: the top {total} picks are spread across {k} classes.', { map: mapName, total, k: rows.length });

  return (
    <section className="card p-5">
      <h2 className="display text-xl leading-none">{t('What wins here')}</h2>
      <p className="mt-1.5 text-sm text-muted">{verdict}</p>
      <div className="mt-4 flex h-4 overflow-hidden rounded-full border-2 border-ink">
        {rows.map(([c, n]) => (
          <div key={c} title={`${t(c)} ${n}`} style={{ flexGrow: n, background: CLASS_COLOR[c] ?? 'var(--muted)' }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {rows.map(([c, n]) => (
          <li key={c} className="flex items-center gap-1.5">
            <ClassIcon name={c} className="size-4" />
            <span className="font-bold">{t(c)}</span>
            <span className="tabular-nums text-muted">{n}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
