import type { Metadata } from 'next';
import Link from 'next/link';
import { Calculator } from 'lucide-react';

import { JsonLd, breadcrumbSchema, faqSchema } from '@/components/seo/structured-data';
import { PageHeading, SectionHeading } from '@/components/ui/section-heading';
import { formatNumber } from '@/lib/format';
import {
  MIN_SAMPLE_FOR_TIER,
  PICK_WEIGHT,
  PRIOR_BATTLES,
  SCORE_ANCHORS,
  SCORE_THRESHOLDS,
  WIN_WEIGHT,
} from '@/lib/stats';

/**
 * How the meta score is built, in full, including what it cannot do.
 *
 * Every tier list on the internet asserts an ordering; almost none of them say
 * where it came from. The numbers here are not a secret and the method is the
 * strongest thing the site has, so it gets a page of its own rather than a
 * collapsed disclosure at the foot of a list.
 *
 * Every figure is imported from `lib/stats` rather than typed out. A
 * methodology page that drifts from the code is worse than none — it is a
 * confident, checkable, wrong claim — and the only way to guarantee it cannot
 * is to have one source for both.
 *
 * The limitations section is not a disclaimer bolted on the end. It is the
 * part that makes the rest credible, and it says plainly that the score mixes
 * strength with popularity, because a reader who takes it for pure strength is
 * being misled for the brawlers where the two disagree.
 */

export const revalidate = 86400;

const pct = (n: number) => `${(n * 100).toFixed(n * 100 < 1 ? 2 : 0)}%`;

export const metadata: Metadata = {
  alternates: { canonical: '/meta-score' },
  title: 'How the Brawl Stars meta score is calculated',
  description:
    'The full method behind BrawlZone tier lists: where the battles come from, how win rates are adjusted for mode and sample size, how pick rate is weighted, and what the score cannot tell you.',
  openGraph: {
    title: 'How the Brawl Stars meta score is calculated',
    description:
      'Sampling, baseline adjustment, shrinkage, log-scaled pick rate, and the limits of all of it.',
  },
};

const FAQ = [
  {
    question: 'How is the Brawl Stars meta score calculated?',
    answer: `The meta score is a 0-10 number combining two measurements: an adjusted win rate, worth ${WIN_WEIGHT * 100}%, and a log-scaled pick rate, worth ${PICK_WEIGHT * 100}%. Both come from real battles sampled from global-leaderboard players every two hours, and the Ranked list counts competitive battles only.`,
  },
  {
    question: 'What is an adjusted win rate?',
    answer: `A brawler's raw win rate is compared against the average for the modes it is actually played in, then re-centred on 50%. A showdown brawler is judged against showdown, where finishing in the top half caps the ceiling near 40%, and a Brawl Ball brawler against Brawl Ball, where the same cohort wins far more often. One number for both would put every showdown brawler at the bottom.`,
  },
  {
    question: 'Why do rarely-played brawlers not top the tier list?',
    answer: `Every win rate is pulled toward the average by ${PRIOR_BATTLES} pseudo-battles, so a brawler needs roughly that many decided battles before its own record outweighs the prior. Without it the top of the list was whichever rarely-played brawler had a lucky week. Anything under ${MIN_SAMPLE_FOR_TIER} decided battles is not rated at all.`,
  },
  {
    question: 'Does the tier list account for player skill?',
    answer:
      "Partly, and deliberately. Alongside the plain win rate each brawler is measured a second way: every player's win rate with it minus that same player's win rate without it, which removes player skill exactly because it compares people against themselves. The published strength is the average of the two, because each is biased in a different direction. It changes real placements — one brawler ranked 96th on win rate alone and 16th once every player was compared against their own average.",
  },
  {
    question: 'Are the Ranked and trophy scores comparable?',
    answer:
      'No. They are different populations measured against different denominators, so each list is calibrated against its own distribution. A 7.0 on the Ranked list and a 7.0 on the trophy list are not the same claim, which is why the two are never shown side by side.',
  },
];

