import { SeasonHeading } from '@/components/player/season/shared';
import { getBattleLog } from '@/lib/bs-api';
import { formatNumber } from '@/lib/format';
import { logTime } from '@/lib/ranked-season';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatNumber(Math.abs(n))}`;

/**
 * The battle log as a line (2026-11-11): trophies won and lost game by game
 * over the last 25 battles, a dot per game coloured by its result. Ranked
 * games move no trophies, so they sit flat on the line as purple dots.
 */
export async function BattleMomentum({ tag }: { tag: string }) {
  const t = getT(requestLocale());
  const log = await getBattleLog(tag)
    .then((r) => r.items)
    .catch(() => []);
  const games = log
    .map((e) => ({
      time: logTime(e.battleTime) ?? 0,
      result: e.battle.result ?? null,
      rank: e.battle.rank ?? null,
      delta: typeof e.battle.trophyChange === 'number' ? e.battle.trophyChange : 0,
      ranked: e.battle.type === 'soloRanked' || e.battle.type === 'teamRanked',
    }))
    .sort((a, b) => a.time - b.time);
  // All Ranked (or all zero) is a flat line at 0: nothing to draw.
  if (games.length < 5 || games.filter((g) => g.delta !== 0).length < 3) return null;

  const points: number[] = [];
  for (const g of games) points.push((points.at(-1) ?? 0) + g.delta);
  const net = points.at(-1) ?? 0;
  const lo = Math.min(0, ...points);
  const hi = Math.max(0, ...points);
  const span = Math.max(hi - lo, 10);
  const x = (i: number) => (i / (games.length - 1)) * 100;
  const y = (v: number) => 8 + (1 - (v - lo) / span) * 84;
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  // Best and worst stretch: the biggest rise and fall between two points.
  let best = 0;
  let worst = 0;
  let minSoFar = 0;
  let maxSoFar = 0;
  for (const v of points) {
    best = Math.max(best, v - minSoFar);
    worst = Math.min(worst, v - maxSoFar);
    minSoFar = Math.min(minSoFar, v);
    maxSoFar = Math.max(maxSoFar, v);
  }
  const dot = (g: (typeof games)[number]) =>
    g.ranked ? 'var(--accent)' : g.delta > 0 || g.result === 'victory' ? 'var(--victory)' : g.delta < 0 || g.result === 'defeat' ? 'var(--defeat)' : 'var(--draw)';

  return (
    <section className="card p-5 sm:p-6">
      <SeasonHeading title={t('Momentum')} aside={t('Trophies over the last {n} battles', { n: games.length })} />
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          {t('Net')} <strong className={net > 0 ? 'text-victory' : net < 0 ? 'text-defeat' : 'text-muted'}>{signed(net)}</strong>
        </span>
        {best > 0 ? (
          <span>
            {t('Best run')} <strong className="text-victory">{signed(best)}</strong>
          </span>
        ) : null}
        {worst < 0 ? (
          <span>
            {t('Worst run')} <strong className="text-defeat">{signed(worst)}</strong>
          </span>
        ) : null}
      </div>
      <div className="relative mt-4 h-40 rounded-xl bg-surface-2/50 sm:h-48">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <line x1="0" x2="100" y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {games.map((g, i) => (
          <span
            key={`${g.time}-${i}`}
            title={g.ranked ? t('Ranked') : signed(g.delta)}
            className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink sm:size-3"
            style={{ left: `${x(i)}%`, top: `${y(points[i])}%`, background: dot(g) }}
          />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full border border-ink bg-victory" />{t('Win')}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full border border-ink bg-defeat" />{t('Loss')}</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full border border-ink bg-accent" />{t('Ranked')}</span>
      </p>
    </section>
  );
}
