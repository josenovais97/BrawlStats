import { RankedIcon, TrophyIcon } from '@/components/game-icons';
import Image from 'next/image';
import { NavLink } from '@/components/tier-list/tier-nav';

import { rankedLeagueIconUrl } from '@/lib/brawlapi';
import { humanizeMode } from '@/lib/format';
import { fmtNumber, localePath, rankLabel, type Locale } from '@/lib/i18n';
import { RANK_BRACKETS, type RankBracket } from '@/lib/rank-brackets';
import { bracketTierListHref, tierListHref } from '@/lib/tier-list-route';
import { TIER_WINDOWS, type TierFormat, type TierWindowKey } from '@/lib/stats';

/**
 * The three controls above a tier list: format, window, mode.
 *
 * All plain links, so every combination is its own cacheable URL and none of it
 * needs client JavaScript. They live in one file because they are one control
 * surface — each row has to know the other two rows' state to build a link that
 * changes only its own dimension, and splitting that across three components
 * meant three copies of the query-string logic drifting apart.
 */

/* The URL scheme lives with the routes that implement it. */
export { tierListHref };

const FORMATS: {
  key: TierFormat;
  icon: (props: { className?: string }) => React.ReactNode;
}[] = [
  { key: 'ranked', icon: RankedIcon },
  { key: 'trophy', icon: TrophyIcon },
];

/** The controls' words. Ranked is the game's own name for it in each language. */
const WORDS: Record<
  Locale,
  {
    format: Record<TierFormat, { label: string; sublabel: string }>;
    window: Record<TierWindowKey, string>;
    formatGroup: string;
    windowGroup: string;
    yourRank: string;
    allRanks: string;
    lobbies: (rank: string) => string;
    allModes: string;
    modeGroup: string;
    sampled: (n: string) => string;
  }
> = {
  en: {
    format: { ranked: { label: 'Ranked', sublabel: 'Competitive' }, trophy: { label: 'Trophy', sublabel: 'Ladder' } },
    window: { '24h': TIER_WINDOWS['24h'].label, '7d': TIER_WINDOWS['7d'].label },
    formatGroup: 'Tier list format',
    windowGroup: 'Tier list window',
    yourRank: 'Your rank',
    allRanks: 'All ranks',
    lobbies: (rank) => `${rank} Ranked lobbies`,
    allModes: 'All modes',
    modeGroup: 'Game mode',
    sampled: (n) => `${n} sampled battles`,
  },
  es: {
    format: { ranked: { label: 'Competitivo', sublabel: 'Ranked' }, trophy: { label: 'Trofeos', sublabel: 'Escalera' } },
    window: { '24h': 'Meta', '7d': 'Reciente' },
    formatGroup: 'Tipo de tier list',
    windowGroup: 'Periodo',
    yourRank: 'Tu rango',
    allRanks: 'Todos',
    lobbies: (rank) => `Partidas de Competitivo en ${rank}`,
    allModes: 'Todos los modos',
    modeGroup: 'Modo de juego',
    sampled: (n) => `${n} partidas recogidas`,
  },
  pt: {
    format: { ranked: { label: 'Ranqueado', sublabel: 'Competitivo' }, trophy: { label: 'Troféus', sublabel: 'Escada' } },
    window: { '24h': 'Meta', '7d': 'Recente' },
    formatGroup: 'Tipo de tier list',
    windowGroup: 'Período',
    yourRank: 'Seu rank',
    allRanks: 'Todos',
    lobbies: (rank) => `Partidas ranqueadas no ${rank}`,
    allModes: 'Todos os modos',
    modeGroup: 'Modo de jogo',
    sampled: (n) => `${n} partidas coletadas`,
  },
};

