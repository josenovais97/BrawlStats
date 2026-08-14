/**
 * Game-flavoured icons for things the public asset CDN does not publish.
 *
 * Brawlify's CDN covers brawlers, star powers, gadgets, gears, ranked tiers,
 * prestiges and profile icons — those are used directly as images elsewhere.
 * It has nothing for hypercharge, buffies or the currencies, so these are
 * drawn here in the same visual language rather than shipping a generic glyph
 * or hotlinking assets from someone's site.
 *
 * Each takes a className so it can be sized like any other icon.
 */

interface IconProps {
  className?: string;
}

/** Hypercharge: the lightning bolt in its charged ring. */
export function HyperchargeIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Hypercharge">
      <defs>
        <linearGradient id="hc-grad" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#8ef6ff" />
          <stop offset="0.5" stopColor="#39c9f5" />
          <stop offset="1" stopColor="#9d5cff" />
        </linearGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="url(#hc-grad)"
        strokeWidth="2"
        opacity="0.55"
      />
      <path
        d="M13.4 2.6 6.2 13.2h4.3l-1 8.2 7.4-10.8h-4.4z"
        fill="url(#hc-grad)"
        stroke="#0b1020"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Buffie: a small companion orb with a plus, matching the in-game framing. */
export function BuffieIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Buffie">
      <defs>
        <radialGradient id="buffie-grad" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffe6a3" />
          <stop offset="0.55" stopColor="#ff9bd2" />
          <stop offset="1" stopColor="#a054ff" />
        </radialGradient>
      </defs>
      <circle
        cx="12"
        cy="12.6"
        r="8.4"
        fill="url(#buffie-grad)"
        stroke="#0b1020"
        strokeWidth="1.4"
      />
      <circle cx="9.2" cy="9.6" r="1.9" fill="#ffffff" opacity="0.75" />
      <path
        d="M12 8.6v8M8 12.6h8"
        stroke="#0b1020"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}

/** Coin: the gold currency. */
export function CoinIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Coins">
      <defs>
        <linearGradient id="coin-grad" x1="0.2" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="0.55" stopColor="#f7c948" />
          <stop offset="1" stopColor="#e09b16" />
        </linearGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="url(#coin-grad)"
        stroke="#7a4c06"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="5.8" fill="none" stroke="#c98a10" strokeWidth="1.2" />
      <path
        d="M12 8.4c-1.7 0-2.7.9-2.7 2s.9 1.6 2.7 2 2.7.9 2.7 2-1 2-2.7 2m0-8v8m0-8V7m0 9.4v1.2"
        fill="none"
        stroke="#7a4c06"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Power point: the blue upgrade currency. */
export function PowerPointIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Power points">
      <defs>
        <linearGradient id="pp-grad" x1="0.2" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#a5e5ff" />
          <stop offset="0.55" stopColor="#3fa9f5" />
          <stop offset="1" stopColor="#1c62c9" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5 21 8v8l-9 5.5L3 16V8z"
        fill="url(#pp-grad)"
        stroke="#0d3a70"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M12.9 6.8 8.4 13.3h3l-.6 4.6 4.7-6.9h-3z"
        fill="#ffffff"
        opacity="0.9"
      />
    </svg>
  );
}

/** Trophy, used where the road/ranking context wants a game-styled mark. */
export function TrophyIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Trophies">
      <defs>
        <linearGradient id="trophy-grad" x1="0.2" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="0.6" stopColor="#f7c948" />
          <stop offset="1" stopColor="#dd9412" />
        </linearGradient>
      </defs>
      <path
        d="M7 3.5h10v4a5 5 0 0 1-10 0z"
        fill="url(#trophy-grad)"
        stroke="#7a4c06"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M7 5H4.6v1.6A3.4 3.4 0 0 0 7.6 10M17 5h2.4v1.6A3.4 3.4 0 0 1 16.4 10"
        fill="none"
        stroke="#7a4c06"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M10.4 12.4h3.2l.5 3.6h-4.2z"
        fill="url(#trophy-grad)"
        stroke="#7a4c06"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect
        x="7.4"
        y="16"
        width="9.2"
        height="3.4"
        rx="1.2"
        fill="url(#trophy-grad)"
        stroke="#7a4c06"
        strokeWidth="1.3"
      />
    </svg>
  );
}
