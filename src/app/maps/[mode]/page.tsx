import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MapPickList } from "@/components/maps/map-pick-list";
import {
  JsonLd,
  breadcrumbSchema,
  itemListSchema,
} from "@/components/seo/structured-data";
import { PageHeading, SectionHeading } from "@/components/ui/section-heading";
import { getBrawlerMap } from "@/lib/brawlapi";
import { formatNumber } from "@/lib/format";
import { getActiveMaps } from "@/lib/game-maps";
import { slugify } from "@/lib/slugs";
import { getBestPicksByMode } from "@/lib/stats";
import type { BABrawler } from "@/types/brawlapi";

interface PageProps {
  params: Promise<{ mode: string }>;
}

export const revalidate = 3600;

/* Runtime ISR. See `/brawlers/[slug]` for why the empty array is required. */
export async function generateStaticParams() {
  return [];
}

/** Resolves the mode slug against the modes that actually have active maps. */
async function resolveMode(slug: string) {
  const maps = await getActiveMaps().catch(() => []);
  const wanted = slugify(slug);
  const inMode = maps.filter((entry) => entry.modeSlug === wanted);
  if (inMode.length === 0) return null;

  const first = inMode[0];
  return {
    slug: wanted,
    label: first.mode?.name ?? first.map.gameMode.name,
    color: first.mode?.color ?? "#8b95b8",
    imageUrl: first.mode?.imageUrl,
    description:
      first.mode?.shortDescription ?? first.mode?.description ?? null,
    scHash: first.scHash,
    maps: inMode,
  };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { mode } = await params;
  const resolved = await resolveMode(mode);
  if (!resolved) return { title: "Mode" };

  return {
    title: `${resolved.label} maps and best brawlers`,
    description: `Every Brawl Stars ${resolved.label} map in rotation, plus the brawlers with the best records in the mode, ranked from sampled battles.`,
    alternates: { canonical: `/maps/${resolved.slug}` },
  };
}

export default async function ModeMapsPage({ params }: PageProps) {
  const { mode } = await params;
  const resolved = await resolveMode(mode);
  if (!resolved) notFound();

  const brawlerMeta = await getBrawlerMap().catch(
    () => new Map<number, BABrawler>(),
  );
  const picks = resolved.scHash
    ? await getBestPicksByMode(8)
        .then((byMode) => byMode.get(resolved.scHash!) ?? null)
        .catch(() => null)
    : null;

  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: "Maps", path: "/maps" },
          { name: resolved.label, path: `/maps/${resolved.slug}` },
        ])}
      />
      <JsonLd
        data={itemListSchema(
          `${resolved.label} maps`,
          `Active Brawl Stars ${resolved.label} maps.`,
          resolved.maps.map((entry) => ({
            name: entry.map.name,
            path: `/maps/${entry.modeSlug}/${entry.mapSlug}`,
          })),
        )}
      />

      <Link
        href="/maps"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All maps
      </Link>

      <PageHeading
        title={resolved.label}
        subtitle={
          resolved.description ??
          `Every ${resolved.label} map currently in rotation, and the brawlers with the best records in the mode.`
        }
        aside={
          resolved.imageUrl ? (
            <Image
              src={resolved.imageUrl}
              alt=""
              width={56}
              height={56}
              className="size-14 object-contain"
              unoptimized
            />
          ) : null
        }
      />

      {picks && picks.picks.length > 0 ? (
        <section>
          <SectionHeading
            title={`Best brawlers in ${resolved.label}`}
            subtitle={`From ${formatNumber(picks.sampleSize)} sampled decided battles in this mode, scored against the mode's own average.`}
          />
          <MapPickList
            picks={picks.picks}
            brawlerMeta={brawlerMeta}
            emptyLabel="Not enough sampled battles in this mode yet."
          />
        </section>
      ) : null}

      <section>
        <SectionHeading
          title="Maps in rotation"
          aside={`${resolved.maps.length} maps`}
        />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {resolved.maps.map((entry) => (
            <li key={entry.map.id}>
              <Link
                href={`/maps/${entry.modeSlug}/${entry.mapSlug}`}
                className="card card-interactive block h-full overflow-hidden"
              >
                {entry.map.imageUrl ? (
                  <Image
                    src={entry.map.imageUrl}
                    alt=""
                    width={160}
                    height={100}
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
                    className="h-24 w-full bg-surface-2 object-contain p-1"
                    loading="lazy"
                    unoptimized
                  />
                ) : (
                  <div className="h-24 w-full bg-surface-2" />
                )}
                <span className="block truncate px-3 py-2 text-sm font-semibold">
                  {entry.map.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