export function TierListControls({
  format,
  windowKey,
  mode,
  modes,
  modeIcons,
  modeNames,
  bracket,
  locale = 'en',
}: {
  format: TierFormat;
  windowKey: TierWindowKey;
  mode?: string;
  modes: { mode: string; battles: number }[];
  modeIcons?: Record<string, string>;
  /** Each mode as the reader's game names it. English when absent. */
  modeNames?: Record<string, string>;
  /** The Ranked bracket being shown, if any. Ranked only. */
  bracket?: RankBracket | null;
  locale?: Locale;
}) {
  return (
    <div className="space-y-3">
      {/* Format and window share a line where there is room — they are both
          "which numbers", where the mode chips below are "which subset". They
          wrap onto separate lines rather than shrinking, because a segmented
          control that has to scroll is worse than one that wraps. */}
      <div className="flex flex-wrap items-center gap-2">
        <FormatTabs format={format} windowKey={windowKey} locale={locale} />
        {/* A bracket page has one window (see bracketTierListHref). */}
        {bracket ? null : <WindowTabs format={format} windowKey={windowKey} mode={mode} locale={locale} />}
      </div>
      {format === 'ranked' ? <BracketTabs bracket={bracket ?? null} mode={mode} locale={locale} /> : null}
      <ModeFilter
        format={format}
        windowKey={windowKey}
        mode={mode}
        modes={modes}
        modeIcons={modeIcons}
        modeNames={modeNames}
        bracket={bracket ?? null}
        locale={locale}
      />
    </div>
  );
}

/**
 * The primary switch, and styled as one: the other two rows narrow a list,
 * this one swaps which game is being ranked.
 *
 * Deliberately drops the mode filter when switching. The two rotations barely
 * overlap — carrying `mode=soloShowdown` onto the Ranked list would land on a
 * mode that has no competitive data at all, and the page would open empty for
 * no reason the reader can see.
 */
