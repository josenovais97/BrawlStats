import Image from 'next/image';
import Link from 'next/link';

import { fankitLeague } from '@/lib/fankit-icons';
import { formatDate } from '@/lib/format';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { getT } from '@/lib/t';

/**
 * The November 2026 "Ranked Refresh", summarised (2026-11-03).
 *
 * The biggest change to Ranked since the February 2025 rework, and what people
 * search for in the weeks around the first reset under it. Every line is from
 * Supercell's release notes; nothing here is our reading of it.
 *
 * News rather than reference, so it takes itself down: past SHOWN_UNTIL these
 * are simply how Ranked works, and the page goes back to being about picks.
 */
const SHOWN_UNTIL = '2027-01-01';
/** The first season turnover after the update falls before this. */
const FIRST_RESET_BY = '2026-11-30';
const NOTES_URL = 'https://supercell.com/en/games/brawlstars/blog/game-updates/release-notes-november-2026/';

const CHANGES: { icon: string | null; title: string; body: string }[] = [
  {
    icon: '/icons/trophy.png',
    title: 'Unlocks at 5,000 trophies',
    body: 'Up from 1,000. If you already have Ranked you keep it, and get a Chaos Drop at 5,000 trophies instead.',
  },
  {
    icon: '/icons/power-11.png',
    title: 'Power 11 at every rank',
    body: 'Bronze to Diamond used to take Power 9. Diamond now needs 12 brawlers, the same as Mythic, up from 9.',
  },
  {
    icon: '/icons/brawlers.png',
    title: '6 free maxed brawlers a season',
    body: 'Up from 3, to make up for the stricter requirements.',
  },
  {
    icon: fankitLeague('mythic'),
    title: 'The season reset drops you 2 ranks',
    body: 'Down from 6, so you start each season much closer to your best. No change to the boost.',
  },
  {
    icon: '/icons/ranked.png',
    title: 'A 2-0 win earns more Elo',
    body: 'An Epic Win (2-0) gives extra Elo and a Close Match loss (1-2) costs less. Early and middle ranks climb faster.',
  },
  {
    icon: fankitLeague('masters'),
    title: 'No teams from Masters I up',
    body: 'From Masters I and above, Ranked is played without a premade team.',
  },
  {
    icon: '/icons/draft.png',
    title: 'A new Pick & Ban screen',
    body: 'A bigger brawler grid with filters, ban suggestions, pick-order swaps and quick chat while you draft.',
  },
  {
    icon: fankitLeague('pro'),
    title: 'Pro no longer qualifies for BSC',
    body: 'Reaching Pro does not qualify you for BSC 2027. The way in is the Championship Challenge.',
  },
];

export function RankedRefresh({ nextReset, today = new Date() }: { nextReset: string | null; today?: Date }) {
  if (today.toISOString().slice(0, 10) >= SHOWN_UNTIL) return null;
  const locale = requestLocale();
  const t = getT(locale);
  // Only the first reset under the new rule (19 November) is worth a line.
  const day = today.toISOString().slice(0, 10);
  const upcoming = nextReset && nextReset > day && nextReset <= FIRST_RESET_BY ? nextReset : null;

  return (
    <section className="card overflow-hidden" aria-labelledby="ranked-refresh">
      <span className="block h-1 w-full bg-gradient-to-r from-brand to-accent" />
      <div className="p-4 sm:p-5">
        <p className="eyebrow text-accent">{t('November 2026 update')}</p>
        <h2 id="ranked-refresh" className="display text-game-stroke mt-1.5 text-xl sm:text-2xl">
          {t('Ranked Refresh: what changed')}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {t('The biggest change to Ranked since the 2025 rework.')}
          {upcoming ? ` ${t('The first season reset under the new rules is on {date}.', { date: formatDate(upcoming) })}` : ''}
        </p>

        <ul className="mt-4 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
          {CHANGES.map((change) => (
            <li key={change.title} className="flex gap-3">
              {change.icon ? (
                <Image
                  src={change.icon}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 object-contain"
                  loading="lazy"
                  unoptimized
                />
              ) : (
                <span className="size-9 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-bold leading-snug">{t(change.title)}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted">{t(change.body)}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          {t('Source:')}{' '}
          <a href={NOTES_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
            {t('Supercell’s November 2026 release notes')}
          </a>
          {' · '}
          <Link href={localePath(locale, '/release-notes')} className="font-semibold text-brand hover:underline">
            {t('Every balance change in this update')}
          </Link>
        </p>
      </div>
    </section>
  );
}
