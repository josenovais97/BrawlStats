import Link from 'next/link';

import { pct, rarityColor } from '@/components/starr/rarity';
import { localePath } from '@/lib/i18n';
import { requestLocale } from '@/lib/request-locale';
import {
  atLeastOnce,
  atOrAbove,
  bestRewards,
  perNormalDay,
  type DropHighlight,
  type DropType,
  type StarrDropData,
} from '@/lib/starr-drops';
import { getT, type T } from '@/lib/t';

/**
 * "What can it give me?", on /rewards (2026-10-29).
 *
 * Most free rewards are drops, and the next thing anyone holding one wants
 * to know is what is inside and how likely the good stuff is. The answer
 * already lives on /starr-drops, read from the wiki twice a day; this is
 * the short version for the drop that is live, and the way there.
 */
export function DropOdds({ data, drop }: { data: StarrDropData; drop: DropType }) {
  const t = getT(requestLocale());
  const name = t(drop.name.replace(/s$/, ''));
  const best = bestRewards(drop).slice(0, 10);

  const starr = data.types.find((type) => type.slug === 'starr-drops') ?? null;
  const legendary = starr ? atOrAbove(starr.rarityOdds, 'Legendary') : null;
  const perDay = perNormalDay(data.daily, 'Starr Drop');

  return (
    <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="drop-odds">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- the wiki's own artwork, as on /starr-drops */}
        <img src={drop.imageUrl ?? '/icons/starr-drop.png'} alt="" width={80} height={80} className="size-16 shrink-0 object-contain sm:size-20" />
        <div className="space-y-1">
          <h2 id="drop-odds" className="display text-2xl">{t('What can a {drop} give you?', { drop: name })}</h2>
          <p className="text-sm text-muted">{t('It rolls a rarity first, then one reward of that rarity. The chance of each rarity:')}</p>
        </div>
      </div>

      <ol className="grid gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${drop.rarityOdds.length}, minmax(0, 1fr))` }}>
        {drop.rarityOdds.map((odd) => (
          <li
            key={odd.rarity}
            className="flex flex-col items-center rounded-xl border-t-4 bg-surface-2 px-0.5 py-2.5 text-center"
            style={{ borderColor: rarityColor(odd.rarity) }}
          >
            <span className="text-[9px] font-bold uppercase leading-tight tracking-wide sm:text-xs" style={{ color: rarityColor(odd.rarity) }}>
              {t(odd.rarity === 'Ultra' ? 'Ultra Legendary' : odd.rarity)}
            </span>
            <span className="display mt-1 text-lg leading-none sm:text-3xl">{pct(odd.chance)}</span>
          </li>
        ))}
      </ol>

      {best.length > 0 ? (
        <div>
          <p className="eyebrow mb-2.5">{t('The best rewards, and your chance in one {drop}', { drop: name })}</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {best.map((reward) => (
              <li key={reward.reward} className="flex items-center gap-2.5 rounded-xl bg-surface-2 p-2.5">
                {reward.iconUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- local or wiki icon, as on /starr-drops */
                  <img src={reward.iconUrl} alt="" width={32} height={32} loading="lazy" className="size-8 shrink-0 object-contain" />
                ) : (
                  <span aria-hidden className="size-8 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{rewardName(reward, t)}</p>
                  <p className="text-xs text-muted">
                    <span className="font-bold tabular-nums text-foreground">{pct(reward.chance)}</span> · {t('1 in {n}', { n: Math.round(1 / reward.chance).toLocaleString('en') })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {legendary && perDay ? (
        <p className="text-sm leading-relaxed text-muted">
          {t('Your Daily Wins give {n} Starr Drops a day: a {d} chance of at least one Legendary today, {w} this week and {m} this month.', {
            n: perDay,
            d: pct(atLeastOnce(legendary, perDay)),
            w: pct(atLeastOnce(legendary, perDay * 7)),
            m: pct(atLeastOnce(legendary, perDay * 30)),
          })}
        </p>
      ) : null}

      <Link href={localePath(requestLocale(), '/starr-drops')} className="btn-game inline-flex items-center gap-2 bg-brand px-5 py-3 text-brand-ink">
        {t('Daily schedule and every reward')}
      </Link>
    </section>
  );
}

/** "Skin 80-149 Gem" is a skin worth 80 to 149 gems; the rest read as the wiki writes them. */
function rewardName(reward: DropHighlight, t: T): string {
  const skin = reward.reward.match(/^Skin (\d+-\d+) Gem$/i);
  if (skin) return t('{n}-gem skin', { n: skin[1] });
  return `${reward.amount ? `${reward.amount} ` : ''}${t(reward.label)}`;
}
