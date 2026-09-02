import Image from 'next/image';

import { formatNumber, humanizeMode, titleCase } from '@/lib/format';
import { MAX_POWER_LEVEL, coinsBetweenLevels } from '@/lib/progression';
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

/**
 * Upgrades are quoted to power 11, not to the playable floor.
 *
 * Power 9 is where a brawler stops being dead weight, which is the right bar
 * for "can I queue with this". It is the wrong bar for "what should I spend
 * on": nobody stops at 9, so quoting that price answers a question no one
 * asked and understates what finishing the job actually costs.
 */
const UPGRADE_TARGET = MAX_POWER_LEVEL;

/** One thing this account could bring to a mode, and what standing in the way. */
interface Option {
  id: number;
  name: string;
  /** Position in the mode's pick order. */
  rank: number;
  kind: 'ready' | 'upgrade' | 'unlock';
  /** Present for an upgrade: where it is now, and the coins to finish it. */
  power?: number;
  coins?: number;
}

interface ModeAnswer {
  mode: string;
  label: string;
  meta: BAGameMode | undefined;
  /** The best pick this account can queue with right now. */
  play: Option | null;
  /** The next-best options, whatever their kind. */
  others: Option[];
}

/** Alternatives shown under the pick. Two keeps every card the same height. */
const ALTERNATIVES = 2;

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

    /*
     * Every pick classified, rather than a search for the first of each kind.
     *
     * The card used to hold one answer and two reasons a slot was empty
     * ("you own every better pick"), which is true and tells nobody anything.
     * A mode where the account already holds the best pick has *more* to say,
     * not less: the second and third options are exactly what a player wants
     * when their first choice is banned or taken.
     */
    const options: Option[] = entry.picks
      .slice(0, MEANINGFUL_RANK)
      .map((pick, index): Option => {
        const rank = index + 1;
        const power = owned.get(pick.brawlerId);
        if (power === undefined) {
          return { id: pick.brawlerId, name: pick.brawlerName, rank, kind: 'unlock' };
        }
        if (power >= READY_POWER) {
          return { id: pick.brawlerId, name: pick.brawlerName, rank, kind: 'ready' };
        }
        return {
          id: pick.brawlerId,
          name: pick.brawlerName,
          rank,
          kind: 'upgrade',
          power,
          coins: coinsBetweenLevels(power, UPGRADE_TARGET),
        };
      });

    const play = options.find((option) => option.kind === 'ready') ?? null;
    const others = options.filter((option) => option !== play).slice(0, ALTERNATIVES);

    answers.push({
      mode,
      label: modeMeta.get(mode.toLowerCase())?.name ?? humanizeMode(mode),
      meta: modeMeta.get(mode.toLowerCase()),
      play,
      others,
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

/**
 * Three slots, always, whether or not each is filled.
 *
 * The card looked messy for a structural reason rather than a styling one: a
 * mode with one row sat beside a mode with three, so the grid came out ragged
 * and the eye could not compare like with like. The version that read cleanly
 * was the one where every card happened to have all three.
 *
 * So the shape is fixed — play, upgrade, unlock — and an empty slot says why it
 * is empty. "You own every better pick" is worth a line: it is the answer to
 * the question the slot exists to ask, and it is good news.
 */
/**
 * Three slots, always: what to play, then the next two options.
 *
 * The card looked messy for a structural reason rather than a styling one — a
 * mode with one row sat beside a mode with three, so the grid came out ragged
 * and the eye could not compare like with like. Fixing the shape fixes that,
 * and filling the extra slots with real alternatives rather than "nothing to
 * upgrade" makes the uniform height carry its weight.
 */
function ModeCard({
  answer,
  brawlerMeta,
}: {
  answer: ModeAnswer;
  brawlerMeta: Map<number, BABrawler>;
}) {
  const { play, others, label, meta } = answer;
  const accent = meta?.color ?? '#8b95b8';

  return (
    <li className="card flex flex-col overflow-hidden p-3">
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
        <Empty>Nothing here at power {READY_POWER} yet</Empty>
      )}

      <div className="mt-2 space-y-2 border-t border-border pt-2">
        {others.map((option) => (
          <Row
            key={option.id}
            art={brawlerMeta.get(option.id)?.imageUrl}
            name={option.name}
            note={noteFor(option)}
            tone={option.kind === 'ready' ? 'good' : option.kind === 'upgrade' ? 'invest' : 'lock'}
            small
          />
        ))}
        {Array.from({ length: Math.max(0, ALTERNATIVES - others.length) }).map((_, i) => (
          <Empty key={`pad-${i}`} small>
            No other picks with data yet
          </Empty>
        ))}
      </div>
    </li>
  );
}

function noteFor(option: Option): string {
  if (option.kind === 'ready') return `Also ready · #${option.rank}`;
  if (option.kind === 'unlock') return `Unlock for the #${option.rank} pick`;
  return `#${option.rank} pick · power ${option.power} → ${UPGRADE_TARGET} · ${formatNumber(
    option.coins ?? 0,
  )} coins`;
}

/** Holds a slot's height so the grid stays a matrix rather than a staircase. */
function Empty({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 ${small ? 'min-h-8' : 'mt-1.5 min-h-10'}`}>
      {/* An invisible spacer, not a dashed outline. The slot needs to hold the
          row's height and keep the text aligned with the names above it;
          drawing a box around nothing just adds another edge to read. */}
      <span aria-hidden className={`${small ? 'size-8' : 'size-10'} shrink-0`} />
      <span className={`text-muted ${small ? 'text-xs' : 'text-sm'}`}>{children}</span>
    </span>
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
  tone: 'good' | 'invest' | 'lock';
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
            tone === 'good' ? 'text-victory' : tone === 'invest' ? 'text-accent' : 'text-muted'
          }`}
        >
          {note}
        </span>
      </span>
    </span>
  );
}
