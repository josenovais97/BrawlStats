import Image from 'next/image';
import Link from 'next/link';

import { CoinIcon } from '@/components/game-icons';
import { Panel } from '@/components/ui/panel';
import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber, titleCase } from '@/lib/format';
import type { RosterPlan } from '@/lib/roster-optimizer';
import { brawlerPath } from '@/lib/slugs';
import type { BABrawler } from '@/types/brawlapi';
import { andList, getT } from '@/lib/t';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';

/**
 * One spend, and what it buys.
 *
 * The profile's other upgrade sections answer "what is unfinished" — a list,
 * correctly ordered, that still leaves the reader to decide. This answers the
 * decision: spend this much, on these three, and your Ranked coverage goes from
 * four modes to six.
 *
 * The consequence leads and the price follows, because the price is only
 * meaningful once you know what it is for. Each step then justifies itself by
 * naming the mode it covers, so the plan can be checked rather than trusted.
 */
export function PlayerRosterPlan({
  plan,
  brawlerMeta,
}: {
  plan: RosterPlan;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const { steps, totalCoins, modes, coveredBefore, coveredAfter, banSafeAfter } = plan;
  const gained = coveredAfter - coveredBefore;

  return (
    <Panel
      id="upgrade-next"
      title={t('What to upgrade next')}
      subtitle={t('The cheapest set of upgrades that covers the most of the live Ranked rotation, from brawlers this account already owns.')}
      bodyClassName=""
    >
      <div className="relative scroll-anchor-nav">
        <span className="block h-1 w-full bg-brand" />

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="flex items-center gap-2 text-2xl font-black tabular-nums">
              <CoinIcon className="size-6" />
              {formatNumber(totalCoins)}
            </p>
            <p className="text-sm text-muted">{t('to upgrade')}{' '}
              <span className="font-semibold capitalize text-foreground">
                {steps.map((step) => titleCase(step.name)).join(', ')}
              </span>
            </p>
          </div>

          <p className="text-sm leading-relaxed">{t('Ranked coverage goes from')}{' '}
            <span className="font-bold tabular-nums">
              {coveredBefore}/{modes}
            </span>{' '}{t('to')}{' '}
            <span className="font-bold tabular-nums text-victory">
              {coveredAfter}/{modes}
            </span>{' '}{t('modes')}{gained > 0 ? '' : t(' (already covered)')}
            {banSafeAfter > 0 ? (
              <>{t(', with a second pick spare in')}{' '}
                <span className="font-bold tabular-nums">{banSafeAfter}</span>{' '}{t('of them')}</>
            ) : null}
            .
          </p>

          <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {steps.map((step, index) => (
              <li key={step.brawlerId} className="flex items-center gap-3 bg-surface-2/40 p-3">
                <span className="w-4 shrink-0 text-center text-sm font-black tabular-nums text-muted/70">
                  {index + 1}
                </span>
                <Link
                  href={lp(brawlerPath(step.brawlerId, step.name))}
                  prefetch={false}
                  className="shrink-0"
                >
                  <Image
                    src={brawlerMeta.get(step.brawlerId)?.imageUrl ?? brawlerIconUrl(step.brawlerId)}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-lg bg-surface-2"
                    loading="lazy"
                    unoptimized
                  />
                </Link>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{titleCase(step.name)}</span>
                  <span className="block truncate text-xs text-muted">
                    {/* Every step says what it bought, so the order can be
                        checked rather than taken on faith. */}
                    {step.covers.length > 0
                      ? t('Covers {v}', { v: andList(step.covers) })
                      : step.secures.length > 0
                        ? t('Second pick in {v}', { v: andList(step.secures) })
                        : t('Strengthens the rotation')}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums">
                    {formatNumber(step.coins)}
                  </span>
                  <span className="block text-[11px] text-muted">{t('power {power} → 11', { power: step.power })}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="text-xs leading-relaxed text-muted">{t('Coverage means owning a top-3 pick at power 9 or above in a mode that is live right now. Unlocks are deliberately excluded — a brawler you do not own is not a spend you can make today, so every step here is one you could start immediately.')}</p>
        </div>
      </div>
    </Panel>
  );
}
