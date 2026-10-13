import type { ReactElement } from 'react';

import { brawlerPortraitUrl } from '@/lib/brawlapi';
import type { CounterEntry, CounterPost, PatchPost, TrioPost } from '@/lib/daily-posts';
import { titleCase } from '@/lib/format';
import { slugify } from '@/lib/slugs';
import { loadArt, loadIcon, loadLogo, loadSized } from '@/lib/slide-chrome';
import {
  FG,
  GOLD,
  GREEN,
  MUTED,
  Note,
  OUTLINE,
  Outro,
  Panel,
  Portrait,
  RED,
  RankCoin,
  BrandTag,
  Ribbon,
  SKY,
  Stage,
  Tag,
  Title,
} from '@/lib/slide-kit';

export { SLIDE_SIZE, slideFonts, toJpeg } from '@/lib/slide-chrome';

/**
 * Slides for counter of the day and trio of the day (see `daily-posts`), on
 * the second-generation kit.
 */

const cap = (name: string) => titleCase(name);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const points = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(1)}`;
const face = (id: number, box: number) => loadIcon(brawlerPortraitUrl(id), box);

/* --------------------------------------------------------------- counter */

export const COUNTER_SLIDES = 4;

function counterCover(post: CounterPost, art: string | null, faces: (string | null)[]): ReactElement {
  const name = cap(post.target.name);
  return (
    <Stage glow="#ff3b5c">
      <div style={{ display: 'flex', marginTop: 10 }}>
        <Ribbon color={RED} depth="#9c1d36" ink={FG}>
          HOW TO BEAT
        </Ribbon>
      </div>
      <div style={{ display: 'flex', marginTop: 30 }}>
        <Title size={name.length > 9 ? 130 : 160}>{name}</Title>
      </div>
      <div style={{ display: 'flex', marginTop: 10 }}>
        <Note size={38} color={FG}>
          {`In ${Math.round(post.pickRate * 6 * 100)}% of Ranked games right now`}
        </Note>
      </div>

      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} width={560} height={560} alt="" style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>

      <Panel accent={GREEN} column={false} gap={22} pad="20px 26px">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Title size={50} color={GREEN}>
            Pick these
          </Title>
          <Note size={26}>Swipe for the numbers</Note>
        </div>
        <div style={{ display: 'flex', gap: 14, marginLeft: 'auto' }}>
          {faces.slice(0, 3).map((src, i) => (
            <Portrait key={i} src={src} size={128} ring={GREEN} />
          ))}
        </div>
      </Panel>
    </Stage>
  );
}

function counterRows(
  post: CounterPost,
  rows: CounterEntry[],
  faces: (string | null)[],
  good: boolean,
): ReactElement {
  const target = cap(post.target.name);
  return (
    <Stage glow={good ? '#1fbf6b' : '#ff3b5c'}>
      <div style={{ display: 'flex', marginTop: 10 }}>
        {good ? (
          <Ribbon color={GREEN} depth="#167a45">
            PICK THESE
          </Ribbon>
        ) : (
          <Ribbon color={RED} depth="#9c1d36" ink={FG}>
            {`DON'T PICK THESE`}
          </Ribbon>
        )}
      </div>
      <div style={{ display: 'flex', marginTop: 28 }}>
        <Title size={84}>{good ? `Best into ${target}` : `Worst into ${target}`}</Title>
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <Note size={30}>
          {good
            ? `Ranked win rate against ${target}, last ${post.windowDays} days`
            : `These lose to ${target} more than they should`}
        </Note>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: good ? 16 : 22, marginTop: 34 }}>
        {rows.map((r, i) => (
          <Panel key={r.brawlerId} column={false} gap={22} pad={good ? '12px 24px 12px 16px' : '20px 24px 20px 16px'} accent={good && i === 0 ? GREEN : undefined}>
            {good ? <RankCoin n={i + 1} size={60} /> : <div style={{ display: 'flex' }} />}
            <Portrait src={faces[i]} size={good ? 118 : 150} radius={26} ring={good ? undefined : RED} />
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              <div style={{ display: 'flex', fontSize: good ? 50 : 56, color: FG, WebkitTextStroke: `2px ${OUTLINE}` }}>
                {cap(r.name)}
              </div>
              <div style={{ display: 'flex', fontSize: 26, color: MUTED }}>{`${r.games.toLocaleString('en-GB')} games vs ${target}`}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ display: 'flex', fontSize: 54, color: good ? GREEN : RED, WebkitTextStroke: `2px ${OUTLINE}` }}>
                {pct(r.winRate)}
              </div>
              <Tag size={24} color={good ? GREEN : RED} ink={OUTLINE}>
                {`${points(r.edge)} vs expected`}
              </Tag>
            </div>
          </Panel>
        ))}
      </div>
    </Stage>
  );
}

