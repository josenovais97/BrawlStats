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

/** The in-game power 11 badge. */
export function Power11Icon({ className }: IconProps) {
  return <GameIcon src="/icons/power-11.png" alt="Power 11" className={className} />;
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

/** The game's own trophy asset, replacing the previously hand-drawn SVG. */
export function TrophyIcon({ className = 'size-5' }: IconProps) {
  return <GameIcon src="/icons/trophy.png" alt="Trophies" className={className} />;
}

/** 3v3 victories. */
export function Battle3v3Icon({ className }: IconProps) {
  return <GameIcon src="/icons/battle-3v3.png" alt="3v3 wins" className={className} />;
}

/** Solo showdown. */
export function SoloShowdownIcon({ className }: IconProps) {
  return (
    <GameIcon src="/icons/solo-showdown.png" alt="Solo showdown" className={className} />
  );
}

/** Brawler roster. */
export function BrawlersIcon({ className }: IconProps) {
  return <GameIcon src="/icons/brawlers.png" alt="Brawlers" className={className} />;
}

/** Experience. */
export function ExperienceIcon({ className }: IconProps) {
  return <GameIcon src="/icons/experience.png" alt="Experience" className={className} />;
}

/** Club badge placeholder. */
export function ClubIcon({ className }: IconProps) {
  return <GameIcon src="/icons/club.png" alt="Club" className={className} />;
}
