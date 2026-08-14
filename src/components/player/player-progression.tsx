import {
  Clock,
  Coins,
  Gem,
  Swords,
  Shirt,
  Sparkles,
  Star,
  Wrench,
  Zap,
  Cog,
  TrendingUp,
} from 'lucide-react';

import { formatNumber, formatPercent } from '@/lib/format';
import type {
  OwnershipStat,
  PlaytimeEstimate,
  ProgressionSummary,
} from '@/lib/progression';

interface Props {
  progression: ProgressionSummary;
  playtime: PlaytimeEstimate;
}

export function PlayerProgression({ progression, playtime }: Props) {
  const rows: { icon: typeof Star; label: string; stat: OwnershipStat; tone: string }[] = [
    { icon: Star, label: 'Brawlers', stat: progression.brawlers, tone: 'text-brand' },
    {
      icon: TrendingUp,
      label: 'At power 11',
      stat: progression.maxedBrawlers,
      tone: 'text-victory',
    },
    {
      icon: Sparkles,
      label: 'Star powers',
      stat: progression.starPowers,
      tone: 'text-brand',
    },
    { icon: Wrench, label: 'Gadgets', stat: progression.gadgets, tone: 'text-accent' },
    { icon: Cog, label: 'Gears', stat: progression.gears, tone: 'text-muted' },
    {
      icon: Zap,
      label: 'Hypercharges',
      stat: progression.hyperCharges,
      tone: 'text-defeat',
    },
    { icon: Gem, label: 'Buffies', stat: progression.buffies, tone: 'text-accent' },
  ];

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Progression</h2>
        <p className="text-sm text-muted">
          {progression.totalsUnavailable
            ? 'Totals unavailable right now'
            : `${formatPercent(progression.completion)} of everything unlocked`}
        </p>
      </div>

      <div className="card card-glow p-5">
        {/* Headline completion bar. */}
        <div className="mb-6">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-muted">Account completion</span>
            <span className="text-2xl font-black tabular-nums text-brand">
              {formatPercent(progression.completion)}
            </span>
          </div>
          <Bar value={progression.completion} />
        </div>

        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {rows.map(({ icon: Icon, label, stat, tone }) => (
            <div key={label}>
              <div className="mb-1.5 flex items-center gap-2 text-sm">
                <Icon className={`size-4 shrink-0 ${tone}`} />
                <span className="flex-1 font-medium">{label}</span>
                <span className="tabular-nums text-muted">
                  {formatNumber(stat.owned)}
                  {stat.total > 0 ? (
                    <span className="text-muted/60"> / {formatNumber(stat.total)}</span>
                  ) : null}
                </span>
              </div>
              <Bar value={stat.total > 0 ? stat.owned / stat.total : 0} thin />
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <Investment
            icon={Coins}
            label="Coins invested"
            value={formatNumber(progression.coinsInvested)}
            hint="Estimated"
          />
          <Investment
            icon={Sparkles}
            label="Power points"
            value={formatNumber(progression.powerPointsInvested)}
            hint="Estimated"
          />
          <Investment
            icon={Clock}
            label="Time played"
            value={`${formatNumber(Math.round(playtime.hours))} h`}
            hint="Estimated"
          />
          <Investment
            icon={Swords}
            label="Matches"
            value={formatNumber(playtime.matches)}
            hint="Estimated"
          />
          <Investment
            icon={Shirt}
            label="Skins equipped"
            value={formatNumber(progression.skinsEquipped)}
            hint="Currently in use"
          />
        </div>

        {progression.coinsToMaxOwned > 0 ? (
          <p className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
            <span className="font-semibold text-foreground">
              {formatNumber(progression.coinsToMaxOwned)} coins
            </span>{' '}
            still needed to take every brawler already unlocked to power 11.
          </p>
        ) : null}

      </div>
    </section>
  );
}

function Bar({ value, thin = false }: { value: number; thin?: boolean }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      className={`w-full overflow-hidden rounded-full bg-surface-2 ${thin ? 'h-1.5' : 'h-2.5'}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-strong to-brand transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Investment({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <p className="truncate text-lg font-bold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted/70">{hint}</p>
      </div>
    </div>
  );
}
