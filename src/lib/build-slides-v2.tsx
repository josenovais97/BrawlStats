import type { ReactElement } from 'react';

import type { BrawlerOfDay } from '@/lib/brawler-of-day';
import { gadgetIconUrl, gearIconUrl, starPowerIconUrl } from '@/lib/brawlapi';
import { titleCase } from '@/lib/format';
import { loadArt, loadIcon, loadLogo } from '@/lib/slide-chrome';
import {
  FG,
  GOLD,
  GREEN,
  MUTED,
  Note,
  OUTLINE,
  Outro,
  Panel,
  Ribbon,
  SKY,
  Stage,
  Tag,
  Title,
} from '@/lib/slide-kit';
import type { AbilityChoice } from '@/lib/stats';
import type { BuildOption } from '@/types/stats';

export { SLIDE_SIZE, slideFonts, toJpeg } from '@/lib/slide-chrome';

/**
 * Build of the day, second generation (2026-10-13): four slides.
 *
 * Led by what wins rather than what sells. The first version headed every pair
 * with the most-bought option, and on Brock that was the one with the lower
 * win rate -- the post's own headline pick was the weaker one. Both numbers
 * are still shown, and when they disagree the post says so, which is also the
 * most interesting thing it can say.
 *
 * The win rate is that of players who run the option (they own one of the
 * pair, so every game they play uses it). Players chose it themselves, so it
 * measures the option and the people who pick it together; the slide says
 * "players who run it win", never "it is better".
 */

const cap = (name: string) => titleCase(name);
const pct = (n: number | null) => (n === null ? '--' : `${(n * 100).toFixed(1)}%`);

export const BUILD_V2_SLIDES = 4;

/** A win-rate gap smaller than this is a tie, not a recommendation. */
const CLEAR_GAP = 0.01;

/** The pair's two options, with which one wins and which one sells. */
function verdict(rows: AbilityChoice[]) {
  const pair = [...rows].sort((a, b) => b.share - a.share).slice(0, 2);
  const [a, b] = pair;
  const wins =
    a && b && a.winRate !== null && b.winRate !== null && Math.abs(a.winRate - b.winRate) >= CLEAR_GAP
      ? a.winRate > b.winRate
        ? a
        : b
      : null;
  return { pair, wins, sells: a ?? null, pick: wins ?? a ?? null };
}

function Loadout({
  icons,
  labels,
}: {
  icons: (string | null)[];
  labels: string[];
}): ReactElement {
  return (
    <div style={{ display: 'flex', gap: 18 }}>
      {icons.map((src, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 196 }}>
          <div
            style={{
              display: 'flex',
              width: 168,
              height: 168,
              borderRadius: 34,
              alignItems: 'center',
              justifyContent: 'center',
              border: `5px solid ${OUTLINE}`,
              background: 'linear-gradient(180deg, #26398a, #1a2759)',
              boxShadow: `inset 0 4px 0 rgba(255,255,255,0.18), 0 9px 0 ${OUTLINE}`,
            }}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} width={124} height={124} alt="" />
            ) : (
              <div style={{ display: 'flex' }} />
            )}
          </div>
          <div style={{ display: 'flex', marginTop: 16, fontSize: 28, color: MUTED }}>{labels[i]}</div>
        </div>
      ))}
    </div>
  );
}

function cover(
  day: BrawlerOfDay,
  art: string | null,
  loadout: (string | null)[],
  labels: string[],
): ReactElement {
  return (
    <Stage glow="#2c8bff">
      <div style={{ display: 'flex', marginTop: 10 }}>
        <Ribbon>BUILD OF THE DAY</Ribbon>
      </div>
      <div style={{ display: 'flex', marginTop: 30 }}>
        <Title size={cap(day.name).length > 9 ? 128 : 156}>{cap(day.name)}</Title>
      </div>
      <div style={{ display: 'flex', marginTop: 10 }}>
        <Note size={40} color={FG}>
          The loadout that wins
        </Note>
      </div>

      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} width={600} height={600} alt="" style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>

      <Loadout icons={loadout} labels={labels} />
    </Stage>
  );
}

