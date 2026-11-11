import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { SectionHeading } from '@/components/ui/section-heading';
import { formatPercent } from '@/lib/format';
import { localePath, rankLabel } from '@/lib/i18n';
import { RANK_BRACKETS, bracketIconUrl, type RankBracket } from '@/lib/rank-brackets';
import { getStoredBracketRoster, type ScoredBrawler } from '@/lib/stats';
import { getT } from '@/lib/t';
import { TIER_COLOR } from '@/lib/tiers';
import { requestLocale } from '@/lib/request-locale';

export interface RankCell {
  bracket: RankBracket;
  entry: ScoredBrawler | null;
  position: number | null;
  of: number;
}

/** Place in a list by meta score, 1 = best, or null when not in it. */
function placeIn(scored: ScoredBrawler[], brawlerId: number): { entry: ScoredBrawler | null; position: number | null; of: number } {
  const rated = scored.filter((s) => s.metaScore !== null).sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0));
  const i = rated.findIndex((s) => s.brawlerId === brawlerId);
  return { entry: i >= 0 ? rated[i] : null, position: i >= 0 ? i + 1 : null, of: rated.length };
}

/**
 * The brawler at each Ranked rank (2026-11-11): tier, win rate, pick rate and
 * its place in that rank's list, side by side, so a reader sees at a glance
 * whether a pick holds up as the lobbies get better. From the precomputed
 * per-rank lists only; a rank without one is left out.
 */
/** The brawler's place at each rank with a stored list; null when fewer than two ranks place it. */
export async function byRankCells(brawlerId: number): Promise<RankCell[] | null> {
  const cells: RankCell[] = [];
  for (const bracket of RANK_BRACKETS) {
    const roster = await getStoredBracketRoster(bracket.id).catch(() => null);
    if (!roster) continue;
    cells.push({ bracket, ...placeIn(roster.scored, brawlerId) });
  }
  return cells.filter((c) => c.position !== null && c.of > 0).length >= 2 ? cells : null;
}

export function BrawlerByRank({ cells, name }: { cells: RankCell[] | null; name: string }) {
  const locale = requestLocale();
  const t = getT(locale);
  const lp = (path: string) => localePath(locale, path);
  if (!cells) return null;
  const placed = cells.filter((c) => c.position !== null && c.of > 0);

  // Relative place, so a rank with fewer rated brawlers compares fairly.
  const rel = (c: RankCell) => (c.position as number) / c.of;
  const best = placed.reduce((a, b) => (rel(b) < rel(a) ? b : a));
  const worst = placed.reduce((a, b) => (rel(b) > rel(a) ? b : a));
  const lowest = placed[0];
  const highest = placed[placed.length - 1];
  const verdict =
    rel(highest) <= rel(lowest) - 0.15
      ? t('{name} gets better as the ranks go up.', { name })
      : rel(highest) >= rel(lowest) + 0.15
        ? t('{name} is stronger in lower ranks than at the top.', { name })
        : t('{name} holds about the same place at every rank.', { name });

  return (
    <section id="by-rank" className="scroll-mt-24">
      <SectionHeading title={t('By rank')} subtitle={verdict} />
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cells.map((c) => {
          const isBest = placed.length > 1 && c === best && best !== worst;
          const href = lp(`/tier-list/ranked/rank/${c.bracket.slug}`);
          return (
            <li key={c.bracket.id}>
              <Link
                href={href}
                className={`card row-interactive relative flex h-full flex-col gap-3 p-4 ${isBest ? 'ring-2 ring-brand' : ''}`}
              >
                {isBest ? (
                  <span className="label-game absolute -top-2.5 left-3 rounded-full border-2 border-ink bg-brand px-2 py-0.5 text-[11px] text-brand-ink">
                    {t('Best rank')}
                  </span>
                ) : null}
                <span className="flex items-center gap-2.5">
                  <Image src={bracketIconUrl(c.bracket)} alt="" width={36} height={36} unoptimized className="size-9 shrink-0 object-contain" />
                  <span className="line-clamp-2 min-w-0 flex-1 text-sm font-bold leading-tight">{rankLabel(c.bracket, locale)}</span>
                  {c.entry?.tier ? (
                    <span
                      className="tier-badge tier-badge-sm"
                      style={{ '--tier': TIER_COLOR[c.entry.tier] } as CSSProperties}
                      title={t('{tier} tier', { tier: c.entry.tier })}
                    >
                      <span className="display text-game-stroke text-lg leading-none">{c.entry.tier}</span>
                    </span>
                  ) : null}
                </span>
                {c.entry && c.position ? (
                  <>
                    <span className="flex items-baseline gap-1.5">
                      <span className="display text-3xl leading-none">#{c.position}</span>
                      <span className="text-xs text-muted">{t('of {n}', { n: c.of })}</span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(4, Math.round((1 - (c.position - 1) / Math.max(1, c.of - 1)) * 100))}%`,
                          background: c.entry.tier ? TIER_COLOR[c.entry.tier] : 'var(--brand)',
                        }}
                      />
                    </span>
                    <span className="grid grid-cols-2 gap-2 text-xs text-muted">
                      <span>
                        {t('Win rate')}
                        <span className={`block text-sm font-bold tabular-nums ${(c.entry.normalizedWinRate ?? 0) >= 0.5 ? 'text-victory' : 'text-foreground'}`}>
                          {formatPercent(c.entry.normalizedWinRate)}
                        </span>
                      </span>
                      <span>
                        {t('Pick rate')}
                        <span className="block text-sm font-bold tabular-nums text-accent">{formatPercent(c.entry.usageRate)}</span>
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted">{t('Not enough games at this rank yet.')}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
