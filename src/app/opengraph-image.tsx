import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/site";

/**
 * Default share card for every route that does not supply its own.
 *
 * Only player profiles had one, so every tier list, leaderboard and brawler
 * page unfurled as a bare link. This inherits down the whole tree, so one file
 * covers the rest of the site.
 *
 * Satori, not a browser: flexbox only, and any element with more than one child
 * needs an explicit `display`. There is no radial-gradient and no blur either,
 * which is why the wash below is linear.
 */

export const alt = "BrawlZone, Brawl Stars stats, tier lists and leaderboards";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const points = [
    "Skill score out of 10",
    "Ranked + trophy tier lists",
    "Ranked elo leaderboard",
  ];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#0b0f1d",
        color: "#f2f5ff",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          background: "linear-gradient(125deg, #8b6bff 0%, transparent 58%)",
          opacity: 0.22,
        }}
      />

      <div
        style={{
          display: "flex",
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: 3,
          color: "#ffc53d",
        }}
      >
        {SITE_NAME.toUpperCase()}
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 82,
          fontWeight: 900,
          lineHeight: 1.08,
          letterSpacing: -1.5,
          marginTop: 18,
          maxWidth: 900,
        }}
      >
        Know exactly where you stand
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 32,
          color: "#8b95b8",
          marginTop: 22,
          maxWidth: 880,
        }}
      >
        Brawl Stars stats the game does not give you.
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 44 }}>
        {points.map((point) => (
          <div
            key={point}
            style={{
              display: "flex",
              padding: "16px 24px",
              borderRadius: 16,
              background: "#151a2e",
              border: "1px solid #242b45",
              fontSize: 26,
              color: "#f2f5ff",
            }}
          >
            {point}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