function OptionCard({
  row,
  name,
  icon,
  wins,
  sells,
}: {
  row: AbilityChoice;
  name: string;
  icon: string | null;
  wins: boolean;
  sells: boolean;
}): ReactElement {
  return (
    <div style={{ display: 'flex', width: 420 }}>
      <Panel accent={wins ? GOLD : undefined} pad="24px 24px 26px" gap={10} grow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} width={104} height={104} alt="" />
          ) : (
            <div style={{ display: 'flex', width: 104, height: 104 }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {wins ? (
              <Tag color={GOLD} size={24}>
                WINS MORE
              </Tag>
            ) : (
              <div style={{ display: 'flex' }} />
            )}
            {sells ? (
              <Tag color={SKY} size={24}>
                MOST BOUGHT
              </Tag>
            ) : (
              <div style={{ display: 'flex' }} />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 40, color: FG, WebkitTextStroke: `2px ${OUTLINE}`, marginTop: 6 }}>
          {name}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <Title size={72} color={wins ? GOLD : FG}>
            {pct(row.winRate)}
          </Title>
          <div style={{ display: 'flex', marginBottom: 10 }}>
            <Note size={26}>win rate</Note>
          </div>
        </div>
        <Note size={26}>{`${Math.round(row.share * 100)}% of players pick it`}</Note>
      </Panel>
    </div>
  );
}

function pairBlock(
  title: string,
  rows: AbilityChoice[],
  names: Map<number, string>,
  icons: Map<number, string | null>,
): ReactElement {
  const { pair, wins, sells } = verdict(rows);
  const disagree = wins && sells && wins.itemId !== sells.itemId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Title size={58}>{title}</Title>
        {disagree ? (
          <Tag color={GREEN} size={26}>
            The popular one wins less
          </Tag>
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {pair.map((row) => (
          <OptionCard
            key={row.itemId}
            row={row}
            name={cap(names.get(row.itemId) ?? `#${row.itemId}`)}
            icon={icons.get(row.itemId) ?? null}
            wins={wins?.itemId === row.itemId}
            sells={sells?.itemId === row.itemId}
          />
        ))}
      </div>
    </div>
  );
}

function abilities(day: BrawlerOfDay, icons: Map<number, string | null>): ReactElement {
  return (
    <Stage glow="#2c8bff">
      <div style={{ display: 'flex', marginTop: 10 }}>
        <Ribbon>WHAT TO BUY</Ribbon>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, marginTop: 34 }}>
        {day.choices.starPowers.length >= 2 ? (
          pairBlock('Star power', day.choices.starPowers, day.starPowerNames, icons)
        ) : (
          <div style={{ display: 'flex' }} />
        )}
        {day.choices.gadgets.length >= 2 ? (
          pairBlock('Gadget', day.choices.gadgets, day.gadgetNames, icons)
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>
      <div style={{ display: 'flex', marginTop: 34 }}>
        <Note size={26}>
          {`Win rate of ${day.choices.sampleSize.toLocaleString('en-GB')} players who own only one of each pair, so every game they play runs it.`}
        </Note>
      </div>
    </Stage>
  );
}

function gearSlide(day: BrawlerOfDay, gears: BuildOption[], icons: Map<number, string | null>): ReactElement {
  const [first, second, ...rest] = gears;
  const big = [first, second].filter(Boolean);
  return (
    <Stage glow="#2c8bff">
      <div style={{ display: 'flex', marginTop: 10 }}>
        <Ribbon color={SKY} depth="#1c6f99">
          GEARS TO RUN
        </Ribbon>
      </div>
      <div style={{ display: 'flex', marginTop: 30 }}>
        <Title size={84}>{`${cap(day.name)} runs two`}</Title>
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <Note size={32}>The two gears owners unlock most</Note>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40 }}>
        {big.map((g) => (
          <div key={g.itemId} style={{ display: 'flex', width: 420 }}>
            <Panel accent={GOLD} pad="28px 24px" gap={12} grow>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {icons.get(g.itemId) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={icons.get(g.itemId) as string} width={170} height={170} alt="" />
                ) : (
                  <div style={{ display: 'flex', width: 170, height: 170 }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Title size={46} align="center">
                  {cap(day.gearNames.get(g.itemId) ?? `#${g.itemId}`)}
                </Title>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Title size={64} color={GOLD} align="center">
                  {`${Math.round(g.share * 100)}%`}
                </Title>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Note size={26} align="center">
                  of gear unlocks
                </Note>
              </div>
            </Panel>
          </div>
        ))}
      </div>

      {rest.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 36 }}>
          {rest.slice(0, 3).map((g) => (
            <Panel key={g.itemId} column={false} gap={18} pad="10px 22px">
              {icons.get(g.itemId) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icons.get(g.itemId) as string} width={70} height={70} alt="" />
              ) : (
                <div style={{ display: 'flex', width: 70 }} />
              )}
              <div style={{ display: 'flex', flexGrow: 1, fontSize: 38, color: FG }}>
                {cap(day.gearNames.get(g.itemId) ?? `#${g.itemId}`)}
              </div>
              <div style={{ display: 'flex', fontSize: 40, color: MUTED }}>{`${Math.round(g.share * 100)}%`}</div>
            </Panel>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex' }} />
      )}
    </Stage>
  );
}

