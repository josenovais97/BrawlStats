/**
 * The site's star-and-chart mark, kept in sync with `src/app/icon.svg`.
 *
 * Inlined as a component rather than loaded as an image so it renders at any
 * size without a network request and can inherit sizing from Tailwind classes.
 */
export function BrandMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="BrawlStats"
      fill="none"
    >
      <defs>
        <linearGradient id="brandmark-star" x1="0.15" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#FFDC6B" />
          <stop offset="0.5" stopColor="#FBC02D" />
          <stop offset="1" stopColor="#EF9F1C" />
        </linearGradient>
      </defs>

      <path
        d="M 25.50,3.00 L 33.25,12.08 L 44.99,14.25 L 41.00,25.50 L 44.99,36.75 L 33.25,38.92 L 25.50,48.00 L 17.75,38.92 L 6.01,36.75 L 10.00,25.50 L 6.01,14.25 L 17.75,12.08 Z"
        fill="url(#brandmark-star)"
        stroke="#14365F"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      <rect x="31" y="32" width="29" height="28" rx="7" fill="#14365F" />
      <rect x="36" y="48.6" width="6.2" height="7.4" rx="1.5" fill="#FFFFFF" />
      <rect x="43.9" y="44" width="6.2" height="12" rx="1.5" fill="#FFFFFF" />
      <rect x="51.8" y="39.4" width="6.2" height="16.6" rx="1.5" fill="#FFFFFF" />

      <path
        d="M36.0,45.6 L43.2,38.8 L47.4,42.6 L55.0,35.4 M55.0,35.4 L49.8,35.7 M55.0,35.4 L54.8,40.6"
        stroke="#6DBE72"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