export async function counterSlides(post: CounterPost, only?: number): Promise<ReactElement[]> {
  const want = (i: number) => only === undefined || only === i;
  const slides: ReactElement[] = [];
  if (want(0)) {
    const [art, ...faces] = await Promise.all([
      loadArt(post.target.brawlerId, 560, post.target.imageUrl),
      ...post.counters.slice(0, 3).map((c) => face(c.brawlerId, 140)),
    ]);
    slides[0] = counterCover(post, art, faces);
  }
  if (want(1)) {
    const faces = await Promise.all(post.counters.map((c) => face(c.brawlerId, 130)));
    slides[1] = counterRows(post, post.counters, faces, true);
  }
  if (want(2)) {
    const faces = await Promise.all(post.avoid.map((c) => face(c.brawlerId, 160)));
    slides[2] = counterRows(post, post.avoid, faces, false);
  }
  if (want(3)) {
    slides[3] = (
      <Outro logo={await loadLogo(240)} line="Counters for every brawler, by your rank, in the Bubble's draft board." />
    );
  }
  return slides;
}

export function counterCaption(post: CounterPost, site: string): { title: string; description: string } {
  const name = cap(post.target.name);
  const top = post.counters.slice(0, 3).map((c) => cap(c.name));
  return {
    title: `How to beat ${name} in Ranked`,
    description:
      `Struggling against ${name}? Pick ${top.join(', ')}. ` +
      `Ranked win rates against ${name} from the last ${post.windowDays} days, every rank. ` +
      `A different brawler every day. All ${name} counters by rank at ${site}/brawlers/${slugify(post.target.name)}/counters ` +
      '#brawlstars #brawlstarsranked #brawlstarstips #brawlstarscounters #brawlstarsdraft',
  };
}

/* ------------------------------------------------------------------ trio */

export const TRIO_SLIDES = 3;

