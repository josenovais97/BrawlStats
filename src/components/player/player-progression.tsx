import {
  BattlesIcon,
  BrawlersIcon,
  BuffieIcon,
  ClockIcon,
  CoinIcon,
  GadgetIcon,
  GearIcon,
  HyperchargeIcon,
  Power11Icon,
  PowerPointIcon,
  SkinsIcon,
  StarPowerIcon,
} from '@/components/game-icons';

import { Panel } from '@/components/ui/panel';
import { formatNumber, formatPercent } from '@/lib/format';
import type { OwnershipStat, PlaytimeEstimate, ProgressionSummary } from '@/lib/progression';

interface Props {
  progression: ProgressionSummary;
  playtime: PlaytimeEstimate;
}

/** Completion above which the bars are all full and only the gaps are news. */
const NEARLY_COMPLETE = 0.97;

export function PlayerProgression({ progression, playtime }: Props) {
  /*
   * Two groups, not one list of seven bars.
   *
   * "Brawlers 107/108" and "At power 11 79/108" were sitting in the same
   * column answering different questions -- what the account *has*, and how
   * much of it is *finished*. A reader scanning seven identical bars has to
   * work out which is which from the labels; split in two, the shape of the
   * account is the first thing visible. The same data, grouped.
   */
  const collection: Row[] = [
    {
      node: <BrawlersIcon className="size-4" />,
      label: 'Brawlers',
      noun: ['brawler', 'brawlers'],
      stat: progression.brawlers,
      tone: 'text-brand',
    },
    {
      node: <StarPowerIcon className="size-4" />,
      label: 'Star powers',
      noun: ['star power', 'star powers'],
      stat: progression.starPowers,
      tone: 'text-brand',
    },
    {
      node: <GadgetIcon className="size-4" />,
      label: 'Gadgets',
      noun: ['gadget', 'gadgets'],
      stat: progression.gadgets,
      tone: 'text-accent',
    },
    {
      node: <GearIcon className="size-4" />,
      label: 'Gears equipped',
      noun: ['gear', 'gears'],
      stat: progression.gears,
      tone: 'text-muted',
    },
    {
      node: <HyperchargeIcon className="size-4" />,
      label: 'Hypercharges',
      noun: ['hypercharge', 'hypercharges'],
      stat: progression.hyperCharges,
      tone: 'text-defeat',
    },
    {
      node: <BuffieIcon className="size-4" />,
      label: 'Buffies',
      noun: ['buffie', 'buffies'],
      stat: progression.buffies,
      tone: 'text-accent',
    },
  ];

  const maxed: Row[] = [
    {
      node: <Power11Icon className="size-4" />,
      label: 'Brawlers at power 11',
      noun: ['brawler to power 11', 'brawlers to power 11'],
      stat: progression.maxedBrawlers,
      tone: 'text-victory',
    },
  ];

  const nearlyComplete =
    !progression.totalsUnavailable && progression.completion >= NEARLY_COMPLETE;
  const missing = [...collection, ...maxed].filter(
    (row) => row.stat.total > 0 && row.stat.owned < row.stat.total,
  );

  return (
    <Panel
      title="Progression"
      aside={
        progression.totalsUnavailable
          ? 'Totals unavailable right now'
          : `${formatPercent(progression.completion)} of everything unlocked`
      }
    >
      <div>
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

        {/*
          Rings, not bars.

          Seven thin bars in two columns read as a form, and at 99% they were
          seven identical gold lines whose only information sat in the small
          print. A ring per item is the game's own way of showing a collection
          -- a closed ring is a finished set, an open one shows how far is
          left at a glance -- and seven of them side by side are the shape of
          the account before a single number is read. Power 11 sits last and
          in its own colour because it answers a different question: not what
          is owned, but what is finished.
        */}
        <ul className="grid grid-cols-3 gap-x-2 gap-y-6 @lg:grid-cols-4 @4xl:grid-cols-7">
          {[...collection, ...maxed].map(({ node, label, stat, tone }) => {
            const value = stat.total > 0 ? stat.owned / stat.total : 0;
            const done = stat.total > 0 && stat.owned >= stat.total;
            return (
              <li key={label} className="flex flex-col items-center text-center">
                <Ring value={value} tone={done ? 'text-victory' : tone}>
                  <span className={done ? 'text-victory' : tone}>{node}</span>
                </Ring>
                <p className="mt-2 text-[11px] font-bold uppercase leading-tight tracking-wide">
                  {label}
                </p>
                <p
                  className="mt-0.5 text-xs tabular-nums text-muted"
                  title={
                    stat.ownedRaw !== undefined && stat.ownedRaw > stat.owned
                      ? `${formatNumber(stat.ownedRaw)} owned in total; completion counts the two per brawler that can be equipped`
                      : undefined
                  }
                >
                  {formatNumber(stat.owned)}
                  {stat.total > 0 ? <> / {formatNumber(stat.total)}</> : null}
                </p>
              </li>
            );
          })}
        </ul>

        {/* What is left, already found, once the rings are all nearly
            closed and the gaps are the only news. */}
        {nearlyComplete ? (
          <div className="mt-6 rounded-xl bg-surface-2/40 px-4 py-3.5 text-sm">
            {missing.length === 0 ? (
              <p className="font-medium text-victory">Everything unlocked and maxed.</p>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Still to get
                </p>
                <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                  {missing.map(({ node, noun, stat, tone }) => {
                    const left = stat.total - stat.owned;
                    return (
                      <li key={noun[1]} className="flex items-center gap-1.5">
                        <span className={`grid size-4 shrink-0 place-items-center ${tone}`}>
                          {node}
                        </span>
                        <span className="font-semibold tabular-nums">{formatNumber(left)}</span>
                        <span className="text-muted">{left === 1 ? noun[0] : noun[1]}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        ) : null}

        <p className="mb-3 mt-7 text-[11px] font-bold uppercase tracking-wider text-muted">
          Investment <span className="font-medium normal-case tracking-normal">· what it cost</span>
        </p>
        <div className="grid gap-3 @sm:grid-cols-2 @3xl:grid-cols-5">
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
            node={<ClockIcon className="size-5" />}
            label="Time played"
            value={`${formatNumber(Math.round(playtime.hours))} h`}
            hint="Estimated"
          />
          <Investment
            node={<BattlesIcon className="size-5" />}
            label="Matches"
            value={formatNumber(playtime.matches)}
            hint="Estimated"
          />
          <Investment
            node={<SkinsIcon className="size-5" />}
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
    </Panel>
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
  node,
  label,
  value,
  hint,
}: {
  node: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand">
        {node}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="truncate text-lg font-bold tabular-nums">{value}</p>
        <p className="truncate text-xs text-muted">{hint}</p>
      </div>
    </div>
  );
}

interface Row {
  node: React.ReactNode;
  label: string;
  stat: OwnershipStat;
  tone: string;
  /** Singular and plural, for the "still to get" line on a nearly complete account. */
  noun: [string, string];
}

/**
 * A completion ring with a mark in the middle.
 *
 * Drawn in `currentColor` from the tone class, so each item keeps the colour
 * its icon has everywhere else, and a closed ring turns victory green.
 */
function Ring({
  value,
  tone,
  children,
}: {
  value: number;
  tone: string;
  children: React.ReactNode;
}) {
  const pct = Math.min(Math.max(value, 0), 1);
  const r = 28;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative grid size-20 place-items-center @xl:size-24"
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg viewBox="0 0 64 64" className={`absolute inset-0 size-full -rotate-90 ${tone}`} aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      {/* The game icons are images, not SVGs, and arrive sized for a 16px
          label; the ring is the icon's frame here, so it fills most of it. */}
      <span className="relative grid place-items-center [&_img]:size-9 [&_svg]:size-9 @xl:[&_img]:size-11 @xl:[&_svg]:size-11">
        {children}
      </span>
    </div>
  );
}
