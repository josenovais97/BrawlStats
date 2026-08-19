import { AlertTriangle, Boxes, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { SectionHeading } from '@/components/ui/section-heading';
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

const FLAG_STYLE: Record<AccountFlag['kind'], { icon: typeof Sparkles; tone: string }> = {
  smurf: { icon: AlertTriangle, tone: 'text-brand' },
  ahead: { icon: TrendingUp, tone: 'text-victory' },
  collector: { icon: Boxes, tone: 'text-accent' },
};

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
    <section>
      <SectionHeading title="Skill score" aside="How the account plays" />

      <div className="card card-glow p-5 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-baseline gap-3 sm:flex-col sm:items-center sm:gap-1">
            <span
              className="text-6xl font-black tabular-nums leading-none"
              style={{ color: tone }}
            >
              {skill.score.toFixed(1)}
            </span>
            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: tone }}>
              {skill.tier}
            </span>
            <span className="text-xs text-muted sm:mt-1">out of 10</span>
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
          <p className="mt-5 flex items-start gap-2.5 rounded-lg bg-surface-2 px-4 py-3 text-sm leading-relaxed">
            <FlagIcon className={`mt-0.5 size-4 shrink-0 ${FLAG_STYLE[flag.kind].tone}`} />
            <span>
              <strong className="font-semibold">{flag.label}.</strong>{' '}
              <span className="text-muted">{flag.detail}</span>
            </span>
          </p>
        ) : null}

        <p className="mt-4 text-xs leading-relaxed text-muted">
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
      </div>
    </section>
  );
}