export async function buildSlidesV2(day: BrawlerOfDay, only?: number): Promise<ReactElement[]> {
  const want = (i: number) => only === undefined || only === i;
  const star = verdict(day.choices.starPowers);
  const gadget = verdict(day.choices.gadgets);
  const gears = [...(day.build?.gears ?? [])].sort((a, b) => b.share - a.share).slice(0, 5);

  const slides: ReactElement[] = [];
  if (want(0)) {
    const picks = [
      star.pick ? { url: starPowerIconUrl(star.pick.itemId), label: 'Star power' } : null,
      gadget.pick ? { url: gadgetIconUrl(gadget.pick.itemId), label: 'Gadget' } : null,
      ...gears.slice(0, 2).map((g) => ({ url: gearIconUrl(g.itemId), label: 'Gear' })),
    ].filter((x): x is { url: string; label: string } => x !== null);
    const [art, ...icons] = await Promise.all([
      loadArt(day.brawlerId, 600, day.imageUrl),
      ...picks.map((p) => loadIcon(p.url, 130)),
    ]);
    slides[0] = cover(day, art, icons, picks.map((p) => p.label));
  }
  if (want(1)) {
    const items = [
      ...star.pair.map((r) => [r.itemId, starPowerIconUrl(r.itemId)] as const),
      ...gadget.pair.map((r) => [r.itemId, gadgetIconUrl(r.itemId)] as const),
    ];
    const icons = new Map(await Promise.all(items.map(async ([id, url]) => [id, await loadIcon(url, 110)] as const)));
    slides[1] = abilities(day, icons);
  }
  if (want(2)) {
    const icons = new Map(
      await Promise.all(gears.map(async (g) => [g.itemId, await loadIcon(gearIconUrl(g.itemId), 180)] as const)),
    );
    slides[2] = gearSlide(day, gears, icons);
  }
  if (want(3)) {
    slides[3] = (
      <Outro
        logo={await loadLogo(240)}
        line={`Every brawler's build, by what wins, on the site and in the Bubble.`}
      />
    );
  }
  return slides;
}

/** The caption, led by what wins, with both numbers when they disagree. */
export function buildCaptionV2(day: BrawlerOfDay, site: string): { title: string; description: string } {
  const name = cap(day.name);
  const star = verdict(day.choices.starPowers);
  const gadget = verdict(day.choices.gadgets);
  const line = (v: ReturnType<typeof verdict>, names: Map<number, string>) =>
    v.pick ? `${cap(names.get(v.pick.itemId) ?? '')} (${pct(v.pick.winRate)} win rate)` : null;
  const picks = [line(star, day.starPowerNames), line(gadget, day.gadgetNames)].filter(Boolean);
  const flipped = [star, gadget].some((v) => v.wins && v.sells && v.wins.itemId !== v.sells.itemId);
  return {
    title: `${name}: the build that wins`,
    description:
      `Best ${name} build in Ranked: ${picks.join(' + ')}.` +
      (flipped ? ' Most players buy the other one.' : '') +
      ` From ${day.choices.sampleSize.toLocaleString('en-GB')} players. Full build at ${site}/brawlers/${day.slug} ` +
      '#brawlstars #brawlstarsbuilds #brawlstarstips #brawlstarsranked',
  };
}
