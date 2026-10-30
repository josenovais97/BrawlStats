'use client';

import { useEffect, useState } from 'react';

import { useLocale } from '@/components/i18n/use-locale';
import { useT } from '@/components/i18n/use-t';
import { pct, rarityColor } from '@/components/starr/rarity';
import { Confetti } from '@/components/ui/confetti';
import { isBetter, rollDrop, type OpenerDrop, type Roll } from '@/lib/drop-roll';

/**
 * Open a Starr Drop, with the real odds (2026-10-29).
 *
 * The game's own ritual: tap, and the drop climbs Rare, Super Rare, Epic...
 * until it stops, then one more tap opens it. The rarity and the reward are
 * rolled from the same wiki tables the page prints, so a hundred openings
 * here feel like what a hundred Daily Wins actually give -- which the
 * percentages alone never do. Nothing reaches anyone's account, and the
 * page says so beside it.
 */

type Phase = 'ready' | 'climbing' | 'open';

interface Tally {
  opened: number;
  /** Legendary or rarer. */
  top: number;
  best: Roll | null;
}

/** Per browser, so a streak survives a reload. Losing it costs nothing. */
const STORE = 'bz-drop-opener-v1';

type Umami = { umami?: { track: (event: string, data?: Record<string, unknown>) => void } };
const track = (event: string, data: Record<string, unknown>) => (window as Window & Umami).umami?.track(event, data);

