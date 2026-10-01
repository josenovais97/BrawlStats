/**
 * What a club can field, between them and one by one.
 *
 * The club page has always been the game's own payload rendered back: thirty
 * names, their trophies, and who is president. Every one of those numbers is
 * already in the game, two taps from where the reader is standing.
 *
 * This is the part only this site can say. The roster strength of a club is not
 * the sum of its trophies — it is which of the brawlers that actually win right
 * now the club can put on the field, and that is a question about thirty
 * rosters read against the Ranked tier list.
 *
 * The union is the headline deliberately. "Between them" is the number that
 * belongs to the club rather than to its best player, and it is the one a club
 * argues about: a club at 91% with one member carrying it is a different club
 * from one at 91% evenly.
 *
 * Pure, so the arithmetic can be tested without thirty API calls behind it.
 */

export interface ScannedMember {
  tag: string;
  name: string;
  trophies: number;
  roster: Array<{ id: number; power: number; hypercharge: boolean }>;
}

export interface MemberStanding {
  tag: string;
  name: string;
  trophies: number;
  /** Share of the top tier this member alone can field, 0-1. */
  coverage: number;
  /**
   * The same share, hypercharged.
   *
   * Coverage alone saturates, and it saturates on exactly the clubs most worth
   * reading: measured against the top global club, all thirty members sat at
   * 100% and the board collapsed into the trophy order it exists not to be.
   * Any serious account owns the fourteen brawlers in S and A at power nine.
   *
   * Hypercharges do not work that way. They come out of drops rather than
   * coins, so no amount of play guarantees them and even a maxed roster is
   * missing most — which makes this the number that still separates two good
   * players, and the one worth arguing about.
   */
  hyperCoverage: number;
  powerEleven: number;
  /**
   * Top-tier brawlers only this member can field.
   *
   * The reason the board is worth reading past the first row: a player at 40%
   * who is the only one holding a key pick matters more to the club than one at
   * 60% who duplicates everybody.
   */
  exclusives: string[];
}

export interface ClubScan {
  /** Top-tier brawlers at least one member can field, 0-1. */
  coverage: number;
  /** The same, counting only brawlers somebody holds hypercharged at power 11. */
  hyperCoverage: number;
  /** Size of the top tier this is measured against. */
  topTierSize: number;
  members: MemberStanding[];
  /** Top-tier brawlers nobody in the club can field. */
  gaps: string[];
  /** Top-tier brawlers nobody can field hypercharged. */
  hyperGaps: string[];
  /** Members whose profile could not be read, so the figures are honest. */
  missed: number;
}

export interface TopTierBrawler {
  brawlerId: number;
  brawlerName: string;
}

/**
 * Null when there is nothing to measure against.
 *
 * An empty top tier means the Ranked list has not been computed, which is a gap
 * in our data and not a fact about this club — reporting 0% would be a verdict
 * we have not earned.
 */
export function clubScan({
  members,
  topTier,
  usablePower,
  missed = 0,
}: {
  members: ScannedMember[];
  topTier: TopTierBrawler[];
  /**
   * Passed in rather than imported, so this file pulls in nothing.
   *
   * The caller hands over `USABLE_POWER`, which is the floor `recordLookup`
   * already measures a single player's coverage at — the club number and the
   * profile number have to mean the same thing or the two pages disagree about
   * the same roster.
   */
  usablePower: number;
  /** Members the upstream API would not return. */
  missed?: number;
}): ClubScan | null {
  if (topTier.length === 0 || members.length === 0) return null;

  const topIds = topTier.map((b) => b.brawlerId);
  const names = new Map(topTier.map((b) => [b.brawlerId, b.brawlerName]));

  /** Who can field each top-tier brawler. Drives coverage, gaps and exclusives. */
  const holders = new Map<number, string[]>(topIds.map((id) => [id, []]));
  const hyperHolders = new Map<number, string[]>(topIds.map((id) => [id, []]));

  const fieldable = members.map((member) => {
    const usable = new Set(
      member.roster.filter((b) => b.power >= usablePower).map((b) => b.id),
    );
    /*
     * Power 11 as well as the hypercharge, because a hypercharge below it
     * cannot be used — the same rule the overlay filters by.
     */
    const charged = new Set(
      member.roster.filter((b) => b.power >= 11 && b.hypercharge).map((b) => b.id),
    );
    for (const id of topIds) {
      if (usable.has(id)) holders.get(id)!.push(member.tag);
      if (charged.has(id)) hyperHolders.get(id)!.push(member.tag);
    }
    return { member, usable, charged };
  });

  const standings: MemberStanding[] = fieldable.map(({ member, usable, charged }) => ({
    tag: member.tag,
    name: member.name,
    trophies: member.trophies,
    coverage: topIds.filter((id) => usable.has(id)).length / topIds.length,
    hyperCoverage: topIds.filter((id) => charged.has(id)).length / topIds.length,
    powerEleven: member.roster.filter((b) => b.power >= 11).length,
    /*
     * Exclusive on the hypercharge, not on the brawler. In a club where
     * everybody owns everything, holding a brawler is not a contribution --
     * holding the only hypercharged copy of one is.
     */
    exclusives: topIds
      .filter((id) => {
        const who = hyperHolders.get(id)!;
        return who.length === 1 && who[0] === member.tag;
      })
      .map((id) => names.get(id)!),
  }));

  /*
   * By coverage, then by who is irreplaceable, then by trophies.
   *
   * Trophies last on purpose. Ranking a club by them is what the game already
   * does, and reproducing that order would make this board a second copy of the
   * member list with extra columns.
   */
  /*
   * Hypercharge coverage first, then plain coverage, then who is
   * irreplaceable, and only then trophies.
   *
   * The order matters more than it looks. Ranking on plain coverage put all
   * thirty members of the top global club on 100% and silently fell through to
   * the trophy tie-break -- which is the member list the game already shows,
   * with extra columns. Trophies stay last on purpose.
   */
  standings.sort(
    (a, b) =>
      b.hyperCoverage - a.hyperCoverage ||
      b.coverage - a.coverage ||
      b.exclusives.length - a.exclusives.length ||
      b.trophies - a.trophies,
  );

  const gaps = topIds.filter((id) => holders.get(id)!.length === 0);
  const hyperGaps = topIds.filter((id) => hyperHolders.get(id)!.length === 0);

  return {
    coverage: (topIds.length - gaps.length) / topIds.length,
    hyperCoverage: (topIds.length - hyperGaps.length) / topIds.length,
    topTierSize: topIds.length,
    members: standings,
    gaps: gaps.map((id) => names.get(id)!),
    hyperGaps: hyperGaps.map((id) => names.get(id)!),
    missed,
  };
}
