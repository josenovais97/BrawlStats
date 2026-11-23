import Link from 'next/link';

import { getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import { getSeasonState, liveSeasonNumber } from '@/lib/ranked-seasons';

/** Days a reset stays news. */
const SHOW_DAYS = 7;

/**
 * "Season N is live" for the first week after a Ranked reset (2026-11-19,
 * owner: "we need to do content on the new season"), on the home page and
 * the Ranked pages: the two reset rules everyone asks about since the Ranked
 * Refresh, and links to what is winning right now and the best picks per map.
 *
 * On reset day the wiki can lag behind the game, so the number comes from
 * `liveSeasonNumber`: with no current season it is the next one after the
 * newest listed.
 */
export async function SeasonBanner({ className = '', mapsLink = true }: { className?: string; mapsLink?: boolean }) {
  const season = await getSeasonState().catch(() => null);
  if (!season) return null;
  const startedOn = season.current?.startsOn ?? season.latest?.endsOn ?? null;
  const number = liveSeasonNumber(season);
  if (!startedOn || !number) return null;
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const daysIn = Math.floor((today - Date.parse(`${startedOn}T00:00:00Z`)) / 86_400_000);
  if (daysIn < 0 || daysIn >= SHOW_DAYS) return null;

  const locale = requestLocale();
  const t = getT(locale);
  return (
    <section aria-labelledby="season-banner" className={`card relative isolate overflow-hidden p-5 sm:p-7 ${className}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(110% 90% at 100% 0%, color-mix(in srgb, var(--brand) 26%, transparent), transparent 62%)' }}
      />
      <p className="eyebrow">{t('New Ranked season')}</p>
      <h2 id="season-banner" className="display text-game-stroke mt-3 text-3xl leading-[1.05] sm:text-4xl">
        {t('Season {n} is live', { n: number })}
      </h2>
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        {t('Everyone dropped 2 ranks at the reset, and every rank needs Power 11 brawlers. Here is what is winning since the reset, from real Ranked games.')}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={localePath(locale, '/tier-list/ranked/24h')} className="btn-game inline-flex items-center gap-2 bg-brand px-5 py-3 text-sm text-brand-ink hover:bg-brand-strong">
          {t("What's winning right now")}
        </Link>
        {mapsLink && (
          <Link href={localePath(locale, '/ranked')} className="btn-game inline-flex items-center gap-2 bg-[#3ddc63] px-5 py-3 text-sm text-[#0b2a14] [--btn-shadow:#1a7a33]">
            {t('Best picks for every Ranked map')}
          </Link>
        )}
      </div>
    </section>
  );
}
