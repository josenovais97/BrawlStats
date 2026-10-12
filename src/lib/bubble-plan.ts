import { brawlerIconUrl } from '@/lib/brawlapi';
import { PLAN_EN, PLAN_TEXT, type PlanText } from '@/lib/bubble-plan-text';
import { fill } from '@/lib/bubble-ui-en';
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

/** How one language writes this card: its sentences, numbers and lists. */
interface Voice {
  t: PlanText;
  num: (n: number) => string;
  list: (items: string[]) => string;
}

function voice(lang: string): Voice {
  const t = PLAN_TEXT[lang];
  if (!t || lang === 'en') {
    return { t: PLAN_EN, num: (n) => formatNumber(n), list: (items) => items.join(', ') };
  }
  const numbers = new Intl.NumberFormat(lang);
  const lists = new Intl.ListFormat(lang, { style: 'short', type: 'conjunction' });
  return { t, num: (n) => numbers.format(n), list: (items) => lists.format(items) };
}

/**
 * Where the account stands today, in one line.
 *
 * Always about the present, never about the plan — a reader who has not spent
 * anything yet should not be told they cover six modes because they could.
 */
function baseline({ t }: Voice, covered: number, modes: number, banSafe: number): string {
  if (covered === 0) {
    // "any of the 1 live Ranked mode" is what the general form produces, and a
    // sentence the app cannot be patched out of is worth the extra branch.
    return modes === 1 ? t.noneOne : fill(t.none, { modes });
  }
  if (covered < modes) {
    return fill(t.some, { covered, modes });
  }
  /*
   * Fully covered is not the same as finished. Ban-safe means two ready picks,
   * so a reader covering every mode on a single brawler each is one ban away
   * from nothing — and telling them they are done would be wrong.
   */
  return banSafe < modes
    ? fill(banSafe === 1 ? t.allBanOne : t.allBan, { modes, n: banSafe })
    : fill(t.allSafe, { modes });
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
  lang = 'en',
  name = (text) => text,
}: {
  plan: RosterPlan | null;
  coverage: { covered: number; banSafe: number; modes: number };
  /** The app's language, from 1.28; older builds send none and get English. */
  lang?: string;
  /** A brawler's name in that language, as the game spells it. */
  name?: (text: string) => string;
}): BubblePlan | null {
  const { covered, banSafe, modes } = coverage;
  if (modes === 0) return null;

  const v = voice(lang);
  const { t } = v;
  const note = baseline(v, covered, modes, banSafe);

  if (!plan || plan.steps.length === 0) {
    /*
     * Two different silences. Either everything that would help is already
     * done, or the gap needs a brawler this account does not own — and an
     * unlock is not a spend somebody can make today, which is why the plan
     * refuses to recommend one.
     */
    return {
      headline: covered >= modes ? t.doneHead : t.stuckHead,
      note: covered >= modes ? note : fill(t.stuckNote, { note }),
      steps: [],
    };
  }

  const gained = plan.coveredAfter - plan.coveredBefore;
  const secured = plan.banSafeAfter - plan.banSafeBefore;
  const coins = fill(t.coins, { n: v.num(plan.totalCoins) });

  /*
   * Coverage leads when there is any, because a mode you cannot play at all is
   * a bigger hole than one you can play until it is banned. A plan with neither
   * is never built — `rosterPlan` requires a positive gain per step.
   */
  const headline =
    gained > 0
      ? fill(gained === 1 ? t.coverOne : t.cover, { coins, n: gained })
      : fill(secured === 1 ? t.secureOne : t.secure, { coins, n: secured });

  return {
    headline,
    note,
    steps: plan.steps.map((step) => ({
      brawlerId: step.brawlerId,
      name: name(step.name),
      icon: brawlerIconUrl(step.brawlerId),
      detail: fill(t.detail, {
        from: step.power,
        to: MAX_POWER_LEVEL,
        coins: fill(t.coins, { n: v.num(step.coins) }),
      }),
      gain:
        step.covers.length > 0
          ? fill(t.covers, { list: v.list(step.covers) })
          : step.secures.length > 0
            ? fill(t.secures, { list: v.list(step.secures) })
            : '',
    })),
  };
}
