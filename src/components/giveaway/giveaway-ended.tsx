import { Download, Play, Trophy } from 'lucide-react';
import Link from 'next/link';

import { Disclosure } from '@/components/ui/disclosure';
import { BRAWL_PASS_ART, PRIZE_FALLBACK_ART } from '@/lib/giveaway';
import type { GiveawayResult } from '@/lib/giveaway-result';
import { localePath } from '@/lib/i18n';
import { isOptedOut } from '@/lib/opted-out';
import { requestLocale } from '@/lib/request-locale';
import { getT } from '@/lib/t';

/**
 * The giveaway page once entries have closed (2026-11-25): first that the
 * winner is being contacted, then the winner, the replay of the draw and the
 * whole list it was drawn from, as the rules promise.
 */
export function GiveawayEnded({ result, follow }: { result: GiveawayResult | null; follow: React.ReactNode }) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);

  return (
    <div className="space-y-12">
      <section className="reward-stage px-5 pb-10 pt-6 text-center sm:px-10 sm:pb-12">
        <div aria-hidden className="reward-rays" />
        <p className="inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-sm font-semibold">
          {result ? <Trophy aria-hidden className="size-4 text-brand" /> : null}
          {result ? t('The winner') : t('Entries are closed.')}
        </p>
        <div className="relative mx-auto mt-6 w-fit">
          <object data={BRAWL_PASS_ART} type="image/png" aria-label={t('Brawl Pass')} className="reward-float mx-auto block h-32 w-52 sm:h-56 sm:w-96">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small pre-compressed icon */}
            <img src={PRIZE_FALLBACK_ART} alt="" width={240} height={240} className="mx-auto size-32 object-contain sm:size-56" />
          </object>
        </div>
        <h1 className="display text-game-stroke mx-auto mt-4 max-w-2xl break-words text-4xl leading-tight text-white sm:text-6xl">
          {result ? t('{name} won the Brawl Pass!', { name: result.winner.name }) : t('The giveaway has ended')}
        </h1>
        {result ? (
          <>
            {result.winner.tag ? <p className="mt-3 text-lg font-semibold text-white">{result.winner.tag}</p> : null}
            <p className="mx-auto mt-3 max-w-md text-white/80">
              {t('Ticket {ticket} of {tickets}, out of {n} players.', { ticket: result.ticket, tickets: result.tickets, n: result.entrants })}
            </p>
            {result.video ? (
              <a href={result.video} target="_blank" rel="noopener noreferrer" className="btn-game mt-6 inline-flex items-center gap-2 bg-[#ff0033] px-6 py-3 text-white [--btn-shadow:#a3001f]">
                <Play aria-hidden className="size-5 fill-current" />
                {t('Watch the draw')}
              </a>
            ) : null}
          </>
        ) : (
          <p className="mx-auto mt-3 max-w-md text-white/80">
            {t('One winner is drawn at random. We email them first, and the name goes up here when they answer.')}
          </p>
        )}
      </section>

      {result ? (
        <section className="space-y-4">
          <h2 className="display text-2xl">{t('How it was drawn')}</h2>
          <p className="max-w-2xl text-sm text-muted">
            {t('Each point was a ticket, numbered in the order below. Ticket {ticket} was picked with drand round {round}, a public random number that came out after entries closed.', {
              ticket: result.ticket,
              round: result.round,
            })}
          </p>
          <p className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
            <a href={`https://api.drand.sh/public/${result.round}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
              {t('See the random number')}
            </a>
            <a href="/social/giveaway/result.json" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand hover:underline">
              <Download aria-hidden className="size-4" />
              {t('Download the list')}
            </a>
          </p>
          <Disclosure summary={t('All {n} players and their tickets', { n: result.entrants })}>
            <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {result.list.map((row, i) => (
                <li key={row.from} className={`flex items-baseline gap-3 rounded-lg px-2 py-1 ${i === result.winnerRow && result.winner.tag ? 'bg-brand/15 font-semibold' : ''}`}>
                  <span className="w-20 shrink-0 tabular-nums text-muted">{row.from === row.to ? row.from : `${row.from}-${row.to}`}</span>
                  <span className="min-w-0 flex-1 truncate">{isOptedOut(row.tag) ? '-' : row.tag}</span>
                  <span className="tabular-nums">{t('{n} pts', { n: row.points })}</span>
                </li>
              ))}
            </ol>
          </Disclosure>
        </section>
      ) : (
        follow
      )}

      <section className="reward-stage px-5 py-10 text-center sm:px-10">
        <h2 className="display text-game-stroke text-3xl text-white sm:text-4xl">{t('Free rewards every day')}</h2>
        <Link href={lp('/rewards')} className="btn-game mt-5 inline-flex bg-brand px-6 py-3 text-brand-ink [--btn-shadow:#a3730a]">
          {t('See the rewards')}
        </Link>
      </section>

      <p className="text-xs leading-relaxed text-muted">
        {t('Run by BrawlZone, an unofficial fan project. Not sponsored, endorsed or run by Supercell, Google, Apple, YouTube, TikTok, Instagram or Discord.')}{' '}
        <Link href={lp('/giveaway/rules')} className="font-semibold text-brand hover:underline">{t('Read the full rules')}</Link>
      </p>
    </div>
  );
}
