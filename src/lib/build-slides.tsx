import type { ReactElement } from 'react';

import type { BrawlerOfDay } from '@/lib/brawler-of-day';
import { gadgetIconUrl, gearIconUrl, starPowerIconUrl } from '@/lib/brawlapi';
import { titleCase } from '@/lib/format';
import {
  ACCENT,
  BRAND,
  DIM,
  FG,
  Frame,
  MUTED,
  Wordmark,
  loadArt,
  loadIcon,
  loadLogo,
  outro,
} from '@/lib/slide-chrome';
import type { AbilityChoice } from '@/lib/stats';

export { SLIDE_SIZE, toJpeg } from '@/lib/slide-chrome';

/**
 * One brawler's build, as a carousel: what owners actually bought, and how it
 * went for them.
 *
 * The second daily post. The findings carousel answers "what changed today";
 * this answers "what should I buy on this brawler", which is the question the
 * site gets asked most and the one a screenshot travels best for.
 *
 * Read from players who own exactly one of a pair -- they chose it, and every
 * battle they played on the brawler was played with it. That makes it a
 * measurement of a decision rather than of ownership, and it is also why the
 * slides never say one option is better: which option a player bought is their
 * own choice, so the rate beside it measures the ability and the kind of player
 * who picks it together. `ability-choices.tsx` carries the same caveat on the
 * page, at more length.
 */

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function cap(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * Item names arrive from the game API in capitals -- NEW INSECT OVERLORDS --
 * and the site renders them title-cased. Matching that matters more here than
 * on the page: a slide is a picture of the site, and all-caps names would read
 * as a different product sitting next to the screenshots people already know.
 */
const itemName = (names: Map<number, string>, id: number) =>
  titleCase(names.get(id) ?? `#${id}`);

/** A win rate, or a dash. Below the sample floor `winRate` is null by design. */
const rate = (n: number | null) => (n === null ? '--' : pct(n));

function cover(day: BrawlerOfDay, art: string | null): ReactElement {
  return (
    <Frame>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 32, letterSpacing: 3, color: ACCENT }}>
          BUILD OF THE DAY
        </div>
        <div style={{ display: 'flex', fontSize: 124, fontWeight: 800, marginTop: 10 }}>
          {cap(day.name)}
        </div>
        <div style={{ display: 'flex', fontSize: 44, color: MUTED, marginTop: 14 }}>
          What owners actually buy
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: art ? 520 : 0,
          marginTop: 36,
        }}
      >
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} width={500} height={500} alt="" style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: 18 }}>
        <div style={{ display: 'flex', fontSize: 34, color: DIM }}>
          {`Read from ${day.choices.sampleSize.toLocaleString('en-GB')} first-buyers`}
        </div>
        <Wordmark />
      </div>
    </Frame>
  );
}

/**
 * One pair -- star powers or gadgets -- as two rows.
 *
 * Both options, not just the popular one: the whole point of the section is
 * the split, and showing only the winner turns a measurement into a
 * recommendation the data does not support.
 */
function pair(
  kind: 'Star power' | 'Gadget',
  rows: AbilityChoice[],
  names: Map<number, string>,
  icons: (string | null)[],
): ReactElement {
  const top = [...rows].sort((a, b) => b.share - a.share).slice(0, 2);

  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        {`${kind.toUpperCase()} BOUGHT FIRST`}
      </div>
      <div style={{ display: 'flex', fontSize: 70, fontWeight: 800, marginTop: 14 }}>
        What owners pick
      </div>
      <div style={{ display: 'flex', fontSize: 34, color: DIM, marginTop: 12 }}>
        Among players who own only one so far
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, marginTop: 52 }}>
        {top.map((row, i) => (
          <div
            key={row.itemId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: '32px 30px',
              borderRadius: 26,
              background: i === 0 ? 'rgba(53,208,255,0.10)' : 'rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
              {icons[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icons[i] as string} width={96} height={96} alt="" />
              ) : (
                <div style={{ display: 'flex' }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', fontSize: 46, fontWeight: 700, color: FG }}>
                  {itemName(names, row.itemId)}
                </div>
                <div style={{ display: 'flex', fontSize: 30, color: DIM }}>
                  {i === 0 ? 'Most picked' : 'The other one'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 44, marginTop: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, color: ACCENT }}>
                  {rate(row.winRate)}
                </div>
                <div style={{ display: 'flex', fontSize: 28, color: DIM }}>win rate</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, color: FG }}>
                  {pct(row.share)}
                </div>
                <div style={{ display: 'flex', fontSize: 28, color: DIM }}>of first buyers</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* The caveat, short enough to fit and honest enough to keep. Which
          option a player bought is their own choice, so this is not a
          controlled comparison and the slide does not pretend otherwise. */}
      <div style={{ display: 'flex', fontSize: 28, color: DIM, marginTop: 36 }}>
        Players chose these themselves, so this is not a controlled test.
      </div>
    </Frame>
  );
}

