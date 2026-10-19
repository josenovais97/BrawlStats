import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { AccountValueForm } from '@/components/account-value/tag-form';
import { ShareImageButton } from '@/components/share-image-button';
import { SupportLine } from '@/components/support/support-line';
import { ErrorState } from '@/components/ui/error-state';
import { compactCoins, standingLabel, valuePercentile } from '@/lib/account-value';
import { playerIconUrl } from '@/lib/brawlapi';
import { getOfficialBrawlers, getPlayer } from '@/lib/bs-api';
import { toApiError } from '@/lib/errors';
import { formatNumber } from '@/lib/format';
import { localePath } from '@/lib/i18n';
import { coinBreakdown, coinsToFinishOwned, computeProgression } from '@/lib/progression';
import { requestLocale } from '@/lib/request-locale';
import { getAccountValueDistribution, getReleasedBuffieCount } from '@/lib/stats';
import { getT } from '@/lib/t';
import { displayTag, normalizeTag } from '@/lib/tags';

/**
 * One account's value: what it cost to build, how it ranks, what is left.
 *
 * Rendered per request like the profile -- the player is a live fetch -- and
 * behind the same proxy rate limit (`/account-value/` in LIMITED_PREFIXES).
 * Not indexed: one page per tag is the shape trap 5 in AGENTS.md warns about;
 * the landing page is the one meant for search.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = getT(requestLocale());
  const { tag } = await params;
  return {
    title: t('Account value of {tag}', { tag: displayTag(tag) }),
    alternates: { canonical: `/account-value/${normalizeTag(tag)}` },
    robots: { index: false, follow: true },
  };
}

/** "1.84M" on the hero, where seven digits would not fit a phone line. */
export default async function AccountValuePage({ params }: PageProps) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const { tag } = await params;

  let player;
  try {
    player = await getPlayer(tag);
  } catch (err) {
    const apiError = toApiError(err);
    return (
      <div className="space-y-8">
        <ErrorState
          code={apiError.code}
          title={apiError.code === 'notFound' ? t('Player not found') : undefined}
          detail={
            apiError.code === 'notFound'
              ? t('No player exists with the tag {tag}. Check it in-game under your profile.', { tag: displayTag(tag) })
              : undefined
          }
        />
        <AccountValueForm />
      </div>
    );
  }

  const catalogue = await getOfficialBrawlers().then((r) => r.items).catch(() => []);
  const releasedBuffies = await getReleasedBuffieCount();
  const dist = await getAccountValueDistribution();

  const coins = coinBreakdown(player);
  const progression = computeProgression(player, catalogue, releasedBuffies);
  const toFinish = catalogue.length ? coinsToFinishOwned(player, catalogue) : progression.coinsToMaxOwned;
  const percentile = dist ? valuePercentile(coins.total, dist) : null;
  const standing = percentile === null ? null : standingLabel(percentile);
  const clean = normalizeTag(player.tag);

  const parts = [
    { label: t('Power levels'), value: coins.powerLevels },
    { label: t('Hypercharges'), value: coins.hyperCharges },
    { label: t('Star powers'), value: coins.starPowers },
    { label: t('Gadgets'), value: coins.gadgets },
    { label: t('Gears'), value: coins.gears },
  ].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-10">
      {/* The verdict: the one line people screenshot. */}
      <section className="card card-glow relative overflow-hidden p-6 sm:p-10">
        <div className="flex items-center gap-4">
          <Image
            src={playerIconUrl(player.icon?.id)}
            alt=""
            width={72}
            height={72}
            className="size-16 rounded-2xl bg-surface-2"
            unoptimized
          />
          <div className="min-w-0">
            <h1 className="display truncate text-2xl uppercase sm:text-3xl">{player.name}</h1>
            <p className="text-sm text-muted">{displayTag(player.tag)}</p>
          </div>
        </div>

        <p className="mt-8 text-sm font-bold uppercase tracking-wide text-muted">{t('Account value')}</p>
        <p className="display mt-1 text-6xl leading-none text-brand sm:text-7xl">
          {compactCoins(coins.total)} <span className="text-3xl text-foreground sm:text-4xl">{t('coins')}</span>
        </p>
        <p className="mt-2 text-lg text-muted">
          {t('plus {pp} power points', { pp: formatNumber(coins.powerPoints) })}
        </p>

        {standing && percentile !== null && dist ? (
          <div className="mt-8 space-y-3">
            <p className="display text-2xl uppercase sm:text-3xl">
              {standing.top
                ? t('Top {n}% of players', { n: standing.value })
                : t('Worth more than {n}% of players', { n: standing.value })}
            </p>
            <div className="relative h-3 rounded-full bg-surface-2">
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${Math.max(2, percentile * 100)}%` }} />
            </div>
            <p className="text-xs text-muted">
              {t('Among {n} active players we track. Most of them play Ranked, so the bar is high.', { n: formatNumber(dist.population) })}
            </p>
          </div>
        ) : null}

        <div className="mt-8">
          <ShareImageButton
            src={`/account-value/${clean}/story`}
            fileName={`brawlzone-account-value-${clean}.png`}
            kind="account-value"
            label={t('Share my account value')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-brand-ink"
          />
        </div>
      </section>

      {/* Where the coins went. */}
      <section className="space-y-4">
        <h2 className="display text-2xl uppercase">{t('Where the coins went')}</h2>
        <ul className="card divide-y divide-border">
          {parts.map((p) => (
            <li key={p.label} className="flex items-center gap-4 p-4">
              <span className="w-32 shrink-0 font-semibold">{p.label}</span>
              <span className="relative h-2.5 flex-1 rounded-full bg-surface-2">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-brand/70"
                  style={{ width: `${coins.total ? (p.value / coins.total) * 100 : 0}%` }}
                />
              </span>
              <span className="w-28 shrink-0 text-right tabular-nums">{formatNumber(p.value)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* What is left. */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-muted">{t('Brawlers owned')}</p>
          <p className="display mt-1 text-3xl">
            {player.brawlers.length}
            {catalogue.length ? <span className="text-xl text-muted"> / {catalogue.length}</span> : null}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted">{t('Account completion')}</p>
          <p className="display mt-1 text-3xl">{Math.round(progression.completion * 100)}%</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted">{t('Coins to finish what you own')}</p>
          <p className="display mt-1 text-3xl">{compactCoins(toFinish)}</p>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-4">
        <Link
          href={lp(`/player/${clean}`)}
          className="inline-flex items-center gap-2 font-semibold text-brand hover:underline"
        >
          {t('See the full profile')}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>

      <SupportLine />

      <section className="space-y-3">
        <h2 className="font-bold">{t('Check another account')}</h2>
        <AccountValueForm />
      </section>

      <p className="text-xs leading-relaxed text-muted">
        {t('Values are in-game currency, not money: what it costs in coins and power points to build the same account. Buffies and skins are not included, because they also come from drops. Unofficial fan project, not affiliated with Supercell.')}
      </p>
    </div>
  );
}
