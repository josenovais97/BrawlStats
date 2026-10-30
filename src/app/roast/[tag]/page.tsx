import type { Metadata } from 'next';
import { ArrowRight, Flame } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { AccountValueForm } from '@/components/account-value/tag-form';
import { ShareImageButton } from '@/components/share-image-button';
import { ErrorState } from '@/components/ui/error-state';
import { playerIconUrl } from '@/lib/brawlapi';
import { toApiError } from '@/lib/errors';
import { localePath } from '@/lib/i18n';
import { getRoast } from '@/lib/roast-data';
import { requestLocale } from '@/lib/request-locale';
import { getT } from '@/lib/t';
import { displayTag, normalizeTag } from '@/lib/tags';

/**
 * One account's roast: the score, the title, five lines and a closer.
 *
 * Rendered per request like the account value -- the player and the log are
 * live fetches -- and behind its own proxy budget (`/roast/` in
 * LIMITED_PREFIXES). Never indexed: one page per tag is trap 5 in AGENTS.md.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ tag: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = getT(requestLocale());
  const { tag } = await params;
  return {
    title: t('Roast of {tag}', { tag: displayTag(tag) }),
    alternates: { canonical: `/roast/${normalizeTag(tag)}` },
    robots: { index: false, follow: false },
  };
}

export default async function RoastPage({ params }: PageProps) {
  const t = getT(requestLocale());
  const lp = (path: string) => localePath(requestLocale(), path);
  const { tag } = await params;

  let result;
  try {
    result = await getRoast(tag, requestLocale());
  } catch (err) {
    const apiError = toApiError(err);
    return (
      <div className="space-y-8">
        <ErrorState
          code={apiError.code}
          title={apiError.code === 'notFound' ? t('Player not found') : undefined}
          detail={
            apiError.code === 'notFound'
              ? t('No player exists with the tag {tag}. Check it in-game under your profile.', { tag: displayTag(tag) })
              : undefined
          }
        />
        <AccountValueForm base="/roast" cta={t('Roast me')} />
      </div>
    );
  }

  const { player, roast } = result;
  const clean = normalizeTag(player.tag);

  return (
    <div className="space-y-10">
      <section className="card card-glow relative overflow-hidden p-6 sm:p-10">
        <div className="flex items-center gap-4">
          <Image
            src={playerIconUrl(player.icon?.id)}
            alt=""
            width={72}
            height={72}
            className="size-16 rounded-2xl bg-surface-2"
            unoptimized
          />
          <div className="min-w-0">
            <h1 className="display text-game-stroke truncate text-2xl sm:text-3xl">{player.name}</h1>
            <p className="text-sm text-muted">{displayTag(player.tag)}</p>
          </div>
        </div>

        <p className="mt-8 text-sm font-bold uppercase tracking-wide text-muted">{t('Account rating')}</p>
        <p className="display mt-1 text-6xl leading-none text-brand sm:text-7xl">
          {roast.score.toFixed(1)}
          <span className="text-3xl text-foreground sm:text-4xl">/10</span>
        </p>
        <p className="display mt-3 inline-block -rotate-2 rounded-xl bg-rose-500 px-4 py-1.5 text-xl uppercase text-white">{roast.title}</p>

        <ul className="mt-8 space-y-3">
          {roast.lines.map((line) => (
            <li key={line} className="flex gap-3 rounded-2xl bg-surface-2 p-4 text-base leading-relaxed sm:text-lg">
              <Flame aria-hidden className="mt-1 size-5 shrink-0 text-orange-400" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-lg font-semibold">{roast.closer}</p>

        <div className="mt-8">
          <ShareImageButton
            src={`/roast/${clean}/story`}
            fileName={`brawlzone-roast-${clean}.png`}
            kind="roast"
            label={t('Share my roast')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-brand-ink"
          />
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-4">
        <Link
          href={lp(`/player/${clean}`)}
          className="inline-flex items-center gap-2 font-semibold text-brand hover:underline"
        >
          {t('See the full profile')}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">{t('Roast another account')}</h2>
        <AccountValueForm base="/roast" cta={t('Roast me')} />
      </section>

      <p className="text-xs leading-relaxed text-muted">
        {t('A new roast every day, from the same public stats as the profile. It is a joke about the account, never about the person. Unofficial fan project, not affiliated with Supercell.')}
      </p>
    </div>
  );
}
