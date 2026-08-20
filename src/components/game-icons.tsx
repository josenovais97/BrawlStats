import Image from 'next/image';

import { prestigeTier } from '@/lib/prestige';

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

/** Duo showdown. */
export function DuoShowdownIcon({ className }: IconProps) {
  return (
    <GameIcon src="/icons/duo-showdown.png" alt="Duo showdown" className={className} />
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

/** Skins. */
export function SkinsIcon({ className }: IconProps) {
  return <GameIcon src="/icons/skins.png" alt="Skins" className={className} />;
}

/** Club badge placeholder. */
export function ClubIcon({ className }: IconProps) {
  return <GameIcon src="/icons/club.png" alt="Club" className={className} />;
}

/** Time played. */
export function ClockIcon({ className }: IconProps) {
  return <GameIcon src="/icons/clock.png" alt="Time played" className={className} />;
}

/** Win streak. */
export function WinStreakIcon({ className }: IconProps) {
  return <GameIcon src="/icons/win-streak.png" alt="Win streak" className={className} />;
}

/** Robo Rumble. */
export function RoboRumbleIcon({ className }: IconProps) {
  return <GameIcon src="/icons/robo-rumble.png" alt="Robo Rumble" className={className} />;
}

/** Battles played. */
export function BattlesIcon({ className }: IconProps) {
  return <GameIcon src="/icons/battles.png" alt="Battles" className={className} />;
}

/** Ranked. */
export function RankedIcon({ className }: IconProps) {
  return <GameIcon src="/icons/ranked.png" alt="Ranked" className={className} />;
}

/** Leaderboards. */
export function LeaderboardIcon({ className }: IconProps) {
  return <GameIcon src="/icons/leaderboard.png" alt="Leaderboard" className={className} />;
}

/** Skins, pins and the rest of the cosmetic collection. */
export function CosmeticsIcon({ className }: IconProps) {
  return <GameIcon src="/icons/cosmetics.png" alt="Cosmetics" className={className} />;
}

/** Longest run as the Big Brawler. */
export function BigBrawlerIcon({ className }: IconProps) {
  return <GameIcon src="/icons/big-brawler.png" alt="Big Brawler" className={className} />;
}

/** A player, wherever a profile or a count of profiles is meant. */
export function PlayersIcon({ className }: IconProps) {
  return <GameIcon src="/icons/players.png" alt="Players" className={className} />;
}

/** Trophies climbing: gains, streaks and best days. */
export function TrophyGainIcon({ className }: IconProps) {
  return <GameIcon src="/icons/trophy-gain.png" alt="Trophy gain" className={className} />;
}

/** Club president, and anything else that ranks first. */
export function CrownIcon({ className }: IconProps) {
  return <GameIcon src="/icons/crown.png" alt="President" className={className} />;
}

/**
 * Prestige badge for a total prestige level.
 *
 * The milestone lives in `lib/prestige` rather than here: it is arithmetic
 * with boundaries worth testing, and a component file that imports
 * `next/image` cannot be loaded by the test runner.
 */
export function PrestigeIcon({
  total,
  className,
}: IconProps & { total: number | undefined | null }) {
  const tier = prestigeTier(total);
  if (tier === null) return null;
  return (
    <GameIcon src={`/icons/prestige-${tier}.png`} alt="Prestige" className={className} />
  );
}
