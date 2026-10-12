/**
 * The Discord server's scheduled posts, one job per run:
 *
 *   daily    — today's live maps, each with its best picks       (#📈-meta-updates, @Map pings)
 *   botd     — brawler of the day: tier, numbers and build        (#⚖️-tier-talk)
 *   weekly   — Monday report: the top 10 and the best trio a mode (#📈-meta-updates, @Meta pings)
 *   welcome  — the pinned welcome post, created or edited in place (#👋-welcome)
 *
 * Every job also checks for a Bubble app release nobody has announced yet and
 * posts it to #📱-bubble-app (@App updates). Releases are only ever announced
 * from here, so the check is "is there a message for this version in that
 * channel" -- Discord itself is the record of what was posted, which keeps this
 * free of a state table and makes a re-run harmless.
 *
 * Channels and roles are found by name, so renaming one in Discord means
 * changing it here too.
 *
 *   node --import tsx --conditions=react-server scripts/discord-auto-post.ts daily
 *
 * No top-level await: tsx compiles this to CommonJS (see discord-meta-post.ts).
 */
import { fullBodyArt } from '@/lib/brawler-art';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { BUBBLE_APP, BUBBLE_CHANGELOG } from '@/lib/bubble-app';
import { getEventRotation, getOfficialBrawlers } from '@/lib/bs-api';
import { formatPercent, humanizeMode, titleCase } from '@/lib/format';
import { brawlerPath, slugify } from '@/lib/slugs';
import {
  RANKED_MAP_WINDOW_DAYS,
  getBestPicksByMode,
  getBrawlerBuild,
  getBrawlerStatsForWindow,
  getRankedComps,
  getRankedMapPicks,
  getSkillEdge,
  resolveDataMapName,
  scoreBrawlers,
} from '@/lib/stats';

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? '';
const GUILD = process.env.DISCORD_GUILD_ID ?? '';
const API = 'https://discord.com/api/v10';
const SITE = 'https://brawlzone.net';
const BRAND = 0xffc93c;

type Embed = Record<string, unknown>;

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bot ${TOKEN}`,
        'content-type': 'application/json',
        'user-agent': 'BrawlZone (https://brawlzone.net, 1.0)',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429 && attempt < 4) {
      const wait = Number(((await res.json()) as { retry_after?: number }).retry_after ?? 1);
      await new Promise((r) => setTimeout(r, wait * 1000 + 250));
      continue;
    }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
    return (res.status === 204 ? {} : await res.json()) as T;
  }
}

interface Guild {
  channels: Map<string, string>;
  roles: Map<string, string>;
  emojis: Map<string, string>;
}

async function guild(): Promise<Guild> {
  const [channels, roles, emojis] = await Promise.all([
    call<{ id: string; name: string }[]>('GET', `/guilds/${GUILD}/channels`),
    call<{ id: string; name: string }[]>('GET', `/guilds/${GUILD}/roles`),
    call<{ id: string; name: string }[]>('GET', `/guilds/${GUILD}/emojis`),
  ]);
  return {
    channels: new Map(channels.map((c) => [c.name, c.id])),
    roles: new Map(roles.map((r) => [r.name, r.id])),
    emojis: new Map(emojis.map((e) => [e.name, `<:${e.name}:${e.id}>`])),
  };
}

function channel(g: Guild, name: string): string {
  const id = g.channels.get(name);
  if (!id) throw new Error(`channel #${name} not found`);
  return id;
}

async function post(channelId: string, body: { content?: string; embeds?: Embed[]; components?: unknown[] }, pingRole?: string) {
  return call<{ id: string }>('POST', `/channels/${channelId}/messages`, {
    ...body,
    content: [pingRole ? `<@&${pingRole}>` : null, body.content].filter(Boolean).join(' ') || undefined,
    allowed_mentions: { parse: [], roles: pingRole ? [pingRole] : [] },
  });
}

/** Announcement channels: publish so servers following it get the post too. */
async function publish(channelId: string, messageId: string) {
  await call('POST', `/channels/${channelId}/messages/${messageId}/crosspost`).catch(() => undefined);
}

function buttons(...links: [string, string][]) {
  return [{ type: 1, components: links.map(([label, url]) => ({ type: 2, style: 5, label, url })) }];
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : formatPercent(v));
const name = (s: string) => titleCase(s.toLowerCase());
function modeIcon(g: Guild, mode: string): string {
  const key = /showdown/i.test(mode) ? 'showdown' : slugify(mode).replace(/-/g, '');
  return g.emojis.get(`mode_${key}`) ?? '•';
}

