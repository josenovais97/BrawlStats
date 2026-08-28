import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd, breadcrumbSchema } from "@/components/seo/structured-data";
import { PageHeading, SectionHeading } from "@/components/ui/section-heading";
import { formatNumber, formatPercent } from "@/lib/format";
import { getIconCatalogue, getSkinCatalogue } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Brawl Stars cosmetics: which skins and icons players actually use",
  description:
    "Every skin and profile icon seen in the sampled player pool, ranked by how many people equip it. Not a list of what exists, a measurement of what gets worn.",
  alternates: { canonical: "/cosmetics" },
};

/*
 * Matches READ_CACHE_SECONDS. Declaring longer would achieve nothing: a
 * route's revalidate is the shortest-lived cache inside it, and both reads
 * below are cached for two hours.
 */
export const revalidate = 7200;

/**
 * What people actually wear.
 *
 * Every wiki lists every skin. None of them can say whether anyone uses it,
 * because that needs a sample of real accounts — which is the one thing this
 * project has been collecting all along and only ever showed as a top-twenty
 * board.
 *
 * Limited to skins and profile icons because those are the only cosmetics the
 * player API reports. Pins, sprays, titles and battle cards are documented on
 * the wiki and absent from every payload, so a catalogue of them here would be
 * a copy of the wiki with no number attached — which is worth nothing to
 * anyone who could already read the wiki.
 */
export default async function CosmeticsPage() {
  const [skins, icons] = await Promise.all([
    getSkinCatalogue(),
    getIconCatalogue(),
  ]);

  const topSkins = skins.slice(0, 8);

  return (
    <div className="space-y-10">
      <JsonLd
        data={breadcrumbSchema([{ name: "Cosmetics", path: "/cosmetics" }])}
      />

      <PageHeading
        title="Cosmetics"
        subtitle="Which skins and profile icons players actually equip, measured from the sampled pool rather than listed from a catalogue."
      />

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/cosmetics/skins"
          className="card card-interactive block p-5 transition-colors hover:border-brand/50"
        >
          <p className="display text-lg uppercase">Skins</p>
          <p className="mt-1 text-sm text-muted">
            {formatNumber(skins.length)} seen across the roster, ranked by how
            many of the sampled slots wear each one.
          </p>
          <p className="mt-3 text-sm font-semibold text-brand">
            Browse every skin &rarr;
          </p>
        </Link>

        <Link
          href="/cosmetics/icons"
          className="card card-interactive block p-5 transition-colors hover:border-brand/50"
        >
          <p className="display text-lg uppercase">Profile icons</p>
          <p className="mt-1 text-sm text-muted">
            {formatNumber(icons.length)} seen on sampled accounts. The icon sits
            on the account, so these are shares of players rather than of
            brawlers.
          </p>
          <p className="mt-3 text-sm font-semibold text-brand">
            Browse every icon &rarr;
          </p>
        </Link>
      </section>

      {topSkins.length > 0 ? (
        <section>
          <SectionHeading
            title="Most worn skins"
            subtitle="Share of every sampled player-brawler slot, so skins on different brawlers are directly comparable."
          />
          <ol className="card divide-y divide-border overflow-hidden">
            {topSkins.map((skin, index) => (
              <li key={skin.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold capitalize">
                    {skin.name.toLowerCase()}
                  </span>
                  <span className="block text-xs capitalize text-muted">
                    {(skin.brawlerName ?? "").toLowerCase()}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {formatPercent(skin.share)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section>
        <SectionHeading title="How this is counted" />
        <div className="card space-y-3 p-5 text-sm leading-relaxed text-muted">
          <p>
            Numbers come from the rotating snapshot sample, which records a
            quarter of the sampled player pool each day, so this is a survey
            rather than a census. That is enough for shares, which is all it
            reports, and it is why a number here is never a count of how many
            people own something in the game.
          </p>
          <p>
            A skin&rsquo;s share is of sampled player-brawler slots; an
            icon&rsquo;s is of sampled players. Default skins are left out — the
            one carrying the brawler&rsquo;s own name is not something anyone
            chose. Per-brawler adoption, including the default, is on each
            brawler&rsquo;s own page.
          </p>
        </div>
      </section>
    </div>
  );
}
