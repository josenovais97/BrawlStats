import { ImageResponse } from "next/og";

import { brawlerPortraitUrl, getBrawler } from "@/lib/brawlapi";
import { getBrawlerCatalog } from "@/lib/brawler-catalog";
import { slugify } from "@/lib/slugs";
import { formatPercent } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";
import {
  MIN_SAMPLE_FOR_TIER,
  assignTier,
  getBrawlerStat,
  normalizeWinRate,
} from "@/lib/stats";

/**
 * Share card for a brawler page.
 *
 * Brawler links are the ones that get pasted into Discord, and until now they
 * unfurled as the site default — the same card for all hundred-odd of them.
 * Built with Satori, so this is flexbox and a subset of CSS only: no grid, no
 * custom properties, no Tailwind.
 */

export const alt = "Brawl Stars brawler stats";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Matches the page it represents, so a shared card is never wildly stale. */
export const revalidate = 3600;

/* Runtime ISR, for the same reason as the page. See its `generateStaticParams`. */
export async function generateStaticParams() {
  return [];
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  /* The route accepts both forms, so the image does too: a numeric path is
     still live until search engines have followed the redirect. */
  const catalog = await getBrawlerCatalog().catch(() => null);
  const brawlerId = Number.isFinite(Number(slug))
    ? Number(slug)
    : (catalog?.bySlug.get(slugify(slug))?.id ?? Number.NaN);
  const brawler = await getBrawler(brawlerId).catch(() => undefined);

  if (!brawler) return fallback();

  const accent = brawler.rarity?.color ?? "#8b95b8";
  const stat = await getBrawlerStat(brawlerId);
  const adjusted = stat
    ? normalizeWinRate(
        stat.winRate,
        stat.baselineWinRate,
        stat.decidedSampleSize,
      )
    : null;
  const tier =
    stat && stat.decidedSampleSize >= MIN_SAMPLE_FOR_TIER
      ? assignTier(adjusted)
      : null;

  // A card promising numbers it does not have is worse than one that leads
  // with the brawler, so the stat row only appears once there is a stat.
  const stats: [string, string][] = stat
    ? [
        ["Win rate", formatPercent(adjusted)],
        ["Pick rate", formatPercent(stat.usageRate)],
        ["Tier", tier ?? "–"],
      ]
    : [];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#0b0f1d",
        color: "#f2f5ff",
        fontFamily: "sans-serif",
      }}
    >
      {/* The rarity colour, the same wash the page header uses. Linear
            rather than radial: Satori has no radial-gradient. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          background: `linear-gradient(125deg, ${accent} 0%, transparent 62%)`,
          opacity: 0.22,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <img
          src={brawlerPortraitUrl(brawler.id)}
          alt=""
          width={196}
          height={196}
          style={{ borderRadius: 32, background: "#1b2136" }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              letterSpacing: -1,
              color: accent,
              lineHeight: 1.05,
            }}
          >
            {brawler.name}
          </div>
          {/* One interpolation, not two: Satori requires an explicit display
                on any element with more than one child node. */}
          <div style={{ fontSize: 32, color: "#8b95b8", marginTop: 10 }}>
            {`${brawler.rarity?.name ?? "Brawler"}  ·  ${brawler.class?.name ?? "Brawl Stars"}`}
          </div>
        </div>
      </div>

      {stats.length > 0 ? (
        <div style={{ display: "flex", gap: 20 }}>
          {stats.map(([label, value]) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "24px 28px",
                borderRadius: 20,
                background: "#151a2e",
                border: "1px solid #242b45",
              }}
            >
              <div style={{ fontSize: 24, color: "#8b95b8" }}>{label}</div>
              <div style={{ fontSize: 48, fontWeight: 900, marginTop: 6 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", fontSize: 30, color: "#8b95b8" }}>
          Star powers, gadgets, gears and the most popular build
        </div>
      )}

      <div
        style={{
          display: "flex",
          fontSize: 28,
          fontWeight: 700,
          color: "#ffc53d",
          letterSpacing: 2,
        }}
      >
        {SITE_NAME.toUpperCase()}
      </div>
    </div>,
    size,
  );
}

function fallback() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0f1d",
        color: "#ffc53d",
        fontSize: 64,
        fontWeight: 900,
        letterSpacing: 2,
        fontFamily: "sans-serif",
      }}
    >
      {SITE_NAME.toUpperCase()}
    </div>,
    size,
  );
}
