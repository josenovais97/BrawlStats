import Image from 'next/image';

import { formatPercent, humanizeMode } from '@/lib/format';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { BSPlayerBrawler } from '@/types/brawlstars';
import type { ModeBestPicks } from '@/types/stats';

/**
 * The live Ranked rotation, read against what this player actually owns.
 *
 * `PlayerMetaFit` answers "is your roster strong" against the trophy list,
 * globally. This answers the more actionable question: in the modes you can
 * queue into right now, do you own anything good?
 *
 * That is the one thing a global tier list cannot tell anyone. "Sprout is S
 * tier" is not advice if you do not own Sprout, and it is not advice in a mode
 * Sprout is bad in. Every competitor publishes the first half of that sentence
 * and none can publish the second, because it needs a player's roster and
 * sampled battles in the same place.
 *
 * Grouped by mode rather than by map, deliberately. An earlier version listed
 * individual maps and it was both harder to scan and less useful: people pick
 * brawlers for Gem Grab, not for Hard Rock Mine specifically, and a rotation
 * of 26 maps produced a wall where six modes produce an answer. It also fixed
 * a layout problem — a maxed account had a top pick on every map, so the
 * advice half of the section was permanently empty.
 */

/**
 * Power level below which owning a brawler is not the same as having it.
 *
 * Nine rather than eleven: a power-9 brawler is playable in Ranked and many
 * accounts sit there, while requiring maxed would tell most of the playerbase
 * they own nothing, which is discouraging rather than true.
 */
const READY_POWER = 9;

/** How deep into a mode's picks still counts as a real option. */
const TOP_N = 3;

interface ModeVerdict {
  mode: string;
  label: string;
  meta: BAGameMode | undefined;
  /** Best pick in this mode the player owns at READY_POWER or above. */
  best: { id: number; name: string; rank: number } | null;
  /** Owned but under-levelled: the upgrade that would change this mode. */
  almost: { id: number; name: string; rank: number; power: number } | null;
  /** The mode's own best pick, for when the player has neither. */
  top: { id: number; name: string } | null;
}

export function PlayerRankedPicks({
  brawlers,
  picksByMode,
  modes,
  brawlerMeta,
  modeMeta,
}: {
  brawlers: BSPlayerBrawler[];
  picksByMode: Map<string, ModeBestPicks>;
  /** Modes in the current Ranked rotation, in the order to show them. */
  modes: string[];
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
}) {
  const owned = new Map(brawlers.map((b) => [b.id, b.power]));

  const verdicts: ModeVerdict[] = [];
  for (const mode of modes) {
    const entry = picksByMode.get(mode);
    if (!entry || entry.picks.length === 0) continue;

    let best: ModeVerdict['best'] = null;
    let almost: ModeVerdict['almost'] = null;

    entry.picks.slice(0, TOP_N).forEach((pick, index) => {
      const power = owned.get(pick.brawlerId);
      if (power === undefined) return;
      if (power >= READY_POWER) {
        if (!best) best = { id: pick.brawlerId, name: pick.brawlerName, rank: index + 1 };
      } else if (!almost) {
        almost = { id: pick.brawlerId, name: pick.brawlerName, rank: index + 1, power };
      }
    });

    verdicts.push({
      mode,
      label: modeMeta.get(mode.toLowerCase())?.name ?? humanizeMode(mode),
      meta: modeMeta.get(mode.toLowerCase()),
      best,
      almost,
      top: { id: entry.picks[0].brawlerId, name: entry.picks[0].brawlerName },
    });
  }

  if (verdicts.length === 0) return null;

  const covered = verdicts.filter((v) => v.best).length;

  return (
    <section className="space-y-4" aria-labelledby="ranked-picks">
      <div>
        <p className="flex items-center gap-2.5">
          <span aria-hidden className="rule h-4" />
          <span className="eyebrow text-accent">Live Ranked rotation</span>
        </p>
        <h2 id="ranked-picks" className="display mt-2 text-2xl uppercase">
          Your picks by mode
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          You own a top-{TOP_N} pick at power {READY_POWER} or above in{' '}
          <strong className="font-bold text-foreground">
            {covered} of {verdicts.length}
          </strong>{' '}
          modes ({formatPercent(covered / verdicts.length)}). Scored from sampled
          Ranked battles, not from the ladder.
        </p>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {verdicts.map((v) => (
          <ModeRow key={v.mode} verdict={v} brawlerMeta={brawlerMeta} />
        ))}
      </ul>
    </section>
  );
}

function ModeRow({
  verdict,
  brawlerMeta,
}: {
  verdict: ModeVerdict;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const { best, almost, top, label, meta } = verdict;

  // Three states, in order of how much they ask of the reader: you are set,
  // you are one upgrade away, or you do not own the answer at all.
  const show = best ?? almost ?? top;
  const tone = best ? 'good' : almost ? 'warn' : 'bad';
  const note = best
    ? best.rank === 1
      ? 'Best pick in this mode'
      : `You play the #${best.rank} pick`
    : almost
      ? `Power ${almost.power} — one upgrade away`
      : 'Best pick, and you do not own it';

  const art = show ? brawlerMeta.get(show.id)?.imageUrl : undefined;
  const accent = meta?.color ?? '#8b95b8';

  return (
    <li className="card flex items-center gap-3 p-3">
      {art ? (
        <Image
          src={art}
          alt=""
          width={44}
          height={44}
          className="size-11 shrink-0 object-contain"
          loading="lazy"
          unoptimized
        />
      ) : (
        <span aria-hidden className="size-11 shrink-0 rounded-lg bg-surface-2" />
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {meta?.imageUrl ? (
            <Image
              src={meta.imageUrl}
              alt=""
              width={14}
              height={14}
              className="size-3.5 shrink-0"
              loading="lazy"
              unoptimized
            />
          ) : null}
          <span
            className="truncate text-xs font-bold uppercase tracking-wide"
            style={{ color: accent }}
          >
            {label}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-sm font-bold capitalize">
          {show ? show.name.toLowerCase() : '—'}
        </span>
        <span
          className={`block truncate text-xs ${
            tone === 'good' ? 'text-victory' : tone === 'warn' ? 'text-accent' : 'text-muted'
          }`}
        >
          {note}
        </span>
      </span>
    </li>
  );
}
