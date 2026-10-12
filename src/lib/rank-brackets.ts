/**
 * Ranked brackets: which part of the ladder a tier list describes.
 *
 * The meta moves with rank. What wins in a Diamond lobby -- where drafts are
 * loose and a brawler's floor matters more than its ceiling -- is not what
 * wins in Masters, and a single list built mostly from leaderboard players
 * (which is what the sampler produced: ~90% Mythic and above) is accurate for
 * them and wrong for everyone else.
 *
 * Four brackets, not eight leagues, because each one needs enough battles of
 * its own to rate ninety-odd brawlers on, and Bronze through Gold lobbies are
 * too few in the sample (and too similar) to stand alone.
 *
 * A battle's bracket is its **lobby's** rank, measured in the match itself:
 * the battle log gives every player's rank at that moment (the `trophies`
 * field of each brawler, 1-22, in a Ranked battle). Not the sampled player's
 * current or best rank, which after a season reset says where they were, not
 * whom they were playing.
 *
 * Client-safe: no data access.
 */

export interface RankBracket {
  /** Stored in `battle_daily_stats.rank_bracket`. Never renumber. */
  id: 1 | 2 | 3 | 4;
  /** The URL segment: /tier-list/ranked/rank/<slug>. */
  slug: string;
  label: string;
  /** Short form for chips. */
  short: string;
  /** Inclusive range of the game's 22 rank tiers. */
  minTier: number;
  maxTier: number;
  /** League badge names, for the icons (see `rankedLeagueIconUrl`). */
  icon: string;
}

/*
 * The game's tiers: three per league, Pro alone at the top.
 *   Bronze 1-3, Silver 4-6, Gold 7-9, Diamond 10-12,
 *   Mythic 13-15, Legendary 16-18, Masters 19-21, Pro 22.
 */
export const RANK_BRACKETS: RankBracket[] = [
  { id: 1, slug: 'diamond', label: 'Diamond and below', short: 'Diamond ↓', minTier: 1, maxTier: 12, icon: 'Diamond' },
  { id: 2, slug: 'mythic', label: 'Mythic', short: 'Mythic', minTier: 13, maxTier: 15, icon: 'Mythic' },
  { id: 3, slug: 'legendary', label: 'Legendary', short: 'Legendary', minTier: 16, maxTier: 18, icon: 'Legendary' },
  { id: 4, slug: 'masters', label: 'Masters to Pro', short: 'Masters+', minTier: 19, maxTier: 22, icon: 'Masters' },
];

export function bracketBySlug(slug: string | null | undefined): RankBracket | null {
  return RANK_BRACKETS.find((b) => b.slug === slug) ?? null;
}

export function bracketById(id: number | null | undefined): RankBracket | null {
  return RANK_BRACKETS.find((b) => b.id === id) ?? null;
}

/** The bracket a 1-22 rank tier falls in, or null for anything else. */
export function bracketForTier(tier: number | null | undefined): RankBracket | null {
  if (typeof tier !== 'number' || !Number.isInteger(tier) || tier < 1 || tier > 22) return null;
  return RANK_BRACKETS.find((b) => tier >= b.minTier && tier <= b.maxTier) ?? null;
}

const LEAGUE_FIRST_TIER: Record<string, number> = {
  BRONZE: 1,
  SILVER: 4,
  GOLD: 7,
  DIAMOND: 10,
  MYTHIC: 13,
  LEGENDARY: 16,
  MASTERS: 19,
  PRO: 22,
};

/** "LEGENDARY II" -> the Legendary bracket. Null when the name is unknown. */
export function bracketForRankName(name: string | null | undefined): RankBracket | null {
  const league = name?.trim().split(/\s+/)[0]?.toUpperCase();
  return league && league in LEAGUE_FIRST_TIER ? bracketForTier(LEAGUE_FIRST_TIER[league]) : null;
}

/**
 * A lobby's rank: the median of the players' tiers, so one smurf or one
 * boosted account in six cannot move the whole match into another bracket.
 * Null when fewer than half the players report a tier.
 */
export function lobbyTier(tiers: (number | null | undefined)[], players = tiers.length): number | null {
  const valid = tiers
    .filter((t): t is number => typeof t === 'number' && Number.isInteger(t) && t >= 1 && t <= 22)
    .sort((a, b) => a - b);
  if (valid.length === 0 || valid.length * 2 < players) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 1 ? valid[mid] : Math.round((valid[mid - 1] + valid[mid]) / 2);
}

/** The league badge the game shows, from the same CDN as `rankedLeagueIconUrl`. */
export function bracketIconUrl(bracket: RankBracket): string {
  return `https://cdn.brawlify.com/ranked/regular/${bracket.icon}.png`;
}
