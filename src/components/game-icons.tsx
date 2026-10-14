import Image from 'next/image';

import { prestigeTier } from '@/lib/prestige';
import { slugify } from '@/lib/slugs';
import { getUT } from '@/lib/t-universal';

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
  const t = getUT();
  return <GameIcon src="/icons/hypercharge.png" alt={t('Hypercharge')} className={className} />;
}

export function BuffieIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/buffie.png" alt={t('Buffie')} className={className} />;
}

export function CoinIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/coin.png" alt={t('Coins')} className={className} />;
}

export function StarrDropIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/starr-drop.png" alt={t('Starr Drop')} className={className} />;
}

export function PowerPointIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/power-point.png" alt={t('Power points')} className={className} />;
}

/** The in-game power 11 badge. */
export function Power11Icon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/power-11.png" alt={t('Power 11')} className={className} />;
}

export function StarPowerIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src={GENERIC_STAR_POWER} alt={t('Star power')} className={className} />;
}

export function GadgetIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src={GENERIC_GADGET} alt={t('Gadget')} className={className} />;
}

export function GearIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src={GENERIC_GEAR} alt={t('Gear')} className={className} />;
}

/** The game's own trophy asset, replacing the previously hand-drawn SVG. */
export function TrophyIcon({ className = 'size-5' }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/trophy.png" alt={t('Trophies')} className={className} />;
}

/** 3v3 victories. */
export function Battle3v3Icon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/battle-3v3.png" alt={t('3v3 wins')} className={className} />;
}

/** Solo showdown. */
export function SoloShowdownIcon({ className }: IconProps) {
  const t = getUT();
  return (
    <GameIcon src="/icons/solo-showdown.png" alt={t('Solo showdown')} className={className} />
  );
}

/** Duo showdown. */
export function DuoShowdownIcon({ className }: IconProps) {
  const t = getUT();
  return (
    <GameIcon src="/icons/duo-showdown.png" alt={t('Duo showdown')} className={className} />
  );
}

/** Brawler roster. */
export function BrawlersIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/brawlers.png" alt={t('Brawlers')} className={className} />;
}

/** Experience. */
export function ExperienceIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/experience.png" alt={t('Experience')} className={className} />;
}

/** Skins. */
export function SkinsIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/skins.png" alt={t('Skins')} className={className} />;
}

/** Club badge placeholder. */
export function ClubIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/club.png" alt={t('Club')} className={className} />;
}

/** Time played. */
export function ClockIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/clock.png" alt={t('Time played')} className={className} />;
}

/** Win streak. */
export function WinStreakIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/win-streak.png" alt={t('Win streak')} className={className} />;
}

/** Robo Rumble. */
export function RoboRumbleIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/robo-rumble.png" alt={t('Robo Rumble')} className={className} />;
}

/** Battles played. */
export function BattlesIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/battles.png" alt={t('Battles')} className={className} />;
}

/** Ranked. */
export function RankedIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/ranked.png" alt={t('Ranked')} className={className} />;
}

/** Leaderboards. */
export function LeaderboardIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/leaderboard.png" alt={t('Leaderboard')} className={className} />;
}

/** Skins, pins and the rest of the cosmetic collection. */
export function CosmeticsIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/cosmetics.png" alt={t('Cosmetics')} className={className} />;
}

/**
 * The seven brawler classes, as the game draws them.
 *
 * From the community wiki: neither the official catalogue nor the artwork
 * mirror publishes a class icon — the mirror's own `icons` endpoint is profile
 * pictures and club badges only, and every plausible CDN path for a class 404s.
 *
 * Renders nothing for an unknown class rather than a placeholder, which is the
 * same rule the class label itself follows: the artwork mirror reports
 * "Unknown" for every brawler released since Meeple, and a generic badge on a
 * fifth of the roster says less than no badge.
 */
const CLASS_ICONS = new Set([
  'artillery',
  'assassin',
  'controller',
  'damage-dealer',
  'marksman',
  'support',
  'tank',
]);

