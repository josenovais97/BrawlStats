/**
 * The Bubble panel's own sentences, in English. The reference every
 * translation in `bubble-ui-translations` is checked against, and what the
 * panel shows while a language loads or when a string has no translation.
 *
 * `{name}` placeholders are filled by `fill()`; a translation may reorder them
 * but must keep every one (the test checks).
 *
 * Game words -- map, mode, brawler, star power, gadget, gear -- are not here:
 * they come from the game's own files so they match what is on screen.
 */
export const UI_EN = {
  'lang.title': 'Language',
  'lang.hint': 'Choose the language your game is in, so map and brawler names match.',

  'filter.owned': 'Owned',
  'filter.power11': 'Power 11',
  'filter.hypercharge': 'Hypercharged',
  'filter.hiding': 'hiding rest',
  'account.noTag': 'Add your player tag in the BrawlZone app and this panel marks the brawlers you own.',

  'tab.meta': 'Meta',
  'tab.comps': 'Team comp',
  'tab.draft': 'Draft',
  'chooser.title': 'What do you need?',
  'chooser.sub': 'Pick one. The panel remembers it next time.',
  'chooser.meta': 'Who is strong in Ranked right now, by mode and map',
  'chooser.comps': 'The best three to take together on your map',
  'chooser.draft': 'Enter bans and picks, get the counter',

  'mode.all': 'All',
  'chips.change': 'Change',
  'chips.allMaps': 'All maps',
  'chips.wholeMode': 'Whole mode',
  'chips.thinMap': 'Not enough Ranked games on this map yet',

  'meta.heading': 'Ranked meta',
  'common.lastDays': 'last {n} days',
  'meta.emptyMode': 'Not enough sampled Ranked battles in {mode} yet.',
  'meta.emptyMap': 'No brawler is clearly above average on {map} yet. It fills in as more battles here are sampled.',
  'meta.pick': 'Pick',
  'meta.ban': 'Ban',
  'meta.banExplain': 'Strongest here, whoever owns them. Pick rate shows how often it is actually taken: banning something nobody picks wastes the ban.',
  'meta.yourBest': 'Your best here:',
  'meta.noneMatch': 'Nothing on this map matches your filter.',
  'meta.pickedHere': '{n}% picked here',
  'meta.battlesHere': '{n} battles here',
  'meta.battlesAtRank': '{n} at {rank} · {all} all ranks',
  'meta.vsUsual': '{n} vs usual',
  'meta.showMore': 'Show {n} more',

  'comps.heading': 'Best Ranked trios',
  'comps.rankOnly': '{rank} lobbies only.',
  'comps.rankThin': 'Not enough {rank} trios here yet — showing all ranks.',
  'comps.empty': 'Not enough sampled Ranked teams yet. This fills in as more battles are sampled.',
  'comps.emptyMode': 'Not enough sampled Ranked teams in {mode} yet.',
  'comps.fellBack': 'Not enough Ranked games on {map} yet. Showing the best trios across {mode}.',
  'comps.onlyMine': 'Only trios I can run',
  'comps.noneMine': 'None of these trios is fully in your roster yet.',
  'comps.showBuild': '{name}: show build',
  'comps.ownThis': 'You own this brawler',
  'comps.games': '{n} games',
  'comps.thin': 'thin sample',
  'comps.yours': '✓ Yours',
  'comps.ownAll': 'You own all three',
  'comps.vsAvg': '{n} vs avg',
  'comps.tapBuild': 'Tap a brawler for its build.',

  'build.mostOwned': 'Most owned',
  'build.loading': 'Reading builds…',
  'build.noOwners': 'No sampled player owns this brawler yet, so there is nothing to measure.',
  'build.nothing': 'Nothing unlocked on this brawler across the sampled players yet.',
  'build.caveat': 'Across {n} sampled owners. This is what owners have, not what they took into a match: a share near 50% means owners hold both.',

  'draft.ban': 'Ban',
  'draft.you': 'You',
  'draft.vs': 'Vs',
  'draft.addBans': 'Add a ban…',
  'draft.addAllies': 'Add to your team…',
  'draft.addEnemies': 'Add an enemy…',
  'draft.pickMap': 'Pick the mode, then the map you are drafting on.',
  'draft.remove': 'Remove {name}',
  'draft.clear': 'Clear',
  'draft.left': '{n} left',
  'draft.close': 'Close the picker',
  'draft.done': 'Done',
  'draft.likely': 'Likely here — tap one',
  'draft.everyone': 'Everyone',
  'draft.noName': 'No brawler by that name.',
  'draft.reading': 'Reading the draft…',
  'draft.notEnough': 'Not enough sampled battles on this map to rank what is left.',
  'draft.map': 'map {n}%',
  'draft.battles': '{n} battles',
  'draft.vsEdge': 'vs {n}',
  'draft.withEdge': 'with {n}',

  'update.upToDate': 'App {version} · up to date',
  'update.isOut': 'Version {version} is out',
  'update.youHave': '— you have {version}',
  'update.download': 'Download',
  'update.fallback': 'If nothing happens, open {url} in your browser. The file is named for its version, so you can check what you are installing.',

  'bracket.title': 'Your rank',
  'bracket.all': 'All ranks',
  'bracket.thin': 'Not enough {rank} battles in this mode yet — showing all ranks.',
  'bracket.mapsAllRanks': 'Map picks count every rank: one rank alone has too few battles per map.',
  'bracket.mapsAdjusted': 'Picks for {rank}: this map’s results from every rank, adjusted to how each brawler does at {rank}.',

  'page.empty': 'Not enough sampled Ranked battles yet. This fills in as more battles are sampled.',
  'page.footer': 'Meta score combines adjusted win rate and pick rate across sampled Ranked battles. Brawlers without enough battles are left out rather than guessed at.',
} as const;

export type UiKey = keyof typeof UI_EN;
export type UiStrings = Partial<Record<UiKey, string>>;

/** `{name}` placeholders, filled in. Unknown ones are left as written. */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}
