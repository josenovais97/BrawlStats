import Image from 'next/image';

import { formatNumber, humanizeMode, titleCase } from '@/lib/format';
import { coinsBetweenLevels } from '@/lib/progression';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';
import type { BSPlayerBrawler } from '@/types/brawlstars';
import type { ModeBestPicks } from '@/types/stats';

/**
 * The live Ranked rotation, read against what this player actually owns.
 *
 * `PlayerMetaFit` answers "is your roster strong" against the trophy list,
 * globally. This answers the more actionable question: in the modes you can
 * queue into right now, what do you play?
 *
 * Two answers per mode, not one verdict. The earlier version showed a single
 * line per mode and picked the *best* thing to say about it, which on a roster
 * short of the meta meant four cards reading "Power 1 — one upgrade away" and
 * one reading "you do not own it". Every one of those is true, none is usable,
 * and the header totalled them into "1 of 6 modes (16.7%)" — a scorecard of
 * things the reader cannot do tonight.
 *
 * So each mode now answers "what do I press now" from the whole pick list, and
 * separately "what would make this better" with its price. The first is always
 * actionable; the second is an investment decision, and it is only shown when
 * it would genuinely beat what the account already has.
 *
 * Grouped by mode rather than by map, deliberately. An earlier version listed
 * individual maps and it was both harder to scan and less useful: people pick
 * brawlers for Gem Grab, not for Hard Rock Mine specifically.
 */

/**
 * Power level below which owning a brawler is not the same as having it.
 *
 * Nine rather than eleven: a power-9 brawler is playable in Ranked and many
 * accounts sit there, while requiring maxed would tell most of the playerbase
 * they own nothing, which is discouraging rather than true.
 */
const READY_POWER = 9;

/** Ranks past this are not "a pick", they are the rest of the roster. */
const MEANINGFUL_RANK = 10;

interface ModeAnswer {
  mode: string;
  label: string;
  meta: BAGameMode | undefined;
  /** The best pick this account can queue with right now. */
  play: { id: number; name: string; rank: number } | null;
  /** The upgrade or unlock that would beat it, and what it costs. */
  invest:
    | { id: number; name: string; rank: number; kind: 'upgrade'; coins: number }
    | { id: number; name: string; rank: number; kind: 'unlock' }
    | null;
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

  const answers: ModeAnswer[] = [];
  for (const mode of modes) {
    const entry = picksByMode.get(mode);
    if (!entry || entry.picks.length === 0) continue;

    let play: ModeAnswer['play'] = null;
    let invest: ModeAnswer['invest'] = null;

    entry.picks.forEach((pick, index) => {
      const rank = index + 1;
      const power = owned.get(pick.brawlerId);

      if (power !== undefined && power >= READY_POWER) {
        if (!play) play = { id: pick.brawlerId, name: pick.brawlerName, rank };
        return;
      }

      /*
       * The first pick this account cannot field. Only the top of the list is
       * worth investing in — being told to unlock the tenth-best pick is not
       * advice — and only when it would actually beat what is already
       * playable, which is checked below once both are known.
       */
      if (invest || rank > MEANINGFUL_RANK) return;
      invest =
        power === undefined
          ? { id: pick.brawlerId, name: pick.brawlerName, rank, kind: 'unlock' }
          : {
              id: pick.brawlerId,
              name: pick.brawlerName,
              rank,
              kind: 'upgrade',
              coins: coinsBetweenLevels(power, READY_POWER),
            };
    });

    // An upgrade that lands below what the account can already field is not an
    // upgrade. Dropping it is what keeps the card from nagging a good roster.
    if (invest && play && (invest as { rank: number }).rank >= (play as { rank: number }).rank) {
      invest = null;
    }

    answers.push({
      mode,
      label: modeMeta.get(mode.toLowerCase())?.name ?? humanizeMode(mode),
      meta: modeMeta.get(mode.toLowerCase()),
      play,
      invest,
    });
  }

  if (answers.length === 0) return null;

  const ready = answers.filter((a) => a.play?.rank === 1).length;

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
          What to play in each mode you can queue right now, and what would improve that
          answer.{' '}
          {ready > 0 ? (
            <>
              You already hold the best pick in{' '}
              <strong className="font-bold text-foreground">
                {ready} of {answers.length}
              </strong>{' '}
              modes.{' '}
            </>
          ) : null}
          Scored from sampled Ranked battles, not from the ladder.
        </p>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2">
        {answers.map((answer) => (
          <ModeCard key={answer.mode} answer={answer} brawlerMeta={brawlerMeta} />
        ))}
      </ul>
    </section>
  );
}

function ModeCard({
  answer,
  brawlerMeta,
}: {
  answer: ModeAnswer;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const { play, invest, label, meta } = answer;
  const accent = meta?.color ?? '#8b95b8';

  return (
    <li className="card overflow-hidden p-3">
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

      {play ? (
        <Row
          art={brawlerMeta.get(play.id)?.imageUrl}
          name={play.name}
          note={play.rank === 1 ? 'Best pick in this mode' : `Your best here · #${play.rank}`}
          tone="good"
        />
      ) : (
        <p className="mt-2 text-sm text-muted">
          Nothing in this mode&rsquo;s picks at power {READY_POWER} yet.
        </p>
      )}

      {invest ? (
        <div className="mt-2 border-t border-border pt-2">
          <Row
            art={brawlerMeta.get(invest.id)?.imageUrl}
            name={invest.name}
            note={
              invest.kind === 'unlock'
                ? `Unlock for the #${invest.rank} pick`
                : `To power ${READY_POWER} · ${formatNumber(invest.coins)} coins`
            }
            tone="invest"
            small
          />
        </div>
      ) : null}
    </li>
  );
}

function Row({
  art,
  name,
  note,
  tone,
  small = false,
}: {
  art: string | undefined;
  name: string;
  note: string;
  tone: 'good' | 'invest';
  small?: boolean;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${small ? 'mt-0' : 'mt-1.5'}`}>
      {art ? (
        <Image
          src={art}
          alt=""
          width={40}
          height={40}
          className={`${small ? 'size-8' : 'size-10'} shrink-0 rounded-lg bg-surface-2`}
          loading="lazy"
          unoptimized
        />
      ) : (
        <span
          aria-hidden
          className={`${small ? 'size-8' : 'size-10'} shrink-0 rounded-lg bg-surface-2`}
        />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate font-bold ${small ? 'text-xs' : 'text-sm'}`}
        >
          {titleCase(name)}
        </span>
        <span
          className={`block truncate text-xs ${
            tone === 'good' ? 'text-victory' : 'text-accent'
          }`}
        >
          {note}
        </span>
      </span>
    </span>
  );
}
