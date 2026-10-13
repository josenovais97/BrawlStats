import type { ReactElement } from 'react';

import { brawlerPortraitUrl } from '@/lib/brawlapi';
import { getBrawlerCatalog } from '@/lib/brawler-catalog';
import { titleCase } from '@/lib/format';
import type { MapPost } from '@/lib/map-of-day';
import { loadIcon, loadLogo, loadSized } from '@/lib/slide-chrome';
import {
  FG,
  GOLD,
  GREEN,
  INNER_W,
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
import { getRankedComps } from '@/lib/stats';

export { SLIDE_SIZE, slideFonts, toJpeg } from '@/lib/slide-chrome';

/**
 * Map of the day, second generation (2026-10-13): four slides.
 *
 * 1. The cover shows the answer: the map and its top three, so the post is
 *    worth something to a viewer who never swipes.
 * 2. The top ten, big enough to read on a phone.
 * 3. The best trio on the map, which no other post covers.
 * 4. Where to get it live.
 */

const cap = (name: string) => titleCase(name);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const points = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(1)}`;

export const MAP_V2_SLIDES = 4;

export interface MapTrio {
  brawlers: { id: number; name: string }[];
  winRate: number;
  battles: number;
}

/** The best Ranked trios on the map, or the mode's when the map has none. */
export async function mapTrios(post: MapPost): Promise<{ trios: MapTrio[]; onMap: boolean }> {
  const [comps, catalog] = await Promise.all([
    getRankedComps().catch(() => ({ maps: [], modes: [] })),
    getBrawlerCatalog().catch(() => null),
  ]);
  const own = comps.maps.find((m) => m.mode === post.mode && m.mapName === post.mapName);
  const list = own?.comps ?? comps.modes.find((m) => m.mode === post.mode)?.comps ?? [];
  const names = new Map<number, string>(post.picks.map((p) => [p.brawlerId, p.name]));
  for (const b of catalog?.all ?? []) if (!names.has(b.id)) names.set(b.id, b.name);
  return {
    onMap: Boolean(own),
    // The adjusted rate, which is what the list is ordered by: a 66-game trio
    // at a raw 77% is shrunk toward the map's average before it is shown, so
    // the order on the slide is the order of the numbers on it.
    trios: list.slice(0, 3).map((c) => ({
      brawlers: c.brawlerIds.map((id) => ({ id, name: names.get(id) ?? `#${id}` })),
      winRate: c.normalizedWinRate ?? c.winRate,
      battles: c.battles,
    })),
  };
}

function ModeChip({ post, icon }: { post: MapPost; icon: string | null }): ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: 14,
        padding: '8px 26px 10px 10px',
        borderRadius: 999,
        background: `${post.modeColor}`,
        border: `5px solid ${OUTLINE}`,
        boxShadow: `0 7px 0 ${OUTLINE}`,
      }}
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} width={64} height={64} alt="" />
      ) : (
        <div style={{ display: 'flex', width: 10 }} />
      )}
      <div style={{ display: 'flex', fontSize: 44, color: FG, WebkitTextStroke: `3px ${OUTLINE}` }}>
        {post.modeName}
      </div>
    </div>
  );
}

function cover(
  post: MapPost,
  icon: string | null,
  mapArt: { src: string; width: number; height: number } | null,
  heroes: (string | null)[],
): ReactElement {
  const top = post.picks.slice(0, 3);
  // Podium order: second, first, third.
  const order = [1, 0, 2].filter((i) => top[i]);
  return (
    <Stage glow={post.modeColor}>
      <div style={{ display: 'flex', marginTop: 10 }}>
        <Ribbon>MAP OF THE DAY</Ribbon>
      </div>
      <div style={{ display: 'flex', marginTop: 34 }}>
        <Title size={post.mapName.length > 13 ? 104 : 128}>{post.mapName}</Title>
      </div>
      <div style={{ display: 'flex', marginTop: 22 }}>
        <ModeChip post={post} icon={icon} />
      </div>

      <div style={{ display: 'flex', position: 'relative', flexGrow: 1, marginTop: 30 }}>
        {mapArt ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 10,
              display: 'flex',
              transform: 'rotate(5deg)',
              borderRadius: 26,
              border: `6px solid ${OUTLINE}`,
              boxShadow: `0 14px 0 ${OUTLINE}`,
              overflow: 'hidden',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mapArt.src} width={mapArt.width} height={mapArt.height} alt="" />
          </div>
        ) : (
          <div style={{ display: 'flex' }} />
        )}

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: INNER_W,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          {order.map((i) => {
            const p = top[i];
            const first = i === 0;
            const size = first ? 290 : 240;
            return (
              <div key={p.brawlerId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 280 }}>
                <div style={{ display: 'flex', position: 'relative' }}>
                  <Portrait src={heroes[i]} size={size} ring={i === 0 ? GOLD : i === 1 ? '#d7def0' : '#e0975a'} />
                  <div style={{ position: 'absolute', top: -26, left: -20, display: 'flex' }}>
                    <RankCoin n={i + 1} size={first ? 84 : 70} />
                  </div>
                </div>
                <div style={{ display: 'flex', marginTop: 22 }}>
                  <Title size={first ? 52 : 44} align="center">
                    {cap(p.name)}
                  </Title>
                </div>
                <div style={{ display: 'flex', marginTop: 6 }}>
                  <Title size={first ? 50 : 42} color={first ? GOLD : SKY} align="center">
                    {pct(p.score)}
                  </Title>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
}

function topTen(post: MapPost, icon: string | null, faces: (string | null)[]): ReactElement {
  return (
    <Stage glow={post.modeColor} brand={false}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} width={88} height={88} alt="" />
        ) : (
          <div style={{ display: 'flex' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1 }}>
          <Title size={post.mapName.length > 12 ? 54 : 66}>{post.mapName}</Title>
          <div style={{ display: 'flex', marginTop: 6 }}>
            <Note size={26}>{`Top 10 in Ranked · ${post.sampleSize.toLocaleString('en-GB')} games`}</Note>
          </div>
        </div>
        <BrandTag inline />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 16 }}>
        {post.picks.map((p, i) => (
          <Panel key={p.brawlerId} column={false} gap={20} pad="4px 22px 4px 14px" accent={i === 0 ? GOLD : undefined}>
            <RankCoin n={i + 1} size={56} />
            <Portrait src={faces[i]} size={76} radius={18} />
            <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
              <div style={{ display: 'flex', fontSize: 42, color: FG, WebkitTextStroke: `2px ${OUTLINE}` }}>
                {cap(p.name)}
              </div>
              <div style={{ display: 'flex', fontSize: 23, color: MUTED }}>
                {`${p.battles.toLocaleString('en-GB')} games here`}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div style={{ display: 'flex', fontSize: 44, color: i === 0 ? GOLD : FG, WebkitTextStroke: `2px ${OUTLINE}` }}>
                {pct(p.score)}
              </div>
              <Tag size={20} color={p.edge >= 0 ? GREEN : RED}>
                {`${points(p.edge)} vs usual`}
              </Tag>
            </div>
          </Panel>
        ))}
      </div>
    </Stage>
  );
}

