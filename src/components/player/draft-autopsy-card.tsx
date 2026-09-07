import Image from 'next/image';
import Link from 'next/link';

import { brawlerIconUrl, modeLabel } from '@/lib/brawlapi';
import { draftWasTheProblem, type DraftAutopsy } from '@/lib/draft-autopsy';
import { titleCase } from '@/lib/format';
import { brawlerPath, slugify } from '@/lib/slugs';
import type { BABrawler, BAGameMode } from '@/types/brawlapi';

/**
 * One battle, explained as far as the data goes and no further.
 *
 * The headline is a verdict on the *draft*, and the three it can reach are
 * deliberately different claims: the draft lost it, the draft was fine, or
 * there is not enough evidence to say. That last one is the important one — a
 * page that always has an explanation is a horoscope, and the honest answer to
 * most losses in a game like this is that the draft was even and something else
 * decided it.
 *
 * What "something else" was is not guessed at. The API reports drafts, maps and
 * results; it does not report aim, positioning or gadget timing, and the card
 * says so in place rather than hinting at insight it does not have.
 */
export function DraftAutopsyCard({
  autopsy,
  brawlerMeta,
  modeMeta,
}: {
  autopsy: DraftAutopsy;
  brawlerMeta: Map<number, BABrawler>;
  modeMeta: Map<string, BAGameMode>;
}) {
  const name = (id: number) => titleCase(brawlerMeta.get(id)?.name ?? `#${id}`);
  const art = (id: number) => brawlerMeta.get(id)?.imageUrl ?? brawlerIconUrl(id);
  const mode = modeLabel(modeMeta, autopsy.mode);

  const blamed = draftWasTheProblem(autopsy);

  /*
   * Silent only when there is genuinely nothing to say.
   *
   * This used to also fire on `confidence === 'low'`, which put "not enough
   * sampled battles" on nearly every card: low confidence means the estimate
   * leans on overall Ranked form rather than this map's, which is a weaker
   * claim, not an absent one. The strength of the claim belongs in the
   * wording, not in whether the card speaks.
   */
  const unclear = autopsy.winChance === null;

  const chance = autopsy.winChance;
  const pct = chance === null ? null : Math.round(chance * 100);

  /*
   * The headline is the percentage, because that is the sentence people
   * already know how to read. "The draft was the problem" is a verdict a
   * reader has to take on trust; "your draft was 38% to win this" is the same
   * verdict with the evidence in it.
   */
  const headline =
    unclear || pct === null
      ? 'Not enough sampled battles to judge this draft'
      : pct >= 60
        ? `Your draft was ${pct}% to win this`
        : pct <= 40
          ? `Your draft was ${pct}% to win this`
          : 'The drafts were close to even';

  const accent = blamed ? 'var(--defeat)' : unclear ? 'var(--muted)' : 'var(--accent-2)';

  return (
    <article className="card card-glow relative overflow-hidden">
      <span className="block h-1 w-full" style={{ background: accent }} />

      <div className="space-y-4 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>
            Last loss · {mode}
            {autopsy.mapName ? (
              <>
                {' · '}
                <Link
                  href={`/maps/${slugify(mode)}/${slugify(autopsy.mapName)}`}
                  prefetch={false}
                  className="hover:underline"
                >
                  {autopsy.mapName}
                </Link>
              </>
            ) : null}
          </p>
          <h3 className="mt-1 text-xl font-black leading-tight sm:text-2xl">{headline}</h3>
        </div>

        {/* The two drafts, side by side, because the comparison is the claim. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Side ids={autopsy.mine.brawlerIds} label="Yours" art={art} />
          {pct !== null ? (
            /* Both halves, because a lone "62%" invites the reader to wonder
               what the other side was. Two numbers that sum to 100 answer it
               without a legend. */
            <p className="shrink-0 text-center">
              <span
                className={`block text-2xl font-black tabular-nums ${
                  pct >= 50 ? 'text-victory' : 'text-defeat'
                }`}
              >
                {pct}%
              </span>
              <span className="block text-[11px] leading-tight text-muted">
                to win
                <br />
                <span className="tabular-nums">vs {100 - pct}%</span>
              </span>
            </p>
          ) : null}
          <Side ids={autopsy.theirs.brawlerIds} label="Theirs" art={art} muted />
        </div>

        <ul className="space-y-1.5 text-sm leading-relaxed">
          {autopsy.worstMatchup ? (
            <Line>
              <strong className="font-semibold">{name(autopsy.worstMatchup.brawlerId)}</strong> was
              countered by{' '}
              <Link
                href={brawlerPath(
                  autopsy.worstMatchup.againstId,
                  brawlerMeta.get(autopsy.worstMatchup.againstId)?.name ?? '',
                )}
                prefetch={false}
                className="font-semibold transition-colors hover:text-brand"
              >
                {name(autopsy.worstMatchup.againstId)}
              </Link>{' '}
              — {Math.abs(autopsy.worstMatchup.edge).toFixed(1)} points below its usual record,
              over {autopsy.worstMatchup.battles.toLocaleString('en-US')} battles.
            </Line>
          ) : null}

          {autopsy.keyEnemy ? (
            <Line>
              Their strongest pick here was{' '}
              <strong className="font-semibold">{name(autopsy.keyEnemy.brawlerId)}</strong>, at{' '}
              {autopsy.keyEnemy.edge >= 0 ? '+' : '−'}
              {Math.abs(autopsy.keyEnemy.edge).toFixed(1)} points on this map.
            </Line>
          ) : null}

          {autopsy.shape ? (
            <Line>
              Your shape —{' '}
              <span className="font-semibold capitalize">
                {autopsy.shape.roles.join(' + ').toLowerCase()}
              </span>{' '}
              — wins {(autopsy.shape.score * 100).toFixed(1)}% adjusted across{' '}
              {autopsy.shape.decided.toLocaleString('en-US')} sampled battles.
            </Line>
          ) : null}

          {autopsy.betterPick ? (
            <Line>
              From your own maxed roster,{' '}
              <Link
                href={brawlerPath(
                  autopsy.betterPick.inId,
                  brawlerMeta.get(autopsy.betterPick.inId)?.name ?? '',
                )}
                prefetch={false}
                className="font-semibold transition-colors hover:text-brand"
              >
                {name(autopsy.betterPick.inId)}
              </Link>{' '}
              over <span className="font-semibold">{name(autopsy.betterPick.outId)}</span> would
              have improved the draft most, by {autopsy.betterPick.gain.toFixed(1)} points.
            </Line>
          ) : null}
        </ul>

        {/*
          The limit, stated rather than implied. It is the difference between a
          tool that explains what it measured and one that pretends to have
          watched the game.
        */}
        <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
          {unclear
            ? 'Too few sampled battles on this map to compare the drafts. '
            : blamed
              ? 'This explains the draft only. '
              : 'The draft does not explain this loss. '}
          {/*
            What the percentage is, said plainly.

            It combines each side's measured record on this map with how those
            brawlers fare against each other, then compares the two — so it is
            the chance the *draft* had, not the chance you had. Aim,
            positioning and gadget timing are not in the battle log and are not
            guessed at here.
          */}
          The percentage is the drafts compared:{' '}
          {autopsy.confidence === 'low'
            ? 'mostly each side\u2019s overall Ranked form, because this map has too little data on these brawlers yet'
            : 'each side\u2019s measured record on this map'}
          , adjusted for how those brawlers fare against each other. It is the draft&apos;s
          chance, not yours — aim, positioning and gadget timing are not in the battle log and
          are not guessed at. Confidence:{' '}
          <span className="font-semibold">{autopsy.confidence}</span>
          {autopsy.supportingBattles > 0
            ? `, from ${autopsy.supportingBattles.toLocaleString('en-US')} sampled battles on this map`
            : ''}
          .
        </p>
      </div>
    </article>
  );
}

function Side({
  ids,
  label,
  art,
  muted = false,
}: {
  ids: number[];
  label: string;
  art: (id: number) => string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {ids.map((id) => (
          <Image
            key={id}
            src={art(id)}
            alt=""
            width={40}
            height={40}
            className={`size-10 shrink-0 rounded-lg bg-surface-2 ${muted ? 'opacity-70' : ''}`}
            loading="lazy"
            unoptimized
          />
        ))}
      </div>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-muted/50" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}
