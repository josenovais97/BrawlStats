import Image from 'next/image';

/**
 * Real in-game artwork, used everywhere a stat refers to a game concept.
 *
 * Two sources:
 *  - `public/icons/*` for hypercharge, buffie, coins and power points, which
 *    the public asset CDN does not publish.
 *  - Brawlify's CDN (https://github.com/Brawlify/CDN) for star power, gadget
 *    and gear, where a representative asset stands in as the generic mark.
 *
 * All render with `unoptimized` because they are already small, pre-compressed
 * PNGs; running them through the image optimiser would spend Vercel quota for
 * no gain.
 */

interface IconProps {
  className?: string;
}

/** Representative CDN assets used as generic category marks. */
const GENERIC_STAR_POWER =
  'https://cdn.brawlify.com/star-powers/borderless/23000076.png';
const GENERIC_GADGET = 'https://cdn.brawlify.com/gadgets/borderless/23000255.png';
const GENERIC_GEAR = 'https://cdn.brawlify.com/gears/regular/62000000.png';

function GameIcon({
  src,
  alt,
  className = 'size-5',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={64}
      height={64}
      className={`${className} object-contain`}
      unoptimized
    />
  );
}

export function HyperchargeIcon({ className }: IconProps) {
  return <GameIcon src="/icons/hypercharge.png" alt="Hypercharge" className={className} />;
}

export function BuffieIcon({ className }: IconProps) {
  return <GameIcon src="/icons/buffie.png" alt="Buffie" className={className} />;
}

export function CoinIcon({ className }: IconProps) {
  return <GameIcon src="/icons/coin.png" alt="Coins" className={className} />;
}

export function PowerPointIcon({ className }: IconProps) {
  return <GameIcon src="/icons/power-point.png" alt="Power points" className={className} />;
}

export function StarPowerIcon({ className }: IconProps) {
  return <GameIcon src={GENERIC_STAR_POWER} alt="Star power" className={className} />;
}

export function GadgetIcon({ className }: IconProps) {
  return <GameIcon src={GENERIC_GADGET} alt="Gadget" className={className} />;
}

export function GearIcon({ className }: IconProps) {
  return <GameIcon src={GENERIC_GEAR} alt="Gear" className={className} />;
}

/**
 * Trophy. Brawlify's CDN has no standalone trophy asset, so this stays drawn —
 * it is a simple enough shape to match the rest without looking out of place.
 */
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