/* ------------------------------------------------------------- bubble app */

async function bubbleRelease(g: Guild): Promise<string> {
  const id = channel(g, '📱-bubble-app');
  const marker = `v${BUBBLE_APP.version}`;
  const recent = await call<{ embeds?: { title?: string }[] }[]>('GET', `/channels/${id}/messages?limit=50`);
  if (recent.some((m) => m.embeds?.some((e) => e.title?.includes(marker)))) return `Bubble ${marker} already announced`;

  const release = BUBBLE_CHANGELOG.find((r) => r.version === BUBBLE_APP.version);
  const msg = await post(
    id,
    {
      embeds: [
        {
          title: `📱 BrawlZone Bubble ${marker} is out`,
          url: `${SITE}/bubble`,
          color: 0x35d07f,
          description: [
            '**What’s new**',
            ...(release?.changes ?? ['Fixes and improvements.']).map((c) => `• ${c}`),
            '',
            'The Bubble floats over Brawl Stars: tap it during the draft for the meta, team comps and counters for the map you are on.',
          ].join('\n'),
          thumbnail: { url: `${SITE}/icons/bubble-app.png` },
          footer: { text: `Android · free · ${release?.date ?? ''}`.trim() },
        },
      ],
      components: buttons(
        ['Download', `${SITE}/bubble`],
        ...(BUBBLE_APP.storeUrl ? [[`Also on ${BUBBLE_APP.storeName ?? 'the store'}`, BUBBLE_APP.storeUrl] as [string, string]] : []),
      ),
    },
    g.roles.get('App updates'),
  );
  await publish(id, msg.id);
  return `Posted Bubble ${marker}`;
}

/* ------------------------------------------------------------------ daily */

function gameTime(value: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(value);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN;
}

async function daily(g: Guild): Promise<string> {
  const now = Date.now();
  const slots = (await getEventRotation()).filter(
    (s) => s.event.map && gameTime(s.startTime) <= now && gameTime(s.endTime) > now,
  );
  if (!slots.length) return 'Rotation empty; nothing posted';

  // The map pages' order: the map's own picks under the battle data's spelling
  // of its name, else the mode's -- a weaker answer, but a real one.
  const byMode = await getBestPicksByMode(3).catch(() => new Map());
  const fields: Embed[] = [];
  for (const s of slots.slice(0, 12)) {
    const dataName = await resolveDataMapName(s.event.mode, s.event.map!).catch(() => s.event.map!);
    const mapPicks = await getRankedMapPicks(3, RANKED_MAP_WINDOW_DAYS, { mapName: dataName, mode: s.event.mode })
      .then((m) => m[0]?.picks ?? [])
      .catch(() => []);
    const modePicks: { brawlerName: string }[] = byMode.get(s.event.mode)?.picks ?? [];
    const line = mapPicks.length
      ? mapPicks.map((p) => name(p.brawlerName)).join(' · ')
      : modePicks.length
        ? `${modePicks.slice(0, 3).map((p) => name(p.brawlerName)).join(' · ')}\n-# best in the mode; new map`
        : '-# not enough data yet';
    fields.push({
      name: `${humanizeMode(s.event.mode)} · ${s.event.map}`,
      value: `${modeIcon(g, s.event.mode)} ${line}`,
      inline: true,
    });
  }
  const id = channel(g, '📈-meta-updates');
  await post(
    id,
    {
      embeds: [
        {
          title: '🗺️ Today’s maps and what to pick',
          url: `${SITE}/events`,
          color: BRAND,
          description: 'Every live map with the three brawlers winning most on it, from sampled battles.',
          fields,
          footer: { text: 'brawlzone.net · or tap the Bubble mid-draft' },
        },
      ],
      components: buttons(['Live events', `${SITE}/events`], ['Draft helper', `${SITE}/draft`]),
    },
    g.roles.get('Map pings'),
  );
  return `Posted today's maps (${fields.length})`;
}

/* ------------------------------------------------------------------- botd */

