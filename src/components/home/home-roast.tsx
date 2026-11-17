import { WinStreakIcon } from '@/components/game-icons';
import { AccountValueForm } from '@/components/account-value/tag-form';
import { getT } from '@/lib/t';
import { requestLocale } from '@/lib/request-locale';

/**
 * Roast My Account on the home page, under the app banner (2026-11-17, the
 * launch): the tag box itself rather than a link to it, so a roast is one
 * step from the page most people land on. Every string is the roast page's
 * own, already in every language.
 */
export function HomeRoast() {
  const t = getT(requestLocale());
  return (
    <section aria-labelledby="home-roast" className="card relative isolate overflow-hidden p-5 sm:p-7">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(110% 90% at 0% 0%, color-mix(in srgb, var(--brand) 22%, transparent), transparent 62%)' }}
      />
      <p className="flex items-center gap-2">
        <WinStreakIcon className="size-5" />
        <span className="eyebrow">{t('Roast my account')}</span>
      </p>
      <h2 id="home-roast" className="display text-game-stroke mt-3 text-3xl leading-[1.05] sm:text-4xl">
        {t('Think your account is good?')}
      </h2>
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        {t('Enter your player tag. BrawlZone reads your stats and tells you the truth, with no mercy and a score out of 10.')}
      </p>
      <div className="mt-5">
        <AccountValueForm base="/roast" cta={t('Roast me')} />
      </div>
    </section>
  );
}
