import { AlertTriangle, TrendingUp } from 'lucide-react';

import { Power11Icon } from '@/components/game-icons';
import Link from 'next/link';

import type { AccountFlag, SkillScore } from '@/lib/skill-score';

/**
 * The Skill Score panel: one number, its four inputs, and any flag on the
 * account.
 *
 * The breakdown is not optional decoration. A single 0-10 number about someone
 * else's account is the kind of thing people argue with, and every component is
 * shown with the raw figure behind it so the argument can be with the data
 * rather than with the number.
 */

/*
 * A mixed set on purpose. "Likely smurf" and "ahead of the curve" are readings
 * this site makes, and a warning triangle and a trend arrow are the right marks
 * for a judgement — there is no Brawl Stars asset that means "we think this is
 * a second account". "Collector" is different: it describes a fully progressed
 * roster, and the game already has a mark for that.
 */
const FLAG_STYLE: Record<
  AccountFlag['kind'],
  { icon: (props: { className?: string }) => React.ReactNode; tone: string }
> = {
  smurf: { icon: AlertTriangle, tone: 'text-brand' },
  ahead: { icon: TrendingUp, tone: 'text-victory' },
  collector: { icon: Power11Icon, tone: 'text-accent' },
};

/** The ring's geometry, in the 120x120 viewBox it is drawn in. */
const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/** Score colour, matched to the tier bands in lib/skill-score. */
function toneFor(score: number): string {
  if (score >= 8.5) return '#ff5c72';
  if (score >= 7) return '#ff9f45';
  if (score >= 5.5) return '#ffc53d';
  if (score >= 4) return '#7ad97a';
  return '#7fb3ff';
}

export function PlayerSkillScore({ skill }: { skill: SkillScore }) {
  const tone = toneFor(skill.score);
  const flag = skill.flag;
  const FlagIcon = flag ? FLAG_STYLE[flag.kind].icon : null;

  return (
    /*
     * Not a Panel.
     *
     * This is the one judgement on the page that is entirely ours, and inside
     * a bordered box with a title bar it was the fourth identical rectangle on
     * the first screen -- the same treatment as a lifetime win counter. A
     * signature element has to be drawn differently from the reference
     * material around it, and the cheapest way to do that on a page made of
     * cards is to take the card away.
     *
     * It also fixes a second problem it was causing: as a grid cell beside
     * Ranking it was the taller of the two, so `h-full` stretched Ranking to
     * match and left four hundred pixels of nothing under the standings.
     */
    <section className="@container">
      <div className="flex flex-col gap-8 @3xl:flex-row @3xl:items-center">
          {/*
            The arc is the score out of ten, so the figure can be read without
            reading the figure. SVG rather than a conic gradient: a gradient
            cannot round its ends or carry a track behind it without a second
            element.
          */}
          <div className="relative flex shrink-0 items-center justify-center self-center">
            <svg viewBox="0 0 120 120" className="size-40 -rotate-90 @3xl:size-44">
              <circle
                cx="60"
                cy="60"
                r={RING_R}
                fill="none"
                stroke="var(--surface-3)"
                strokeWidth="9"
              />
              <circle
                cx="60"
                cy="60"
                r={RING_R}
                fill="none"
                stroke={tone}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - Math.min(1, skill.score / 10))}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span
                className="text-5xl font-black tabular-nums leading-none @3xl:text-6xl"
                style={{ color: tone }}
              >
                {skill.score.toFixed(1)}
              </span>
              <span
                className="mt-1.5 text-xs font-bold uppercase tracking-[0.2em]"
                style={{ color: tone }}
              >
                {skill.tier}
              </span>
              <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
                Skill score
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            {skill.components.map((component) => (
              <div key={component.key}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{component.label}</span>
                  <span className="truncate text-xs text-muted">{component.detail}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
                    role="progressbar"
                    aria-label={component.label}
                    aria-valuenow={Math.round(component.value * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(component.value * 100)}%`,
                        background: tone,
                      }}
                    />
                  </div>
                  {/* Points contributed, not the raw 0-100: what the reader
                      wants to know is which component moved the score. */}
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">
                    +{component.points.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      {flag && FlagIcon ? (
        <p className="mt-6 flex max-w-3xl items-start gap-2.5 rounded-xl border border-border/70 bg-surface-2/50 px-4 py-3 text-sm leading-relaxed">
          <FlagIcon className={`mt-0.5 size-4 shrink-0 ${FLAG_STYLE[flag.kind].tone}`} />
          <span>
            <strong className="font-semibold">{flag.label}.</strong>{' '}
            <span className="text-muted">{flag.detail}</span>
          </span>
        </p>
      ) : null}

      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted">
          Weighted toward{' '}
          <Link href="/leaderboard" className="font-medium text-brand hover:underline">
            Ranked
          </Link>
          , the only mode where matchmaking pairs comparable opponents, so the score
          reflects how the account plays rather than how much has been poured into it.
          Progression is capped at 15% for that reason.
          {skill.rankedUnavailable
            ? ` This account has no Ranked elo on record, so that weight is spread across the rest${
                skill.capped
                  ? ' and the score is held at 6.5. Without a Ranked record there is nothing here that can certify more'
                  : ''
              }.`
            : ''}
      </p>
    </section>
  );
}
