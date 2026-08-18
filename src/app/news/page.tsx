import type { Metadata } from 'next';
import { Cog, ExternalLink, Minus, Sparkles, Star, Wrench, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { getBrawlerMap } from '@/lib/brawlapi';
import { getOfficialNews } from '@/lib/news';
import { hasDatabase } from '@/lib/prisma';
import { getCatalogChanges } from '@/lib/stats';
import type { CatalogChangeEntry } from '@/types/stats';

export const metadata: Metadata = {
  title: 'News',
  description:
    'Official Brawl Stars announcements, plus roster and kit changes detected from the game API.',
};

export const revalidate = 3600;

/** "2026-08-10T14:00:00.000+02:00" -> "10 Aug 2026" */
function formatNewsDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function UpdatesPage() {
  // Artwork (HTTP) overlaps with the database work, but the database reads run
  // one after another so the page never needs more than one connection.
  const [brawlerMeta, news] = await Promise.all([
    getBrawlerMap().catch(() => new Map()),
    getOfficialNews(6),
  ]);
  const changes = await getCatalogChanges(40);

  const iconFor = (id: number) => brawlerMeta.get(id)?.imageUrl;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">News</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Announcements from the Brawl Stars team, and the new brawlers and abilities
          detected from the game API. For how the sampled meta is shifting, see the{' '}
          <Link href="/tier-list/ranked" className="font-medium text-brand hover:underline">
            Ranked tier list
          </Link>
          .
        </p>
      </header>

      {news.length > 0 ? (
        <section>
          <h2 className="mb-1 text-2xl font-bold tracking-tight">Official news</h2>
          <p className="mb-4 text-sm text-muted">Straight from the Brawl Stars team.</p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((post) => (
              <a
                key={post.url}
                href={post.url}
                target="_blank"
                rel="noreferrer"
                className="card card-interactive group overflow-hidden"
              >
                {post.imageUrl ? (
                  <Image
                    src={post.imageUrl}
                    alt=""
                    width={400}
                    height={222}
                    className="aspect-[16/9] w-full bg-surface-2 object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="aspect-[16/9] w-full bg-surface-2" />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {post.category ? (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-brand">
                        {post.category}
                      </span>
                    ) : null}
                    {post.publishedAt ? <span>{formatNewsDate(post.publishedAt)}</span> : null}
                  </div>
                  <p className="mt-2 line-clamp-2 font-semibold leading-snug group-hover:text-brand">
                    {post.title}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
                    Read on supercell.com
                    <ExternalLink className="size-3" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-1 text-2xl font-bold tracking-tight">Detected game changes</h2>
        <p className="mb-4 text-sm text-muted">
          New brawlers, star powers, gadgets and hypercharges.
        </p>

        {changes.length === 0 ? (
          <EmptyNote
            configured={hasDatabase()}
            what="No changes detected yet."
          />
        ) : (
          <ol className="space-y-2">
            {changes.map((change) => (
              <li key={change.id}>
                <ChangeRow change={change} imageUrl={iconFor(change.brawlerId)} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

const CHANGE_META: Record<
  string,
  { icon: typeof Star; label: string; tone: string; verb: string }
> = {
  brawlerAdded: {
    icon: Star,
    label: 'New brawler',
    tone: 'text-brand',
    verb: 'released',
  },
  starPowerAdded: {
    icon: Sparkles,
    label: 'Star power',
    tone: 'text-brand',
    verb: 'added to',
  },
  gadgetAdded: { icon: Wrench, label: 'Gadget', tone: 'text-accent', verb: 'added to' },
  hyperchargeAdded: {
    icon: Zap,
    label: 'Hypercharge',
    tone: 'text-defeat',
    verb: 'added to',
  },
  gearAdded: { icon: Cog, label: 'Gear', tone: 'text-muted', verb: 'added to' },
  abilityRemoved: { icon: Minus, label: 'Removed', tone: 'text-muted', verb: 'removed from' },
  brawlerRemoved: {
    icon: Minus,
    label: 'Brawler removed',
    tone: 'text-muted',
    verb: 'removed',
  },
};

function ChangeRow({
  change,
  imageUrl,
}: {
  change: CatalogChangeEntry;
  imageUrl?: string;
}) {
  const meta = CHANGE_META[change.kind] ?? {
    icon: Star,
    label: 'Change',
    tone: 'text-muted',
    verb: 'changed on',
  };
  const Icon = meta.icon;

  return (
    <Link
      href={`/brawlers/${change.brawlerId}`}
      className="card card-interactive flex items-center gap-3 p-3"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0"
          unoptimized
        />
      ) : (
        <span className="size-10 shrink-0 rounded-lg bg-surface-2" />
      )}

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold ${meta.tone}`}
          >
            <Icon className="size-3" />
            {meta.label}
          </span>
          <span className="truncate text-sm font-medium capitalize">
            {change.itemName
              ? `${change.itemName.toLowerCase()} ${meta.verb} ${change.brawlerName.toLowerCase()}`
              : `${change.brawlerName.toLowerCase()} ${meta.verb}`}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-muted">Detected {change.detectedOn}</p>
      </div>
    </Link>
  );
}

function EmptyNote({ configured, what }: { configured: boolean; what: string }) {
  return (
    <p className="card p-6 text-sm text-muted">
{configured ? what : 'Not available right now.'}
    </p>
  );
}
