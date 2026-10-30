import { ArrowRight, Coins } from 'lucide-react';
import Link from 'next/link';

import { compactCoins, standingLabel, valuePercentile } from '@/lib/account-value';
import { localePath } from '@/lib/i18n';
import { coinBreakdown } from '@/lib/progression';
import { requestLocale } from '@/lib/request-locale';
import { getAccountValueDistribution } from '@/lib/stats';
import { getT } from '@/lib/t';
import type { BSPlayer } from '@/types/brawlstars';

/**
 * The account value, on the profile itself (2026-10-19).
 *
 * It used to be a grey link at the foot of the Account tab, and people who
 * went looking for it could barely find it. The number is pure arithmetic on
 * the player already loaded, so it costs one cached read to show it here.
 *
 * The standing is shown only from the median up. "Worth more than 23% of
 * players" is accurate and nobody's reason to tap; below the median the card
 * invites the comparison instead of printing it.
 */
export async function PlayerValueTeaser({ player, tag }: { player: BSPlayer; tag: string }) {
  const t = getT(requestLocale());
  const coins = coinBreakdown(player);
  if (!coins.total) return null;
  const dist = await getAccountValueDistribution().catch(() => null);
  const percentile = dist ? valuePercentile(coins.total, dist) : null;
  const standing = percentile !== null && percentile >= 0.5 ? standingLabel(percentile) : null;

  return (
    <Link
      href={localePath(requestLocale(), `/account-value/${tag}`)}
      data-umami-event="account_value_open"
      className="card card-interactive card-glow flex items-center gap-4 border-brand/40 p-4 sm:p-5"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
        <Coins aria-hidden className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="label-game block text-xs text-muted">{t('Account value')}</span>
        <span className="display block text-3xl leading-tight text-brand">
          {compactCoins(coins.total)} <span className="text-lg text-foreground">{t('coins')}</span>
        </span>
        <span className="block text-sm text-muted">
          {standing
            ? standing.top
              ? t('Top {n}% of players', { n: standing.value })
              : t('Worth more than {n}% of players', { n: standing.value })
            : t('See how it ranks against other players')}
        </span>
      </span>
      <ArrowRight aria-hidden className="size-5 shrink-0 text-brand" />
    </Link>
  );
}
