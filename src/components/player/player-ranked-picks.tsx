import Image from 'next/image';
import Link from 'next/link';

import { RankedIcon } from '@/components/game-icons';
import { formatPercent, humanizeMode } from '@/lib/format';
import { slugify } from '@/lib/slugs';
import type { BABrawler } from '@/types/brawlapi';
import type { BSPlayerBrawler } from '@/types/brawlstars';
import type { RankedMapPicks } from '@/types/stats';

/**
 * The live Ranked rotation, read against what this player actually owns.
 *
 * `PlayerMetaFit` already answers "is your roster strong" against the trophy
 * list, globally. This answers a different and more actionable question: on
 * the maps you can queue into right now, do you own anything good?
 *
 * That is the one thing a global tier list cannot tell anyone. "Sprout is S
 * tier" is not advice if you do not have Sprout, and it is not advice on a map
 * Sprout is bad on. Every competitor publishes the first half of that sentence
 * and none of them can publish the second, because it needs the player's
 * roster and per-map sampled battles in the same place.
 *
 * Scored on the Ranked list rather than the trophy one, unlike `PlayerMetaFit`
 * — the maps here *are* the Ranked rotation, so the competitive numbers are
 * the ones that apply, and a map with too little Ranked evidence simply drops
 * out rather than being filled in from the ladder.
 */

/**
 * Power level below which owning a brawler is not the same as having it.
 *
 * Nine rather than eleven: a power-9 brawler is playable in Ranked and a lot
 * of accounts sit there, while requiring maxed would report "you have nothing"
 * to most of the playerbase, which is discouraging rather than true.
 */
const READY_POWER = 9;

/** How deep into a map's picks counts as "you have a real option". */
const TOP_N = 3;

interface MapVerdict {
  map: RankedMapPicks;
  /** The best pick on this map the player owns at READY_POWER or above. */
  best: { brawlerId: number; brawlerName: string; score: number; rank: number } | null;
  /** Owned, but not yet levelled — the upgrade that would change this map. */
  almost: { brawlerId: number; brawlerName: string; power: number; rank: number } | null;
}