function trioCover(post: TrioPost, icon: string | null, faces: Map<number, string | null>): ReactElement {
  const best = post.trios[0];
  return (
    <Stage glow={post.modeColor}>
      <div style={{ display: 'flex', marginTop: 10 }}>
        <Ribbon color={SKY} depth="#1c6f99">
          TEAM OF THE DAY
        </Ribbon>
      </div>
      <div style={{ display: 'flex', marginTop: 30 }}>
        <Title size={post.mapName.length > 13 ? 104 : 124}>{post.mapName}</Title>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} width={70} height={70} alt="" />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
        <div style={{ display: 'flex', fontSize: 44, color: post.modeColor, WebkitTextStroke: `3px ${OUTLINE}` }}>
          {post.modeName}
        </div>
      </div>

      <div style={{ display: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent: 'center', gap: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {best.brawlers.map((b, i) => (
            <div key={b.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 280, marginTop: i === 1 ? 0 : 60 }}>
              <Portrait src={faces.get(b.id) ?? null} size={i === 1 ? 280 : 250} ring={GOLD} />
              <div style={{ display: 'flex', marginTop: 20 }}>
                <Title size={50} align="center">
                  {cap(b.name)}
                </Title>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Panel accent={GOLD} column={false} gap={20} pad="18px 34px">
            <Title size={92} color={GOLD}>
              {pct(best.winRate)}
            </Title>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Note size={34} color={FG}>
                win rate together
              </Note>
              <Note size={28}>{`${best.battles} Ranked games`}</Note>
            </div>
          </Panel>
        </div>
      </div>
    </Stage>
  );
}

function trioMore(
  post: TrioPost,
  art: { src: string; width: number; height: number } | null,
  faces: Map<number, string | null>,
): ReactElement {
  return (
    <Stage glow={post.modeColor} brand={false}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <Title size={76}>{`If they're taken`}</Title>
        <BrandTag inline />
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <Note size={30}>{`The next best teams on ${post.mapName}`}</Note>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 30 }}>
        {post.trios.slice(1).map((t, i) => (
          <Panel key={i} column={false} gap={18} pad="18px 24px">
            <RankCoin n={i + 2} size={60} />
            {t.brawlers.map((b) => (
              <Portrait key={b.id} src={faces.get(b.id) ?? null} size={128} radius={26} />
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexGrow: 1 }}>
              <div style={{ display: 'flex', fontSize: 56, color: FG, WebkitTextStroke: `3px ${OUTLINE}` }}>
                {pct(t.winRate)}
              </div>
              <div style={{ display: 'flex', fontSize: 26, color: MUTED }}>{`${t.battles} games`}</div>
            </div>
          </Panel>
        ))}
      </div>
      {art ? (
        <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', marginTop: 30 }}>
          <div
            style={{
              display: 'flex',
              transform: 'rotate(-3deg)',
              borderRadius: 24,
              border: `6px solid ${OUTLINE}`,
              boxShadow: `0 12px 0 ${OUTLINE}`,
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.src} width={art.width} height={art.height} alt="" />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex' }} />
      )}
    </Stage>
  );
}

export async function trioSlides(post: TrioPost, only?: number): Promise<ReactElement[]> {
  const want = (i: number) => only === undefined || only === i;
  const ids = [...new Set(post.trios.flatMap((t) => t.brawlers.map((b) => b.id)))];
  const slides: ReactElement[] = [];
  if (want(0) || want(1)) {
    const faces = new Map(await Promise.all(ids.map(async (id) => [id, await face(id, 290)] as const)));
    if (want(0)) {
      const icon = post.modeIconUrl ? await loadIcon(post.modeIconUrl, 80) : null;
      slides[0] = trioCover(post, icon, faces);
    }
    if (want(1)) {
      const art = post.mapArtUrl ? await loadSized(post.mapArtUrl, 520, 560) : null;
      slides[1] = trioMore(post, art, faces);
    }
  }
  if (want(2)) {
    slides[2] = (
      <Outro logo={await loadLogo(240)} line="The best trio for every Ranked map, and for your rank, in the Bubble." />
    );
  }
  return slides;
}

export function trioCaption(post: TrioPost, site: string): { title: string; description: string } {
  const best = post.trios[0].brawlers.map((b) => cap(b.name)).join(' + ');
  return {
    title: `Best team for ${post.mapName}`,
    description:
      `Run ${best} on ${post.mapName} (${post.modeName}) in Ranked. ` +
      `${pct(post.trios[0].winRate)} adjusted win rate over ${post.trios[0].battles} games, plus two backups. ` +
      `A different map every day. Every map at ${site}/ranked ` +
      '#brawlstars #brawlstarsranked #brawlstarstips #brawlstarsteam #brawlstarsmeta',
  };
}

/* ----------------------------------------------------------------- patch */

export const PATCH_SLIDES = 4;

type PatchRow = PatchPost['winners'][number];

function patchCover(post: PatchPost, faces: Map<number, string | null>): ReactElement {
  const up = post.winners[0];
  const down = post.losers[0];
  return (
    <Stage glow="#ffb000">
      <div style={{ display: 'flex', marginTop: 10 }}>
        <Ribbon>BALANCE UPDATE</Ribbon>
      </div>
      <div style={{ display: 'flex', marginTop: 30 }}>
        <Title size={112}>Who really got stronger?</Title>
      </div>
      <div style={{ display: 'flex', marginTop: 16 }}>
        <Note size={36} color={FG}>
          {`A week after the ${new Date(`${post.updateDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} update, measured in Ranked`}
        </Note>
      </div>
      <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        {[up, down].map((r, i) =>
          r ? (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 400 }}>
              <Portrait src={faces.get(r.brawlerId) ?? null} size={300} ring={i === 0 ? GREEN : RED} />
              <div style={{ display: 'flex', marginTop: 22 }}>
                <Title size={54} align="center">
                  {cap(r.name)}
                </Title>
              </div>
              <div style={{ display: 'flex', marginTop: 8 }}>
                <Title size={72} color={i === 0 ? GREEN : RED} align="center">
                  {`${r.delta >= 0 ? '+' : '−'}${Math.abs(r.delta).toFixed(1)}`}
                </Title>
              </div>
              <Note size={28} align="center">
                win-rate points
              </Note>
            </div>
          ) : (
            <div key={i} style={{ display: 'flex', width: 400 }} />
          ),
        )}
      </div>
    </Stage>
  );
}

function patchRows(rows: PatchRow[], up: boolean, faces: Map<number, string | null>): ReactElement {
  return (
    <Stage glow={up ? '#1fbf6b' : '#ff3b5c'}>
      <div style={{ display: 'flex', marginTop: 10 }}>
        {up ? (
          <Ribbon color={GREEN} depth="#167a45">
            WINNERS
          </Ribbon>
        ) : (
          <Ribbon color={RED} depth="#9c1d36" ink={FG}>
            LOSERS
          </Ribbon>
        )}
      </div>
      <div style={{ display: 'flex', marginTop: 28 }}>
        <Title size={84}>{up ? 'Climbed after the update' : 'Dropped after the update'}</Title>
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <Note size={30}>Ranked win rate, the two weeks before vs the week after</Note>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 34 }}>
        {rows.map((r) => (
          <Panel key={r.brawlerId} column={false} gap={22} pad="12px 24px 12px 16px">
            <Portrait src={faces.get(r.brawlerId) ?? null} size={118} radius={26} ring={up ? GREEN : RED} />
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              <div style={{ display: 'flex', fontSize: 50, color: FG, WebkitTextStroke: `2px ${OUTLINE}` }}>
                {cap(r.name)}
              </div>
              <div style={{ display: 'flex', fontSize: 28, color: MUTED }}>{`${pct(r.before)} → ${pct(r.after)}`}</div>
            </div>
            <div style={{ display: 'flex', fontSize: 64, color: up ? GREEN : RED, WebkitTextStroke: `3px ${OUTLINE}` }}>
              {`${r.delta >= 0 ? '+' : '−'}${Math.abs(r.delta).toFixed(1)}`}
            </div>
          </Panel>
        ))}
      </div>
    </Stage>
  );
}

export async function patchSlides(post: PatchPost, only?: number): Promise<ReactElement[]> {
  const want = (i: number) => only === undefined || only === i;
  const ids = [...new Set([...post.winners, ...post.losers].map((r) => r.brawlerId))];
  const faces = new Map(await Promise.all(ids.map(async (id) => [id, await face(id, 300)] as const)));
  const slides: ReactElement[] = [];
  if (want(0)) slides[0] = patchCover(post, faces);
  if (want(1)) slides[1] = patchRows(post.winners, true, faces);
  if (want(2)) slides[2] = patchRows(post.losers, false, faces);
  if (want(3)) {
    slides[3] = <Outro logo={await loadLogo(240)} line="Every update, measured, on brawlzone.net/patches." />;
  }
  return slides;
}

export function patchCaption(post: PatchPost, site: string): { title: string; description: string } {
  const up = post.winners.slice(0, 2).map((r) => cap(r.name));
  const down = post.losers.slice(0, 2).map((r) => cap(r.name));
  return {
    title: 'Balance update: who really got stronger?',
    description:
      `A week after the update, measured in Ranked: ${up.join(' and ')} climbed` +
      (down.length ? `, ${down.join(' and ')} dropped` : '') +
      `. Win rates before vs after, from real battles. Full scoreboard at ${site}/patches ` +
      '#brawlstars #brawlstarsupdate #brawlstarsbalance #brawlstarsmeta #brawlstarsranked',
  };
}