export function ClassIcon({
  name,
  className,
}: IconProps & { name: string | null | undefined }) {
  const slug = name ? slugify(name) : null;
  if (!slug || !CLASS_ICONS.has(slug)) return null;
  return <GameIcon src={`/icons/class-${slug}.png`} alt={name!} className={className} />;
}

/**
 * The game's own combat-stat marks, from the brawler info screen.
 *
 * Colour is the categorisation and it is the game's, not ours: red for what
 * the brawler does with its main attack, green for what keeps it alive and
 * moving, gold for the Super. That is why they are worth using over a set of
 * neutral glyphs — the grid groups itself before a single label is read.
 */
export type CombatStat =
  | 'health'
  | 'damage'
  | 'super-damage'
  | 'cooldown'
  | 'ranged'
  | 'speed'
  | 'super-cooldown';

export function CombatStatIcon({
  stat,
  className,
}: IconProps & { stat: CombatStat }) {
  /* Empty alt: the stat's label sits right beside it, and announcing both
     reads the same thing twice. */
  return <GameIcon src={`/icons/stat-${stat}.png`} alt="" className={className} />;
}

/** The tier lists. */
export function TierListIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/tier-list.png" alt={t('Tier list')} className={className} />;
}

/** The draft helper. */
export function DraftIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/draft.png" alt={t('Draft')} className={className} />;
}

/**
 * The Android app.
 *
 * The site's own mark rather than a game entity, because there is no Brawl
 * Stars icon for "an app that floats over Brawl Stars". It is the same speech
 * bubble the launcher icon and the overlay itself use, so the nav entry, the
 * install and the thing on your screen are all visibly one product.
 */
export function BubbleAppIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/bubble-app.png" alt={t('Android app')} className={className} />;
}

/** Head-to-head comparison. */
export function CompareIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/compare.png" alt={t('Compare')} className={className} />;
}

/**
 * Official Brawl Stars news posts, and the update notes behind them.
 *
 * Sourced from the wiki rather than the CDN, which publishes only game
 * entities — brawlers, maps, gadgets — and nothing for the parts of the site
 * that are about the game rather than in it. These two were the last nav
 * entries still drawing a generic line icon, which reads as a hole in a menu
 * where everything else is game art.
 */
export function NewsIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/news.png" alt={t('News')} className={className} />;
}

export function ReleaseNotesIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/release-notes.png" alt={t('Release notes')} className={className} />;
}

/**
 * The daily challenge.
 *
 * The game's own Daily Quest mark, from the wiki rather than the CDN — the
 * same reasoning as News and Release Notes above. The CDN publishes game
 * *entities*, so there is nothing in it for "a puzzle that resets at
 * midnight", and every other candidate in this file was already spoken for:
 * the Starr Drop belongs to /starr-drops and the tier-list mark to two
 * tier-list pages. A menu where three entries share one icon is a menu you
 * cannot scan.
 */
export function DailyChallengeIcon({ className }: IconProps) {
  const t = getUT();
  return (
    <GameIcon src="/icons/daily-challenge.png" alt={t('Daily challenge')} className={className} />
  );
}

/** The live event rotation. */
export function EventsIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/events.png" alt={t('Events')} className={className} />;
}

/** The map catalogue. */
export function MapsIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/maps.png" alt={t('Maps')} className={className} />;
}

/** Longest run as the Big Brawler. */
export function BigBrawlerIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/big-brawler.png" alt={t('Big Brawler')} className={className} />;
}

/** A player, wherever a profile or a count of profiles is meant. */
export function PlayersIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/players.png" alt={t('Players')} className={className} />;
}

/** Trophies climbing: gains, streaks and best days. */
export function TrophyGainIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/trophy-gain.png" alt={t('Trophy gain')} className={className} />;
}

/** Club president, and anything else that ranks first. */
export function CrownIcon({ className }: IconProps) {
  const t = getUT();
  return <GameIcon src="/icons/crown.png" alt={t('President')} className={className} />;
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
  const t = getUT();
  const tier = prestigeTier(total);
  if (tier === null) return null;
  return (
    <GameIcon src={`/icons/prestige-${tier}.png`} alt={t('Prestige')} className={className} />
  );
}