function FormatTabs({ format, windowKey, locale }: { format: TierFormat; windowKey: TierWindowKey; locale: Locale }) {
  const w = WORDS[locale];
  return (
    <div
      role="group"
      aria-label={w.formatGroup}
      className="inline-flex gap-1 rounded-2xl border border-border bg-surface-2/70 p-1"
    >
      {FORMATS.map(({ key, icon: Icon }) => {
        const current = key === format;
        const { label, sublabel } = w.format[key];
        return (
          <NavLink
            key={key}
            href={localePath(locale, tierListHref(key, windowKey))}
            aria-current={current ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-colors ${
              current
                ? 'bg-brand text-brand-ink shadow-[0_1px_2px_rgb(0_0_0/0.35)]'
                : 'text-muted hover:bg-surface-3/60 hover:text-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0" />
            <span className="text-left leading-tight">
              <span className="block text-sm font-bold">{label}</span>
              <span
                className={`block text-xs font-semibold ${
                  current ? 'text-brand-ink/70' : 'text-muted'
                }`}
              >
                {sublabel}
              </span>
            </span>
          </NavLink>
        );
      })}
    </div>
  );
}

/**
 * Window switcher. Carries the mode filter across, unlike the format switch:
 * the same mode exists in every window, so dropping it here would just undo
 * the reader's last click.
 */
function WindowTabs({
  format,
  windowKey,
  mode,
  locale,
}: {
  format: TierFormat;
  windowKey: TierWindowKey;
  mode?: string;
  locale: Locale;
}) {
  const w = WORDS[locale];
  return (
    <div
      role="group"
      aria-label={w.windowGroup}
      className="inline-flex rounded-xl border border-border bg-surface-2/70 p-1"
    >
      {(Object.keys(TIER_WINDOWS) as TierWindowKey[]).map((key) => {
        const { sublabel } = TIER_WINDOWS[key];
        const label = w.window[key];
        const current = key === windowKey;
        return (
          <NavLink
            key={key}
            href={localePath(locale, tierListHref(format, key, mode))}
            aria-current={current ? 'page' : undefined}
            className={`flex items-baseline gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              current ? 'bg-surface-3 text-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {label}
            <span className={`text-xs font-bold ${current ? 'text-foreground' : 'text-muted'}`}>
              {sublabel}
            </span>
          </NavLink>
        );
      })}
    </div>
  );
}

/**
 * Which rank's lobbies the list is built from.
 *
 * Carries the mode across, like the window switch: Gem Grab at Mythic and Gem
 * Grab at every rank are the same question asked of a different crowd. Each
 * chip wears the league badge the game shows, which is read before the word.
 */
function BracketTabs({ bracket, mode, locale }: { bracket: RankBracket | null; mode?: string; locale: Locale }) {
  const w = WORDS[locale];
  const chip =
    'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-bold transition-colors';
  const on = 'border-brand bg-brand text-brand-ink shadow-[0_1px_2px_rgb(0_0_0/0.35)]';
  const off = 'border-border bg-surface-2/70 text-muted hover:text-foreground';
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="group" aria-label={w.yourRank} className="flex w-max items-center gap-2">
        <span className="eyebrow pe-1 text-muted">{w.yourRank}</span>
        <NavLink
          keepMap
          href={localePath(locale, bracketTierListHref(null, mode))}
          aria-current={bracket ? undefined : 'page'}
          className={`${chip} ${bracket ? off : on}`}
        >
          {w.allRanks}
        </NavLink>
        {RANK_BRACKETS.map((b) => {
          const current = b.id === bracket?.id;
          const icon = rankedLeagueIconUrl(b.icon);
          return (
            <NavLink
              key={b.slug}
              keepMap
              href={localePath(locale, bracketTierListHref(b, mode))}
              aria-current={current ? 'page' : undefined}
              title={w.lobbies(rankLabel(b, locale))}
              className={`${chip} ${current ? on : off}`}
            >
              {icon ? (
                <Image
                  src={icon}
                  alt=""
                  width={22}
                  height={22}
                  className="size-[22px] shrink-0 object-contain"
                  unoptimized
                />
              ) : null}
              {rankLabel(b, locale)}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Game-mode filter. The row scrolls horizontally on a phone rather than
 * wrapping into four lines of chips, which is the one place horizontal scroll
 * is the right answer.
 */
function ModeFilter({
  format,
  windowKey,
  mode,
  modes,
  modeIcons,
  modeNames,
  bracket,
  locale,
}: {
  format: TierFormat;
  windowKey: TierWindowKey;
  mode?: string;
  modes: { mode: string; battles: number }[];
  /** The game's own mode badge per mode key, read faster than the word. */
  modeIcons?: Record<string, string>;
  modeNames?: Record<string, string>;
  /** Mode chips stay inside the bracket being viewed. */
  bracket: RankBracket | null;
  locale: Locale;
}) {
  if (modes.length === 0) return null;
  const w = WORDS[locale];
  const href = (m?: string) =>
    localePath(locale, bracket ? bracketTierListHref(bracket, m) : tierListHref(format, windowKey, m));

  const chip = 'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors';
  const on = 'border-brand/40 bg-brand/10 text-brand';
  const off = 'border-border bg-surface text-muted hover:text-foreground';

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="group" aria-label={w.modeGroup} className="flex w-max gap-2">
        <NavLink
          href={href()}
          aria-current={mode ? undefined : 'page'}
          className={`${chip} ${mode ? off : on}`}
        >
          {w.allModes}
        </NavLink>

        {modes.map((entry) => {
          const current = entry.mode === mode;
          return (
            <NavLink
              key={entry.mode}
              href={href(entry.mode)}
              aria-current={current ? 'page' : undefined}
              title={w.sampled(locale === 'en' ? entry.battles.toLocaleString() : fmtNumber(entry.battles, locale))}
              className={`${chip} ${current ? on : off}`}
            >
              {modeIcons?.[entry.mode] ? (
                <Image
                  src={modeIcons[entry.mode]}
                  alt=""
                  width={18}
                  height={18}
                  className="size-[18px] shrink-0 object-contain"
                  unoptimized
                />
              ) : null}
              {modeNames?.[entry.mode] ?? humanizeMode(entry.mode)}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}