async function botd(g: Guild): Promise<string> {
  const [rows, edges, meta] = await Promise.all([
    getBrawlerStatsForWindow(7, undefined, 'ranked'),
    getSkillEdge('ranked').catch(() => undefined),
    getBrawlerArtMap(),
  ]);
  // Only brawlers worth playing right now: a C-tier pick with a 0.2% pick rate
  // is a dull post, and the point is "try this today".
  const rated = scoreBrawlers(rows, 'ranked', edges)
    .filter((e) => e.tier === 'S' || e.tier === 'A')
    .sort((a, b) => a.brawlerId - b.brawlerId);
  if (!rated.length) return 'No S or A tier brawlers; nothing posted';

  // A different brawler each day, cycling the strong ones in order.
  const day = Math.floor(Date.now() / 86_400_000);
  const pick = rated[day % rated.length];
  const b = meta.get(pick.brawlerId);
  const [build, official, art] = await Promise.all([
    getBrawlerBuild(pick.brawlerId).catch(() => null),
    getOfficialBrawlers()
      .then((r) => r.items.find((x) => x.id === pick.brawlerId))
      .catch(() => undefined),
    fullBodyArt(pick.brawlerId, pick.brawlerName, b?.imageUrl).catch(() => b?.imageUrl),
  ]);
  const label = (list: { id: number; name: string }[] | undefined, id: number) =>
    name(list?.find((x) => x.id === id)?.name ?? `#${id}`);
  const buildLines = build
    ? [
        build.starPowers[0] && `⭐ ${label(official?.starPowers, build.starPowers[0].itemId)} · ${pct(build.starPowers[0].share)}`,
        build.gadgets[0] && `🔧 ${label(official?.gadgets, build.gadgets[0].itemId)} · ${pct(build.gadgets[0].share)}`,
        ...build.gears.slice(0, 2).map((x) => `⚙️ ${label(official?.gears, x.itemId)} · ${pct(x.share)}`),
      ].filter(Boolean)
    : [];
  const href = `${SITE}${brawlerPath(pick.brawlerId, pick.brawlerName)}`;
  await post(channel(g, '⚖️-tier-talk'), {
    embeds: [
      {
        title: `🌟 Brawler of the day: ${name(pick.brawlerName)}`,
        url: href,
        color: parseInt((b?.rarity?.color ?? '#ffc93c').replace('#', ''), 16) || BRAND,
        description: `**${pick.tier} tier** in Ranked this week · meta score **${pick.metaScore?.toFixed(1)}/10**\nIs it right? Argue below 👇`,
        fields: [
          { name: 'Win rate', value: pct(pick.normalizedWinRate), inline: true },
          { name: 'Pick rate', value: pct(pick.usageRate), inline: true },
          ...(buildLines.length ? [{ name: 'The build owners run', value: buildLines.join('\n') }] : []),
        ],
        ...(art ? { image: { url: art } } : {}),
        footer: { text: 'brawlzone.net · /brawler for any brawler, any time' },
      },
    ],
    components: buttons(['Build & matchups', href]),
  });
  return `Posted brawler of the day: ${pick.brawlerName}`;
}

/* ----------------------------------------------------------------- weekly */

async function weekly(g: Guild): Promise<string> {
  const [rows, edges, comps, meta] = await Promise.all([
    getBrawlerStatsForWindow(7, undefined, 'ranked'),
    getSkillEdge('ranked').catch(() => undefined),
    getRankedComps().catch(() => ({ maps: [], modes: [] })),
    getBrawlerArtMap(),
  ]);
  const top = scoreBrawlers(rows, 'ranked', edges)
    .filter((e) => e.tier !== null)
    .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
    .slice(0, 10);
  if (!top.length) return 'No rated brawlers; nothing posted';
  const nameOf = (id: number) => name(meta.get(id)?.name ?? `#${id}`);
  const medal = ['🥇', '🥈', '🥉'];
  const trios = comps.modes
    .filter((m) => m.comps.length)
    .map((m) => `${modeIcon(g, m.mode)} **${humanizeMode(m.mode)}** — ${m.comps[0].brawlerIds.map(nameOf).join(' · ')} · ${pct(m.comps[0].winRate)}`);

  const id = channel(g, '📈-meta-updates');
  await post(
    id,
    {
      embeds: [
        {
          title: '📊 Weekly Ranked report',
          url: `${SITE}/tier-list/ranked`,
          color: BRAND,
          description: top
            .map((b, i) => `${medal[i] ?? `**${i + 1}.**`} \`${b.tier}\` **${name(b.brawlerName)}** · ${b.metaScore?.toFixed(1)} · ${pct(b.normalizedWinRate)} win`)
            .join('\n'),
          fields: trios.length ? [{ name: 'Best trio in each mode', value: trios.join('\n') }] : [],
          footer: { text: 'brawlzone.net · last 7 days of sampled Ranked battles' },
        },
      ],
      components: buttons(['Tier list', `${SITE}/tier-list/ranked`], ['Team comps in the Bubble', `${SITE}/bubble`]),
    },
    g.roles.get('Meta pings'),
  );
  return `Posted weekly report (${top.length} brawlers, ${trios.length} modes)`;
}

