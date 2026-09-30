import { brawlerIconUrl } from '@/lib/brawlapi';
import { formatNumber } from '@/lib/format';
import { MAX_POWER_LEVEL } from '@/lib/progression';
import type { RosterPlan } from '@/lib/roster-optimizer';

/**
 * The upgrade plan, shaped for the Android app.
 *
 * **The strings are built here rather than in the app, and that is the point.**
 * An installed APK is the one version that cannot be told it is wrong — the
 * changelog lives on this site for exactly that reason. Wording, pluralisation
 * and the coin format therefore ship from the server, so a phone that has not
 * been updated since March still renders whatever this file says today. The app
 * draws an icon, a title and two lines; it decides nothing.
 *
 * It is also why the payload carries no raw counts. A number the app does not
 * format is a number the app will one day format differently from the site.
 */

export interface BubblePlanStep {
  brawlerId: number;
  name: string;
  /** Absolute URL; the app has no base to resolve against. */
  icon: string;
  /** "Power 8 → 11 · 2,975 coins" */
  detail: string;
  /** What the spend buys, or empty when it only adds depth. */
  gain: string;
}

export interface BubblePlan {
  /** The consequence, leading. */
  headline: string;
  /** Where the account stands as things are, so the headline has a baseline. */
  note: string;
  steps: BubblePlanStep[];
}

function modesWord(n: number): string {
  return n === 1 ? 'mode' : 'modes';
}

/**
 * Where the account stands today, in one line.
 *
 * Always about the present, never about the plan — a reader who has not spent
 * anything yet should not be told they cover six modes because they could.
 */
function baseline(covered: number, modes: number, banSafe: number): string {
  if (covered === 0) {
    // "any of the 1 live Ranked mode" is what the general form produces, and a
    // sentence the app cannot be patched out of is worth the extra branch.
    return modes === 1
      ? 'You cannot field a top-three pick in the one live Ranked mode yet.'
      : `You cannot field a top-three pick in any of the ${modes} live Ranked modes yet.`;
  }
  if (covered < modes) {
    return `Right now you can field a top-three pick in ${covered} of ${modes}.`;
  }
  /*
   * Fully covered is not the same as finished. Ban-safe means two ready picks,
   * so a reader covering every mode on a single brawler each is one ban away
   * from nothing — and telling them they are done would be wrong.
   */
  return banSafe < modes
    ? `You cover all ${modes}, but only ${banSafe} ${banSafe === 1 ? 'survives' : 'survive'} the first ban.`
    : `You cover all ${modes}, and every one survives the first ban.`;
}

/**
 * Null when there is nothing worth drawing a card for.
 *
 * `modes === 0` means the rotation has not been read, which is a gap in our
 * data and not a fact about this account — so the app shows nothing rather than
 * telling somebody their roster is fine.
 */
export function bubblePlan({
  plan,
  coverage,
}: {
  plan: RosterPlan | null;
  coverage: { covered: number; banSafe: number; modes: number };
}): BubblePlan | null {
  const { covered, banSafe, modes } = coverage;
  if (modes === 0) return null;

  const note = baseline(covered, modes, banSafe);

  if (!plan || plan.steps.length === 0) {
    /*
     * Two different silences. Either everything that would help is already
     * done, or the gap needs a brawler this account does not own — and an
     * unlock is not a spend somebody can make today, which is why the plan
     * refuses to recommend one.
     */
    return {
      headline: covered >= modes ? 'Nothing left to upgrade' : 'No upgrade would change this',
      note:
        covered >= modes
          ? note
          : `${note} Closing it needs a brawler you do not own yet, and an unlock is not something you can just buy.`,
      steps: [],
    };
  }

  const gained = plan.coveredAfter - plan.coveredBefore;
  const secured = plan.banSafeAfter - plan.banSafeBefore;
  const coins = `${formatNumber(plan.totalCoins)} coins`;

  /*
   * Coverage leads when there is any, because a mode you cannot play at all is
   * a bigger hole than one you can play until it is banned. A plan with neither
   * is never built — `rosterPlan` requires a positive gain per step.
   */
  const headline =
    gained > 0
      ? `${coins} covers ${gained} more ${modesWord(gained)}`
      : `${coins} makes ${secured} more ${modesWord(secured)} ban-safe`;

  return {
    headline,
    note,
    steps: plan.steps.map((step) => ({
      brawlerId: step.brawlerId,
      name: step.name,
      icon: brawlerIconUrl(step.brawlerId),
      detail: `Power ${step.power} → ${MAX_POWER_LEVEL} · ${formatNumber(step.coins)} coins`,
      gain:
        step.covers.length > 0
          ? `Covers ${step.covers.join(', ')}`
          : step.secures.length > 0
            ? `Survives a ban in ${step.secures.join(', ')}`
            : '',
    })),
  };
}