export function DropOpener({ drops, shareUrl }: { drops: OpenerDrop[]; shareUrl: string }) {
  const t = useT();
  const locale = useLocale();
  const [slug, setSlug] = useState(drops[0].slug);
  const drop = drops.find((d) => d.slug === slug) ?? drops[0];
  const [phase, setPhase] = useState<Phase>('ready');
  const [level, setLevel] = useState(0);
  const [roll, setRoll] = useState<Roll | null>(null);
  const [ten, setTen] = useState<Roll[] | null>(null);
  const [taps, setTaps] = useState(0);
  const [burst, setBurst] = useState(0);
  const [tallies, setTallies] = useState<Record<string, Tally>>({});
  const [shared, setShared] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage exists only after hydration
      if (saved) setTallies(JSON.parse(saved));
    } catch {
      /* private window: start from zero */
    }
  }, []);

  const legendaryAt = drop.odds.findIndex((odd) => odd.rarity === 'Legendary');
  const isTop = (r: Roll) => legendaryAt !== -1 && r.level >= legendaryAt;
  const tally = tallies[slug] ?? { opened: 0, top: 0, best: null };
  const odd = drop.odds[Math.min(level, drop.odds.length - 1)];
  const color = rarityColor(odd.rarity);
  const oneIn = (chance: number) => Math.round(1 / chance).toLocaleString(locale);

  function record(rolls: Roll[]) {
    setTallies((prev) => {
      const cur = prev[slug] ?? { opened: 0, top: 0, best: null };
      const best = rolls.reduce<Roll | null>((b, r) => (isBetter(r, b) ? r : b), cur.best);
      const next = { ...prev, [slug]: { opened: cur.opened + rolls.length, top: cur.top + rolls.filter(isTop).length, best } };
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        /* not saved, still counted */
      }
      return next;
    });
    if (rolls.some(isTop)) setBurst((b) => b + 1);
  }

  function tap() {
    setTaps((n) => n + 1);
    setTen(null);
    setShared(false);
    if (phase !== 'climbing' || !roll) {
      setRoll(rollDrop(drop));
      setLevel(0);
      setPhase('climbing');
      return;
    }
    if (level < roll.level) {
      setLevel(level + 1);
      return;
    }
    setPhase('open');
    record([roll]);
    track('drop_open', { drop: slug, rarity: drop.odds[roll.level].rarity });
  }

  function openTen() {
    const rolls = Array.from({ length: 10 }, () => rollDrop(drop));
    setTen([...rolls].sort((a, b) => (isBetter(a, b) ? -1 : 1)));
    setPhase('ready');
    setRoll(null);
    setLevel(0);
    setShared(false);
    record(rolls);
    track('drop_open', { drop: slug, count: 10 });
  }

  function choose(next: string) {
    setSlug(next);
    setPhase('ready');
    setRoll(null);
    setLevel(0);
    setTen(null);
  }

  async function share() {
    const best = tally.best;
    if (!best) return;
    const text = t('{n} drops opened on BrawlZone, best pull: {best} ({rarity}). Try your luck:', {
      n: tally.opened,
      best: best.reward?.name ?? drop.name,
      rarity: drop.odds[best.level]?.label ?? '',
    });
    track('drop_share', { drop: slug });
    try {
      if (navigator.share) {
        await navigator.share({ text, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      setShared(true);
    } catch {
      /* closed the share sheet */
    }
  }

  const opened = phase === 'open' && roll;

  return (
    <div className="space-y-3">
      <Confetti burst={burst} />
      <div className="reward-stage px-4 pb-6 pt-4 sm:px-8 sm:pb-8">
        <div aria-hidden className="reward-rays" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5" role="group" aria-label={t('Which drop')}>
            {drops.map((d) => (
              <button
                key={d.slug}
                type="button"
                onClick={() => choose(d.slug)}
                aria-pressed={d.slug === slug}
                className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
                  d.slug === slug ? 'bg-brand text-brand-ink' : 'bg-black/35 text-white/80 hover:text-white'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
          <p className="rounded-full bg-black/35 px-3 py-1.5 text-xs font-semibold text-white/85 tabular-nums">
            {t('{n} opened · {k} Legendary or better', { n: tally.opened.toLocaleString(locale), k: tally.top })}
          </p>
        </div>

        <button
          type="button"
          onClick={tap}
          aria-label={opened ? t('Open another {drop}', { drop: drop.name }) : t('Tap the {drop}', { drop: drop.name })}
          className="relative mx-auto mt-4 grid size-48 touch-manipulation select-none place-items-center sm:size-60"
        >
          <span
            aria-hidden
            className="absolute inset-6 rounded-full opacity-70 blur-2xl transition-colors duration-300"
            style={{ background: opened ? rarityColor(drop.odds[roll.level].rarity) : color }}
          />
          {opened ? (
            /* eslint-disable-next-line @next/next/no-img-element -- local or wiki icon, as in the tables below */
            <img
              key={`r${taps}`}
              src={roll.reward?.iconUrl ?? drop.image}
              alt=""
              width={200}
              height={200}
              className="animate-picture-reveal relative size-36 object-contain drop-shadow-[0_14px_14px_rgb(0_0_0/0.5)] sm:size-44"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- our own drop, or the wiki's artwork */
            <img
              key={`d${taps}`}
              src={drop.image}
              alt=""
              width={200}
              height={200}
              className={`${taps > 0 ? 'animate-picture-shake' : 'reward-float'} relative size-40 object-contain sm:size-52`}
              style={{ filter: `${drop.tint?.[odd.rarity] ?? ''} drop-shadow(0 0 26px ${color})` }}
            />
          )}
        </button>

        <div className="mt-2 min-h-24 text-center" aria-live="polite">
          {opened ? (
            <>
              <p className="label-game text-xs" style={{ color: rarityColor(drop.odds[roll.level].rarity) }}>
                {drop.odds[roll.level].label}
              </p>
              <p key={`n${taps}`} className="animate-picture-in display text-game-stroke mt-1 text-3xl leading-none text-white sm:text-5xl">
                {roll.reward?.name ?? t('{rarity} {drop}', { rarity: drop.odds[roll.level].label, drop: drop.name })}
              </p>
              <p className="mt-2 text-xs text-white/70">
                {t('{p} chance per drop, 1 in {n}', { p: pct(roll.chance), n: oneIn(roll.chance) })}
              </p>
            </>
          ) : (
            <>
              <p key={`l${level}`} className="animate-picture-in display text-game-stroke text-3xl leading-none sm:text-4xl" style={{ color }}>
                {odd.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-white/80">
                {phase === 'climbing' ? t('Keep tapping!') : t('Tap the drop to open it')}
              </p>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {opened ? (
            <button type="button" onClick={tap} className="btn-game bg-[#3ddc63] px-5 py-2.5 text-[#0b2a14] [--btn-shadow:#1a7a33]">
              {t('Open another')}
            </button>
          ) : null}
          <button type="button" onClick={openTen} className="btn-game bg-brand px-5 py-2.5 text-brand-ink">
            {t('Open 10 at once')}
          </button>
          {tally.best ? (
            <button type="button" onClick={share} className="btn-game bg-white px-5 py-2.5 text-[#10142a] [--btn-shadow:#9aa0b8]">
              {shared ? t('Copied!') : t('Share my best')}
            </button>
          ) : null}
        </div>
      </div>

      {ten ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {ten.map((r, i) => (
            <li
              key={`${taps}-${i}`}
              className="animate-picture-in flex items-center gap-2 rounded-xl border-l-4 bg-surface p-2.5"
              style={{ borderColor: rarityColor(drop.odds[r.level].rarity), animationDelay: `${i * 60}ms` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local or wiki icon */}
              <img src={r.reward?.iconUrl ?? drop.image} alt="" width={32} height={32} className="size-8 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">{r.reward?.name ?? drop.odds[r.level].label}</p>
                <p className="text-[11px] font-bold uppercase" style={{ color: rarityColor(drop.odds[r.level].rarity) }}>
                  {drop.odds[r.level].label}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs leading-relaxed text-muted">
        {tally.best
          ? `${t('Your best so far: {best} ({rarity}).', { best: tally.best.reward?.name ?? drop.name, rarity: drop.odds[tally.best.level]?.label ?? '' })} `
          : null}
        {t('A simulation with the real odds from the Brawl Stars Wiki. Nothing is added to your game account.')}
      </p>
    </div>
  );
}
