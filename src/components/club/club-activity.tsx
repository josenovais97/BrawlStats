import Link from 'next/link';

import { SectionHeading } from '@/components/ui/section-heading';
import { type ClubActivity, INACTIVE_AFTER_DAYS } from '@/lib/club-activity';
import { formatDate, formatNumber, humanizeRole } from '@/lib/format';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { getT } from '@/lib/t';

/**
 * The club's week: trophies each member gained since the baseline snapshot,
 * the club's total, and who went quiet.
 *
 * The leader's question is "who is not playing", so inactive members are
 * flagged rather than merely sorted to the bottom -- but only after a few days
 * of history, because a member who has not played since this morning is not
 * inactive.
 */
export function ClubActivitySection({ activity }: { activity: ClubActivity }) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const sign = (n: number) => (n > 0 ? `+${formatNumber(n)}` : formatNumber(n));
  const flagInactive = activity.days >= INACTIVE_AFTER_DAYS;

  return (
    <section className="space-y-4">
      <SectionHeading
        title={t('Activity this week')}
        subtitle={
          activity.since && activity.days > 0
            ? t('Trophies gained since {date} ({n} days). Tracked daily while this page is visited.', {
                date: formatDate(activity.since),
                n: activity.days,
              })
            : t('Tracking started today. Come back tomorrow to see who is gaining trophies, and in a few days who has gone quiet.')
        }
      />

      {activity.since && activity.days > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-sm text-muted">{t('Club trophies gained')}</p>
            <p className="display mt-1 text-3xl text-victory">{sign(activity.totalGained)}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-muted">{t('Inactive members')}</p>
            <p className={`display mt-1 text-3xl ${activity.inactive > 0 ? 'text-defeat' : ''}`}>
              {flagInactive ? activity.inactive : '–'}
            </p>
            {!flagInactive ? (
              <p className="text-xs text-muted">{t('Shown after {n} days of tracking', { n: INACTIVE_AFTER_DAYS })}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {activity.since && activity.days > 0 ? (
        <ol className="card divide-y divide-border">
          {activity.members.map((m, i) => {
            const quiet = flagInactive && m.gained !== null && m.gained <= 0;
            return (
              <li key={m.tag} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
                <Link href={lp(`/player/${m.tag}`)} className="min-w-0 flex-1 truncate font-semibold hover:text-brand">
                  {m.name}
                  <span className="ml-2 text-xs font-normal text-muted">{t(humanizeRole(m.role))}</span>
                </Link>
                {quiet ? (
                  <span className="shrink-0 rounded-md bg-defeat/15 px-2 py-0.5 text-[11px] font-bold uppercase text-defeat">
                    {t('Inactive')}
                  </span>
                ) : null}
                <span
                  className={`w-20 shrink-0 text-right font-bold tabular-nums ${
                    m.gained === null ? 'text-muted' : m.gained > 0 ? 'text-victory' : m.gained < 0 ? 'text-defeat' : 'text-muted'
                  }`}
                >
                  {m.gained === null ? t('New') : sign(m.gained)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
