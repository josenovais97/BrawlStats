import { Clock, Shirt, Star, Swords } from 'lucide-react';

import {
  BuffieIcon,
  CoinIcon,
  GadgetIcon,
  GearIcon,
  HyperchargeIcon,
  Power11Icon,
  PowerPointIcon,
  StarPowerIcon,
} from '@/components/game-icons';

import { SectionHeading } from '@/components/ui/section-heading';
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
  const rows: {
    icon?: typeof Star;
    node?: React.ReactNode;
    label: string;
    stat: OwnershipStat;
    tone: string;
  }[] = [
    { icon: Star, label: 'Brawlers', stat: progression.brawlers, tone: 'text-brand' },
    {
      node: <Power11Icon className="size-4" />,
      label: 'At power 11',
      stat: progression.maxedBrawlers,
      tone: 'text-victory',
    },
    {
      node: <StarPowerIcon className="size-4" />,
      label: 'Star powers',
      stat: progression.starPowers,
      tone: 'text-brand',
    },
    {
      node: <GadgetIcon className="size-4" />,
      label: 'Gadgets',
      stat: progression.gadgets,
      tone: 'text-accent',
    },
    {
      node: <GearIcon className="size-4" />,
      label: 'Gears',
      stat: progression.gears,
      tone: 'text-muted',
    },
    {
      node: <HyperchargeIcon className="size-4" />,
      label: 'Hypercharges',
      stat: progression.hyperCharges,
      tone: 'text-defeat',
    },
    {
      node: <BuffieIcon className="size-4" />,
      label: 'Buffies',
      stat: progression.buffies,
      tone: 'text-accent',
    },
  ];

  return (
    <section>
      <SectionHeading
        title="Progression"
        aside={
          progression.totalsUnavailable
            ? 'Totals unavailable right now'
            : `${formatPercent(progression.completion)} of everything unlocked`
        }
      />

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
          {rows.map(({ icon: Icon, node, label, stat, tone }) => (
            <div key={label}>
              <div className="mb-1.5 flex items-center gap-2 text-sm">
                <span className={`grid size-4 shrink-0 place-items-center ${tone}`}>
                  {node ?? (Icon ? <Icon className="size-4" /> : null)}
                </span>
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
            node={<CoinIcon className="size-5" />}
            label="Coins invested"
            value={formatNumber(progression.coinsInvested)}
            hint="Estimated"
          />
          <Investment
            node={<PowerPointIcon className="size-5" />}
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
  node,
  label,
  value,
  hint,
}: {
  icon?: typeof Clock;
  node?: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand">
        {node ?? (Icon ? <Icon className="size-5" /> : null)}
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
