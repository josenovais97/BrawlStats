import { RelativeTime } from '@/components/ui/relative-time';
import { compactNumber, relativeTime } from '@/lib/format';
import { requestLocale } from '@/lib/request-locale';
import { getCoverageStats, getLastAggregationRun } from '@/lib/stats';
import { getT } from '@/lib/t';

/**
 * One line under the search (2026-10-30): where the numbers come from and how
 * fresh they are. It replaces four big-number tiles (brawlers, players,
 * battles, ranked battles), a stats-site template that said the same thing in
 * a whole screen on a phone.
 */
export async function HomeProof() {
  const t = getT(requestLocale());
  const [stats, lastRun] = await Promise.all([
    getCoverageStats().catch(() => null),
    getLastAggregationRun().catch(() => null),
  ]);
  if (!stats || stats.battles === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 py-4 text-sm text-muted">
      <span className="live-dot shrink-0" />
      <span>
        {t('From {battles} battles of {players} players we sampled ourselves.', {
          battles: compactNumber(stats.battles),
          players: compactNumber(stats.players),
        })}
        {lastRun ? (
          <>
            {' '}{t('Updated')}{' '}
            <RelativeTime iso={lastRun.startedAt} fallback={relativeTime(lastRun.startedAt)} className="font-semibold text-foreground" />.
          </>
        ) : null}
      </span>
    </p>
  );
}