/* ---------------------------------------------------------------- welcome */

async function welcome(g: Guild): Promise<string> {
  const id = channel(g, '👋-welcome');
  const ch = (n: string) => (g.channels.get(n) ? `<#${g.channels.get(n)}>` : `#${n}`);
  const e = (n: string) => g.emojis.get(n) ?? '';
  const body = {
    embeds: [
      {
        title: 'Welcome to Brawl Zone 👋',
        url: SITE,
        color: BRAND,
        description: [
          'The community behind **brawlzone.net**: Brawl Stars tier lists, drafts and player stats built from real sampled battles, not opinions.',
          '',
          `**Start here**`,
          `${e('trophy')} Type \`/link your-tag\` — your trophy and rank roles are set from your real account.`,
          `${e('rank_masters')} Then \`/profile\` shows your card: trophies, Ranked rank, skill score and mains.`,
        ].join('\n'),
        fields: [
          {
            name: 'Where things are',
            value: [
              `${ch('📈-meta-updates')} — daily maps, meta moves, weekly report`,
              `${ch('⚖️-tier-talk')} — brawler of the day and tier debates`,
              `${ch('🎯-draft-help')} — ask what to pick`,
              `${ch('🔍-profile-reviews')} — get your account reviewed`,
              `${ch('🤝-looking-for-team')} — find people to play Ranked with`,
              `${ch('📱-bubble-app')} — Bubble app releases`,
              `${ch('💡-suggestions')} — ideas, bugs and feedback`,
            ].join('\n'),
          },
          {
            name: 'Bot commands',
            value: [
              '`/brawler` tier, win rate and build',
              '`/map` best picks and trios on a map',
              '`/draft` what to pick against their team',
              '`/meta` the Ranked top 10 · `/rotation` live maps',
              '`/compare` brawler vs brawler · `/leaderboard` top 10',
              '`/help` the full list',
            ].join('\n'),
          },
          {
            name: 'The Bubble app',
            value: 'A floating bubble over Brawl Stars with the meta, team comps and counters for the map you are drafting. Free for Android.',
          },
        ],
        footer: { text: 'Brawl Zone is a fan community, not affiliated with Supercell.' },
      },
    ],
    components: buttons(['brawlzone.net', SITE], ['Get the Bubble app', `${SITE}/bubble`], ['Make a suggestion', `https://discord.com/channels/${GUILD}/${g.channels.get('💡-suggestions') ?? ''}`]),
  };

  const me = await call<{ id: string }>('GET', '/users/@me');
  const recent = await call<{ id: string; author: { id: string }; embeds?: { title?: string }[] }[]>(
    'GET',
    `/channels/${id}/messages?limit=50`,
  );
  const mine = recent.find((m) => m.author.id === me.id && m.embeds?.some((x) => x.title?.startsWith('Welcome to Brawl Zone')));
  if (mine) {
    await call('PATCH', `/channels/${id}/messages/${mine.id}`, body);
    return 'Updated the welcome post';
  }
  const msg = await post(id, body);
  await call('PUT', `/channels/${id}/pins/${msg.id}`).catch(() => undefined);
  return 'Posted and pinned the welcome post';
}

/* -------------------------------------------------------------------- run */

const JOBS: Record<string, (g: Guild) => Promise<string>> = { daily, botd, weekly, welcome, bubble: bubbleRelease };

async function main(): Promise<void> {
  const job = process.argv[2] ?? '';
  if (!TOKEN || !GUILD) {
    console.error('DISCORD_BOT_TOKEN or DISCORD_GUILD_ID is not set; nothing to post to.');
    process.exitCode = 1;
    return;
  }
  if (!JOBS[job]) {
    console.error(`Unknown job "${job}". One of: ${Object.keys(JOBS).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const g = await guild();
  let failed = false;
  for (const run of job === 'bubble' ? [bubbleRelease] : [JOBS[job], bubbleRelease]) {
    try {
      console.log(`Posted: ${await run(g)}`);
    } catch (error) {
      failed = true;
      console.error(`Failed: ${run.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed) process.exitCode = 1;
}

void main();