/** Gears, which are not a pair: you can own many and run two. */
function gears(day: BrawlerOfDay, icons: (string | null)[]): ReactElement {
  const rows = [...(day.build?.gears ?? [])].sort((a, b) => b.share - a.share).slice(0, 5);

  return (
    <Frame>
      <div style={{ display: 'flex', fontSize: 30, letterSpacing: 3, color: ACCENT }}>
        GEARS OWNERS BUY
      </div>
      <div style={{ display: 'flex', fontSize: 70, fontWeight: 800, marginTop: 14 }}>
        {`${cap(day.name)} gears`}
      </div>
      <div style={{ display: 'flex', fontSize: 34, color: DIM, marginTop: 12 }}>
        Gears cost coins and you can only run two
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: 48 }}>
        {rows.map((row, i) => (
          <div key={row.itemId} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            {icons[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icons[i] as string} width={72} height={72} alt="" />
            ) : (
              <div style={{ display: 'flex' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 560 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: FG }}>
                  {itemName(day.gearNames, row.itemId)}
                </div>
                <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: ACCENT }}>
                  {pct(row.share)}
                </div>
              </div>
              {/* A bar rather than a second number: the ranking is the point,
                  and at a glance a length reads faster than a percentage. */}
              <div
                style={{
                  display: 'flex',
                  width: 560,
                  height: 12,
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    width: Math.max(8, Math.round(560 * row.share)),
                    height: 12,
                    borderRadius: 6,
                    background: BRAND,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', fontSize: 28, color: DIM, marginTop: 38 }}>
        {`Share of every gear unlock on ${cap(day.name)}.`}
      </div>
    </Frame>
  );
}

/**
 * Which slides a day has, and in what order.
 *
 * A brawler with only one gadget unlocked across the sample has no gadget
 * choice to show, so that slide is left out rather than rendered empty --
 * which is why the count cannot be a constant.
 */
function plan(day: BrawlerOfDay): ('cover' | 'star' | 'gadget' | 'gears' | 'outro')[] {
  const out: ('cover' | 'star' | 'gadget' | 'gears' | 'outro')[] = ['cover'];
  if (day.choices.starPowers.length > 1) out.push('star');
  if (day.choices.gadgets.length > 1) out.push('gadget');
  if ((day.build?.gears.length ?? 0) > 1) out.push('gears');
  out.push('outro');
  return out;
}

export function buildSlideCount(day: BrawlerOfDay | null): number {
  return day ? plan(day).length : 0;
}

export async function buildSlides(
  day: BrawlerOfDay,
  only?: number,
): Promise<ReactElement[]> {
  const steps = plan(day);
  const wanted = (kind: string) => only === undefined || steps[only] === kind;

  const starTop = [...day.choices.starPowers].sort((a, b) => b.share - a.share).slice(0, 2);
  const gadgetTop = [...day.choices.gadgets].sort((a, b) => b.share - a.share).slice(0, 2);
  const gearTop = [...(day.build?.gears ?? [])].sort((a, b) => b.share - a.share).slice(0, 5);

  // Only the artwork the requested slide draws. Loading all of it for every
  // slide turned a five-slide day into twenty-odd CDN round trips.
  const [art, starIcons, gadgetIcons, gearIcons, logo] = await Promise.all([
    wanted('cover') ? loadArt(day.brawlerId, 700, day.imageUrl) : Promise.resolve(null),
    wanted('star')
      ? Promise.all(starTop.map((r) => loadIcon(starPowerIconUrl(r.itemId), 128)))
      : Promise.resolve<(string | null)[]>([]),
    wanted('gadget')
      ? Promise.all(gadgetTop.map((r) => loadIcon(gadgetIconUrl(r.itemId), 128)))
      : Promise.resolve<(string | null)[]>([]),
    wanted('gears')
      ? Promise.all(gearTop.map((r) => loadIcon(gearIconUrl(r.itemId), 96)))
      : Promise.resolve<(string | null)[]>([]),
    wanted('outro') ? loadLogo(208) : Promise.resolve(null),
  ]);

  return steps.map((step) => {
    switch (step) {
      case 'cover':
        return cover(day, art);
      case 'star':
        return pair('Star power', day.choices.starPowers, day.starPowerNames, starIcons);
      case 'gadget':
        return pair('Gadget', day.choices.gadgets, day.gadgetNames, gadgetIcons);
      case 'gears':
        return gears(day, gearIcons);
      default:
        return outro(logo);
    }
  });
}

/** The caption the post carries, built from the same data the slides show. */
export function buildCaption(day: BrawlerOfDay, site: string): { title: string; description: string } {
  const best = [...day.choices.starPowers].sort((a, b) => b.share - a.share)[0];
  const bestGadget = [...day.choices.gadgets].sort((a, b) => b.share - a.share)[0];
  const name = cap(day.name);

  const parts: string[] = [];
  if (best) {
    parts.push(`${itemName(day.starPowerNames, best.itemId)} — ${pct(best.share)} of first buyers`);
  }
  if (bestGadget) {
    parts.push(
      `${itemName(day.gadgetNames, bestGadget.itemId)} — ${pct(bestGadget.share)} of first buyers`,
    );
  }

  return {
    title: `${name}: what owners actually buy`,
    description:
      `${parts.join(' | ')} — read from ${day.choices.sampleSize.toLocaleString('en-GB')} first-buyers. ` +
      `Full build at ${site}/brawlers/${day.slug} ` +
      '#brawlstars #brawlstarsbuilds #brawlstarstips #brawlstarsguide',
  };
}