export function PlayerRankedPicks({
  brawlers,
  maps,
  brawlerMeta,
}: {
  brawlers: BSPlayerBrawler[];
  maps: RankedMapPicks[];
  brawlerMeta: Map<number, BABrawler>;
}) {
  const owned = new Map(brawlers.map((b) => [b.id, b.power]));

  const rated = maps.filter((m) => m.picks.length > 0);
  if (rated.length === 0) return null;

  const verdicts: MapVerdict[] = rated.map((map) => {
    let best: MapVerdict['best'] = null;
    let almost: MapVerdict['almost'] = null;

    map.picks.slice(0, TOP_N).forEach((pick, index) => {
      const power = owned.get(pick.brawlerId);
      if (power === undefined) return;
      if (power >= READY_POWER) {
        if (!best) {
          best = {
            brawlerId: pick.brawlerId,
            brawlerName: pick.brawlerName,
            score: pick.score,
            rank: index + 1,
          };
        }
      } else if (!almost) {
        almost = {
          brawlerId: pick.brawlerId,
          brawlerName: pick.brawlerName,
          power,
          rank: index + 1,
        };
      }
    });

    return { map, best, almost };
  });

  const covered = verdicts.filter((v) => v.best);
  const gaps = verdicts.filter((v) => !v.best);
  // An upgrade that turns a gap into a covered map is worth more than one that
  // improves a map already covered, so those are the only ones offered.
  const upgrades = gaps.filter((v) => v.almost).slice(0, 4);
  const share = covered.length / verdicts.length;

  const strongest = [...covered]
    .sort((a, b) => (a.best!.rank - b.best!.rank) || b.best!.score - a.best!.score)
    .slice(0, 4);

  /*
   * Covered, but not with the map's best answer.
   *
   * Without this the second card collapsed to one sentence and a lot of empty
   * space on any account with full coverage — which is every strong account,
   * i.e. exactly the people most likely to read this. "You own something on
   * every map" is not the end of the advice: owning the third-best pick on
   * fourteen maps is still fourteen maps with a better option available.
   */
  const settling = covered
    .filter((v) => v.best!.rank > 1)
    .sort((a, b) => b.best!.rank - a.best!.rank)
    .slice(0, 4);
  const firstPicks = covered.length - covered.filter((v) => v.best!.rank > 1).length;

  return (
    <section className="space-y-4" aria-labelledby="ranked-picks">
      <div>
        <p className="flex items-center gap-2.5">
          <span aria-hidden className="rule h-4" />
          <span className="eyebrow text-accent">Live Ranked rotation</span>
        </p>
        <h2 id="ranked-picks" className="display mt-2 text-2xl uppercase">
          Your picks right now
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          You own a top-{TOP_N} pick at power {READY_POWER} or above on{' '}
          <strong className="font-bold text-foreground">
            {covered.length} of {verdicts.length}
          </strong>{' '}
          rated maps in the current rotation ({formatPercent(share)}). Scored from
          sampled Ranked battles on each map, not from the ladder.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Where you are strongest
          </p>
          {strongest.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              Nothing in the current rotation yet — the upgrades opposite are the
              fastest way in.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {strongest.map(({ map, best }) => (
                <PickRow
                  key={`${map.mode}-${map.mapName}`}
                  map={map}
                  brawlerId={best!.brawlerId}
                  brawlerName={best!.brawlerName}
                  meta={brawlerMeta.get(best!.brawlerId)}
                  note={best!.rank === 1 ? 'Best pick on the map' : `#${best!.rank} pick`}
                  tone="good"
                />
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          {/* Three states, and the heading has to match the one being shown:
              full coverage under "maps you have no answer for" reads as a bug
              even though both halves are correct. */}
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            {upgrades.length > 0
              ? 'Upgrades that would fix a map'
              : gaps.length > 0
                ? 'Maps you have no answer for'
                : 'Where you are settling'}
          </p>
          {upgrades.length > 0 ? (
            <>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                You already own these — they are just under power {READY_POWER}.
              </p>
              <ul className="mt-3 space-y-2">
                {upgrades.map(({ map, almost }) => (
                  <PickRow
                    key={`${map.mode}-${map.mapName}`}
                    map={map}
                    brawlerId={almost!.brawlerId}
                    brawlerName={almost!.brawlerName}
                    meta={brawlerMeta.get(almost!.brawlerId)}
                    note={`Power ${almost!.power} · #${almost!.rank} pick here`}
                    tone="warn"
                  />
                ))}
              </ul>
            </>
          ) : gaps.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {gaps.slice(0, 4).map(({ map }) => (
                <PickRow
                  key={`${map.mode}-${map.mapName}`}
                  map={map}
                  brawlerId={map.picks[0].brawlerId}
                  brawlerName={map.picks[0].brawlerName}
                  meta={brawlerMeta.get(map.picks[0].brawlerId)}
                  note="Best pick — you do not own it"
                  tone="warn"
                />
              ))}
            </ul>
          ) : settling.length > 0 ? (
            <>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                You have {firstPicks} of {verdicts.length} maps' best pick. On these
                you are on a lower option — the brawler shown is the one the map
                actually wants.
              </p>
              <ul className="mt-3 space-y-2">
                {settling.map(({ map, best }) => (
                  <PickRow
                    key={`${map.mode}-${map.mapName}`}
                    map={map}
                    brawlerId={map.picks[0].brawlerId}
                    brawlerName={map.picks[0].brawlerName}
                    meta={brawlerMeta.get(map.picks[0].brawlerId)}
                    note={`You play #${best!.rank} here`}
                    tone="warn"
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">
              You own the best pick on every rated map in the rotation. There is
              nothing to improve here.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function PickRow({
  map,
  brawlerId,
  brawlerName,
  meta,
  note,
  tone,
}: {
  map: RankedMapPicks;
  brawlerId: number;
  brawlerName: string;
  meta: BABrawler | undefined;
  note: string;
  tone: 'good' | 'warn';
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface-2 p-2.5">
      {meta?.imageUrl ? (
        <Image
          src={meta.imageUrl}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 object-contain"
          loading="lazy"
          unoptimized
        />
      ) : (
        <span aria-hidden className="size-9 shrink-0 rounded-lg bg-surface-3" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold capitalize">
          {brawlerName.toLowerCase()}
        </span>
        <span className={`block truncate text-xs ${tone === 'good' ? 'text-victory' : 'text-muted'}`}>
          {note}
        </span>
      </span>
      <Link
        href={`/maps/${slugify(map.mode)}/${slugify(map.mapName)}`}
        className="shrink-0 text-right text-xs text-muted transition-colors hover:text-brand"
      >
        <span className="block max-w-[8rem] truncate font-semibold">{map.mapName}</span>
        <span className="inline-flex items-center gap-1">
          <RankedIcon className="size-3" />
          {humanizeMode(map.mode)}
        </span>
      </Link>
    </li>
  );
}