export default function MetaScorePage() {
  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'How the meta score works', path: '/meta-score' },
        ])}
      />
      <JsonLd data={faqSchema(FAQ)} />

      <PageHeading
        eyebrow={
          <span className="eyebrow flex items-center gap-2 text-accent">
            <Calculator className="size-3.5" />
            Method
          </span>
        }
        title="How the meta score is calculated"
        subtitle="Every number on the tier lists, and where it comes from. Including what it cannot tell you."
      />

      <p className="card border-border-strong p-5 leading-relaxed">
        The meta score is a single 0&ndash;10 number combining{' '}
        <strong>how well a brawler performs</strong> ({WIN_WEIGHT * 100}% of the
        score) with <strong>how much it is actually played</strong> (
        {PICK_WEIGHT * 100}%). It is computed from real battles, not votes,
        opinion or a panel &mdash; and every figure on this page is read
        directly from the code that produces the lists, so it cannot drift out
        of date.
      </p>

      <Step
        n={1}
        title="Sampling real battles"
        body={
          <>
            <p>
              Every two hours the sampler walks the global leaderboards and
              reads the battle logs of the players it finds. A battle log holds
              a player&apos;s last ~25 battles and there is no history endpoint,
              so anything played between visits is lost permanently &mdash; the
              two-hour interval is set by that, not by cost.
            </p>
            <p>
              The Ranked list counts <strong>competitive battles only</strong>.
              Ranked matchmaking pairs comparable opponents, so what is left
              reflects the brawler rather than who was holding it. The trophy
              list counts ladder battles, showdown included.
            </p>
          </>
        }
      />

      <Step
        n={2}
        title="Adjusting the win rate for mode"
        body={
          <>
            <p>
              A raw win rate is not comparable across brawlers, because modes
              are not comparable. Finishing top four of ten in showdown caps the
              achievable rate near 40%; the same cohort wins closer to 78% in
              Brawl Ball. Ranking both on one number puts every showdown brawler
              at the bottom regardless of how good it is.
            </p>
            <p>
              So each brawler is measured against{' '}
              <strong>the average for the mix of modes it is actually played
              in</strong>, and the difference is re-centred on 50%. An adjusted
              rate of 53% means &ldquo;three points better than average, given
              where this brawler gets played&rdquo;.
            </p>
          </>
        }
      />

      <Step
        n={3}
        title="Pulling thin samples toward the average"
        body={
          <>
            <p>
              A 90% win rate over 50 battles is not better than an 86% rate over
              1,300, but a naive ranking says it is. Every rate is therefore
              blended with the average, weighted by{' '}
              <strong>{PRIOR_BATTLES} pseudo-battles</strong>: a brawler needs
              roughly that many decided battles before its own record outweighs
              the prior, which is about where the noise stops dominating.
            </p>
            <p>
              Below <strong>{MIN_SAMPLE_FOR_TIER} decided battles</strong> a
              brawler is not rated at all. &ldquo;We have not measured
              this&rdquo; and &ldquo;we measured this and it is bad&rdquo; are
              different claims, and collapsing them is how tier lists end up
              implying the second about brawlers they have three battles for.
            </p>
          </>
        }
      />

      <Step
        n={4}
        title="Correcting for who is holding it"
        body={
          <>
            <p>
              A win rate says the side holding a brawler won. It does not say
              the brawler is why. Strong players gravitate toward particular
              brawlers and carry their results with them, and step 2 corrects
              for <em>where</em> a brawler is played, not <em>who</em> is
              playing it.
            </p>
            <p>
              So each brawler is also measured a second way:{' '}
              <strong>every player&apos;s win rate with it, minus that same
              player&apos;s win rate without it</strong>. Comparing a player
              against themselves removes skill exactly. The published figure is
              the average of the two estimates, because they are wrong about
              different things &mdash; the first carries the skill of whoever
              played it, the second compares a showdown specialist&apos;s
              showdown games against their own Brawl Ball games.
            </p>
            <p>
              The two agree closely (r&nbsp;=&nbsp;+0.77) and disagree where it
              matters. Bibi ranked 96th on win rate alone and 16th once every
              player was compared against their own average, because she is
              played mostly by weaker accounts and their results were being
              read as hers.
            </p>
          </>
        }
      />

      <Step
        n={5}
        title="Adding pick rate, on a log scale"
        body={
          <>
            <p>
              Win rate alone cannot tell a genuinely strong staple from a niche
              pick that happens to win. A brawler played in 0.13% of battles at
              52% and one played in 3.4% at 52% score the same, even though only
              the second is shaping the meta.
            </p>
            <p>
              Pick rate is <strong>log-scaled</strong>, because the roster spans
              two orders of magnitude of usage. On a linear scale everything
              outside the top handful collapses into the same value.
            </p>
          </>
        }
      />

      <Step
        n={6}
        title="Fixing the scale, and checking it stays fixed"
        body={
          <>
            <p>
              Both measurements are mapped onto 0&ndash;1 between fixed anchors,
              so a score means the same thing from one week to the next rather
              than being rescaled by whoever happens to be present. The anchors
              sit just outside each list&apos;s own 5th&ndash;95th percentile:
            </p>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-semibold">List</th>
                    <th className="py-2 pr-3 font-semibold">Adjusted win rate</th>
                    <th className="py-2 font-semibold">Pick rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(['ranked', 'trophy'] as const).map((format) => {
                    const a = SCORE_ANCHORS[format];
                    return (
                      <tr key={format}>
                        <td className="py-2 pr-3 font-semibold capitalize">{format}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {pct(a.winFloor)} &ndash; {pct(a.winCeiling)}
                        </td>
                        <td className="py-2 tabular-nums">
                          {pct(a.pickFloor)} &ndash; {pct(a.pickCeiling)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p>
              Fixed is not the same as permanent, and that distinction has
              already cost these lists their calibration once. The anchors were
              set before the sampling rate rose eighteenfold in August 2026 and
              nothing re-derived them, so by late September 42% of the Ranked
              roster sat in D while 41% of the trophy roster sat in S or A.
              Nothing failed and nobody was told. They are now re-measured on{' '}
              <strong>every sampler run</strong>, and drifting back outside the
              scale is reported rather than absorbed.
            </p>
          </>
        }
      />

      <Step
        n={7}
        title="Turning the score into a tier"
        body={
          <>
            <p>The cut-offs are plain thresholds on the score:</p>
            <ul className="flex flex-wrap gap-2 not-prose">
              {SCORE_THRESHOLDS.map((t) => (
                <li
                  key={t.tier}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold tabular-nums"
                >
                  <span className="font-black">{t.tier}</span>
                  <span className="ml-2 text-muted">
                    {t.minScore > 0 ? `${t.minScore}+` : 'below 4.0'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        }
      />

      {/*
        The part that makes the rest worth believing. A methodology page that
        only lists strengths is marketing.
      */}
      <section className="space-y-4">
        <SectionHeading
          title="What the meta score cannot tell you"
          subtitle="The honest limits, because a number without them is worth less."
        />
        <ul className="card divide-y divide-border overflow-hidden">
          <Limit title="It mixes strength with popularity, on purpose">
            Pick rate is {PICK_WEIGHT * 100}% of the score. That weight is
            measured, not chosen: against an estimator that controls for player
            skill exactly, the adjusted win rate scores r&nbsp;=&nbsp;+0.77 and
            pick rate r&nbsp;=&nbsp;+0.22, so popularity is a weak but real
            strength signal rather than noise &mdash; and its share of the
            combined signal is about a fifth, which is the weight it now
            carries. It was 35%, where it produced 45% of the actual spread and
            moved brawlers forty places on popularity alone. Even so, a popular
            brawler with a mediocre record will still outscore an unpopular one
            with a better record. Both numbers are printed on every row so you
            can weigh them yourself.
          </Limit>
          <Limit title="The skill correction is partial, not complete">
            Step 4 removes the effect of who is holding a brawler, but the
            estimator behind it compares a player&apos;s games with a brawler
            against all their other games, across every mode. A specialist is
            therefore compared against their own play elsewhere, which is its
            own bias &mdash; smaller than the one it removes, and pointing the
            other way, which is why the two estimates are averaged rather than
            one being picked. A brawler carried by too few players is not
            corrected at all and falls back to the mode-adjusted rate.
          </Limit>
          <Limit title="It does not control for who is playing">
            A win rate says the brawler was on the winning side, not that it
            caused the win. Strong players gravitate toward particular
            brawlers, and the adjustment above corrects for the modes a brawler
            is played in, not the skill of the people playing it.
          </Limit>
          <Limit title="It is a sample, not a census">
            Battles come from players reachable through the global leaderboards
            and their recent opponents, so the numbers lean toward more active
            accounts than the game as a whole.
          </Limit>
          <Limit title="The two lists are not comparable">
            Ranked and the trophy ladder are different populations against
            different denominators, and each is calibrated against its own
            distribution. A 7.0 on one is not a 7.0 on the other, which is why
            they are never shown side by side.
          </Limit>
        </ul>
      </section>

      <section className="space-y-4">
        <SectionHeading title={`Questions`} />
        <dl className="card divide-y divide-border overflow-hidden">
          {FAQ.map((item) => (
            <div key={item.question} className="p-5">
              <dt className="font-bold">{item.question}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-sm leading-relaxed text-muted">
        See it applied on the{' '}
        <Link href="/tier-list/ranked" className="font-medium text-brand hover:underline">
          Ranked tier list
        </Link>{' '}
        and the{' '}
        <Link href="/tier-list/trophy" className="font-medium text-brand hover:underline">
          trophy tier list
        </Link>
        , or disagree with it in the{' '}
        <Link href="/tier-list/maker" className="font-medium text-brand hover:underline">
          tier list maker
        </Link>
        . Sample sizes behind every figure are on the lists themselves; the
        roll-ups they are computed from hold {formatNumber(120)} days of
        history.
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <section className="flex gap-4">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-black tabular-nums text-brand"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="space-y-3 text-sm leading-relaxed text-muted [&_strong]:font-semibold [&_strong]:text-foreground">
          {body}
        </div>
      </div>
    </section>
  );
}

function Limit({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="p-5">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{children}</p>
    </li>
  );
}
