import Image from 'next/image';

import { brawlerIconUrl, modeLabel, playerIconUrl } from '@/lib/brawlapi';
import { formatNumber, formatPercent, titleCase } from '@/lib/format';
import type { BattleInsights } from '@/lib/battle-insights';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { BSPlayer } from '@/types/brawlstars';

/**
 * One card, built to be screenshotted.
 *
 * Portrait-shaped and self-contained: it carries the player's name, the site's
 * name and the window it covers, because the second life of this thing is as an
 * image in a Discord channel where none of that context travels with it.
 *
 * Six figures, not sixteen. A shareable card competes with everything else in a
 * feed, so it has to be readable at a glance and at half size — the profile is
 * where the detail lives, and this links back to it rather than reproducing it.
 */
export function WrappedCard({
  player,
  insights,
  brawlerMeta,
  modeMeta,
}: {
  player: BSPlayer;
  insights: BattleInsights;
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
}) {
  const topBrawler = insights.brawlers[0] ?? null;
  const topMode = insights.modes[0] ?? null;
  const up = insights.trophyChange >= 0;

  return (
    <article className="card card-glow relative mx-auto w-full max-w-md overflow-hidden">
      <span className="block h-1.5 w-full bg-brand" />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(85% 60% at 50% 0%, color-mix(in srgb, var(--brand) 18%, transparent) 0%, transparent 62%)',
        }}
      />

      <div className="relative space-y-5 p-6">
        <header className="flex items-center gap-3">
          <Image
            src={playerIconUrl(player.icon?.id)}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-xl bg-surface-2"
            unoptimized
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black leading-tight">{player.name}</p>
            <p className="font-mono text-xs text-muted">{player.tag}</p>
          </div>
          <p className="shrink-0 text-right">
            <span className="block text-lg font-black tabular-nums text-brand">
              {formatNumber(player.trophies)}
            </span>
            <span className="block text-[11px] text-muted">trophies</span>
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Battles"
            value={formatNumber(insights.battles)}
            hint={`${insights.wins}W · ${insights.losses}L`}
          />
          <Stat
            label="Win rate"
            value={insights.winRate === null ? '—' : formatPercent(insights.winRate)}
            hint={`${insights.decided} decided`}
            tone={insights.winRate !== null && insights.winRate >= 0.5 ? 'good' : undefined}
          />
          <Stat
            label="Trophies"
            value={`${up ? '+' : '−'}${formatNumber(Math.abs(insights.trophyChange))}`}
            hint="across this run"
            tone={up ? 'good' : 'bad'}
          />
          <Stat
            label="Star player"
            value={formatNumber(insights.starPlayerCount)}
            hint={insights.starPlayerCount === 1 ? 'time' : 'times'}
          />
        </div>

        {topBrawler ? (
          <Highlight
            eyebrow="Most played"
            art={
              brawlerMeta.get(topBrawler.brawlerId)?.imageUrl ??
              brawlerIconUrl(topBrawler.brawlerId)
            }
            title={titleCase(topBrawler.brawlerName)}
            detail={`${topBrawler.battles} ${
              topBrawler.battles === 1 ? 'battle' : 'battles'
            }${topBrawler.winRate !== null ? ` · ${formatPercent(topBrawler.winRate)} won` : ''}`}
          />
        ) : null}

        {topMode ? (
          <Highlight
            eyebrow="Most played mode"
            art={modeMeta.get(topMode.mode.toLowerCase())?.imageUrl}
            title={modeLabel(modeMeta, topMode.mode)}
            detail={`${topMode.battles} ${topMode.battles === 1 ? 'battle' : 'battles'}${
              topMode.winRate !== null ? ` · ${formatPercent(topMode.winRate)} won` : ''
            }`}
          />
        ) : null}

        <p className="border-t border-border pt-3 text-center text-[11px] text-muted">
          brawlzone.net · last {insights.battles} battles
        </p>
      </div>
    </article>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="rounded-xl bg-surface-2/60 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-0.5 text-2xl font-black tabular-nums ${
          tone === 'good' ? 'text-victory' : tone === 'bad' ? 'text-defeat' : ''
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function Highlight({
  eyebrow,
  art,
  title,
  detail,
}: {
  eyebrow: string;
  art: string | undefined;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2/60 p-3">
      {art ? (
        <Image
          src={art}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-lg bg-surface-2 object-contain"
          unoptimized
        />
      ) : (
        <span aria-hidden className="size-10 shrink-0 rounded-lg bg-surface-2" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{eyebrow}</p>
        <p className="truncate font-bold">{title}</p>
        <p className="truncate text-xs text-muted">{detail}</p>
      </div>
    </div>
  );
}