function trioSlide(
  post: MapPost,
  trios: MapTrio[],
  onMap: boolean,
  faces: Map<number, string | null>,
): ReactElement {
  const [best, ...rest] = trios;
  return (
    <Stage glow={post.modeColor}>
      <div style={{ display: 'flex', marginTop: 10 }}>
        <Ribbon color={SKY} depth="#1c6f99">
          BEST TEAM HERE
        </Ribbon>
      </div>
      <div style={{ display: 'flex', marginTop: 30 }}>
        <Title size={78}>{onMap ? post.mapName : `Best trio in ${post.modeName}`}</Title>
      </div>
      <div style={{ display: 'flex', marginTop: 8 }}>
        <Note size={30}>
          {onMap
            ? 'The three that win most together on this map in Ranked'
            : `Not enough trios on ${post.mapName} yet, so this is the mode's best`}
        </Note>
      </div>

      {best ? (
        <div style={{ display: 'flex', marginTop: 40 }}>
          <Panel accent={GOLD} pad="34px 30px" gap={24}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {best.brawlers.map((b) => (
                <div key={b.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 250 }}>
                  <Portrait src={faces.get(b.id) ?? null} size={236} ring={GOLD} />
                  <div style={{ display: 'flex', marginTop: 18 }}>
                    <Title size={44} align="center">
                      {cap(b.name)}
                    </Title>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 18, marginTop: 10 }}>
              <Title size={96} color={GOLD}>
                {pct(best.winRate)}
              </Title>
              <div style={{ display: 'flex', marginBottom: 14 }}>
                <Note size={34} color={FG}>{`adjusted win rate · ${best.battles.toLocaleString('en-GB')} games`}</Note>
              </div>
            </div>
          </Panel>
        </div>
      ) : (
        <div style={{ display: 'flex', marginTop: 60 }}>
          <Note size={40}>Not enough Ranked trios here yet.</Note>
        </div>
      )}

      {rest.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 40 }}>
          <Note size={30}>Also strong here</Note>
          {rest.map((t, i) => (
            <Panel key={i} column={false} gap={18} pad="18px 24px">
              {t.brawlers.map((b) => (
                <Portrait key={b.id} src={faces.get(b.id) ?? null} size={128} radius={26} />
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexGrow: 1 }}>
                <div style={{ display: 'flex', fontSize: 60, color: FG, WebkitTextStroke: `3px ${OUTLINE}` }}>
                  {pct(t.winRate)}
                </div>
                <div style={{ display: 'flex', fontSize: 28, color: MUTED }}>{`${t.battles} games`}</div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex' }} />
      )}
    </Stage>
  );
}

/** Every slide, or only slide `only`, with just that slide's art fetched. */
export async function mapSlidesV2(post: MapPost, only?: number): Promise<ReactElement[]> {
  const want = (i: number) => only === undefined || only === i;
  const icon = post.modeIconUrl && (want(0) || want(1)) ? await loadIcon(post.modeIconUrl, 120) : null;
  const face = (id: number, box: number) => loadIcon(brawlerPortraitUrl(id), box);

  const slides: ReactElement[] = [];
  if (want(0)) {
    const [mapArt, ...heroes] = await Promise.all([
      post.mapArtUrl ? loadSized(post.mapArtUrl, 560, 700) : Promise.resolve(null),
      ...post.picks.slice(0, 3).map((p) => face(p.brawlerId, 300)),
    ]);
    slides[0] = cover(post, icon, mapArt, heroes);
  }
  if (want(1)) {
    const faces = await Promise.all(post.picks.map((p) => face(p.brawlerId, 96)));
    slides[1] = topTen(post, icon, faces);
  }
  if (want(2)) {
    const { trios, onMap } = await mapTrios(post);
    const ids = [...new Set(trios.flatMap((t) => t.brawlers.map((b) => b.id)))];
    const faces = new Map(await Promise.all(ids.map(async (id) => [id, await face(id, 230)] as const)));
    slides[2] = trioSlide(post, trios, onMap, faces);
  }
  if (want(3)) {
    slides[3] = (
      <Outro
        logo={await loadLogo(240)}
        line={`Every Ranked map, ranked like ${post.mapName}, floating over your game.`}
      />
    );
  }
  return slides;
}
