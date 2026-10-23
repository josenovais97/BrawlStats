import { after } from 'next/server';

import {
  brawlerPortraitUrl,
  getMaps,
  playerIconUrl,
} from '@/lib/brawlapi';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';
import { brawldleRoster } from '@/lib/brawldle-data';
import { pictureAnswer } from '@/lib/brawldle-picture';
import { tallyBucket } from '@/lib/brawldle-tally';
import {
  DAILY_TRIES,
  type DailyMode,
  type DailyRef,
  dailyNumber,
  decodeDaily,
  encodeDaily,
  hearts,
  squares,
} from '@/lib/discord-daily';
import { getEventRotation, getOfficialBrawlers, getPlayer, getPlayerRankings } from '@/lib/bs-api';
import { comparePath } from '@/lib/compare';
import { bracketBySlug } from '@/lib/rank-brackets';
import { verifyDiscordRequest } from '@/lib/discord-verify';
import { formatNumber, formatPercent, humanizeMode, titleCase } from '@/lib/format';
import { mains } from '@/lib/player-showcase';
import { getPrisma } from '@/lib/prisma';
import { computeSkillScore } from '@/lib/skill-score';
import { brawlerPath, slugify } from '@/lib/slugs';
import {
  RANKED_MAP_WINDOW_DAYS,
  assignTierFromScore,
  getAllyScores,
  getBrawlerBuild,
  getBrawlerStat,
  getBrawlerStatsForWindow,
  getCounterScores,
  getRankedComps,
  getRankedCounterScores,
  getRankedMapPicks,
  getSkillEdge,
  mapNameKey,
  metaScore,
  normalizeWinRate,
  scoreBrawlers,
} from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';
import type { BABrawler } from '@/types/brawlapi';
import type { BSPlayer } from '@/types/brawlstars';

/**
 * Slash commands, over HTTP rather than a gateway connection.
 *
 * Discord POSTs each interaction here instead of this box holding a WebSocket
 * open forever: on two shared cores a gateway client is a process to keep
 * alive and supervise, and it buys nothing for commands.
 *
 * Commands defer first (Discord allows three seconds and a cold player lookup
 * can take longer) and finish in `after()`, editing the reply in place.
 * Autocomplete cannot defer, so it answers inline from cached reads only.
 *
 * Every number comes from the same functions the website uses, so the bot and
 * the site can never disagree.
 */

export const dynamic = 'force-dynamic';

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY ?? '';
const APP_ID = process.env.DISCORD_APP_ID ?? '';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? '';
const GUILD_ID = process.env.DISCORD_GUILD_ID ?? '';
const SITE = 'https://brawlzone.net';
const BRAND = 0xffc93c;
const API = 'https://discord.com/api/v10';
const SERVER_INVITE = 'https://discord.gg/964EMQBBUJ';
/** Discord's own chooser: add to a server, or to your account. */
const INSTALL_URL = `https://discord.com/oauth2/authorize?client_id=${APP_ID}`;

type Embed = Record<string, unknown>;
interface Reply {
  content?: string;
  embeds?: Embed[];
  components?: unknown[];
}

/* ----------------------------------------------------------------- plumbing */

/** Edits the deferred reply. The token is valid for 15 minutes. */
async function respond(token: string, body: Reply) {
  await fetch(`${API}/webhooks/${APP_ID}/${token}/messages/@original`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, ...body }),
    cache: 'no-store',
  }).catch(() => undefined);
}

async function bot(method: string, path: string, body?: unknown) {
  return fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bot ${BOT_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'BrawlZone (https://brawlzone.net, 1.0)',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
}

/** Link buttons under a reply: the site is where the detail lives. */
function buttons(...links: [string, string][]) {
  return [
    {
      type: 1,
      components: links.slice(0, 5).map(([label, url]) => ({ type: 2, style: 5, label, url })),
    },
  ];
}

interface Option {
  name: string;
  value?: string | number;
  focused?: boolean;
}

function opt(options: unknown, name: string): string | undefined {
  if (!Array.isArray(options)) return undefined;
  const hit = (options as Option[]).find((o) => o.name === name);
  return hit?.value === undefined ? undefined : String(hit.value);
}

/** The server's custom emojis by name, rendered inline. Cached for half an hour. */
let emojiCache: { at: number; byName: Map<string, string> } | null = null;
async function emojis(): Promise<Map<string, string>> {
  if (emojiCache && Date.now() - emojiCache.at < 30 * 60_000) return emojiCache.byName;
  const byName = new Map<string, string>();
  try {
    const res = await bot('GET', `/guilds/${GUILD_ID}/emojis`);
    if (res.ok) {
      for (const e of (await res.json()) as { id: string; name: string }[]) byName.set(e.name, `<:${e.name}:${e.id}>`);
    }
  } catch {
    /* Plain text instead of icons; never a failed command. */
  }
  emojiCache = { at: Date.now(), byName };
  return byName;
}

/* -------------------------------------------------------------- name lookup */

async function findBrawler(query: string): Promise<BABrawler | null> {
  const map = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());
  const asId = Number(query);
  if (Number.isInteger(asId) && map.has(asId)) return map.get(asId)!;
  const needle = query.trim().toLowerCase();
  const all = [...map.values()];
  return (
    all.find((b) => b.name.toLowerCase() === needle) ??
    all.find((b) => b.name.toLowerCase().startsWith(needle)) ??
    all.find((b) => b.name.toLowerCase().includes(needle)) ??
    null
  );
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : formatPercent(v));
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}`;

/** "MASTERS II" -> "Masters"; the rank roles and emojis are per league. */
function league(rankName: string | undefined | null): string | null {
  const word = rankName?.trim().split(/\s+/)[0];
  if (!word) return null;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function rankLine(e: Map<string, string>, rankName?: string, elo?: number) {
  if (!rankName) return 'Not ranked yet';
  const l = league(rankName);
  const icon = l ? (e.get(`rank_${l.toLowerCase()}`) ?? '') : '';
  return `${icon} **${titleCase(rankName.toLowerCase())}**${elo ? ` · ${formatNumber(elo)} elo` : ''}`.trim();
}

/** Ten blocks for a score out of ten, so it reads at a glance. */
const bar = (score: number) => '▰'.repeat(Math.round(score)) + '▱'.repeat(10 - Math.round(score));

/* ---------------------------------------------------------------- /profile */

async function linkedTag(userId: string): Promise<string | null> {
  const prisma = getPrisma();
  if (!prisma || !userId) return null;
  const row = await prisma.discordLink.findUnique({ where: { discordUserId: userId } }).catch(() => null);
  return row?.playerTag ?? null;
}

function profileEmbed(player: BSPlayer, tag: string, e: Map<string, string>): Embed {
  const brawlers = player.brawlers ?? [];
  const skill = computeSkillScore(player, brawlers.length || undefined);
  const maxed = brawlers.filter((b) => b.power >= 11).length;
  const top = mains(brawlers, 3);
  const trophy = e.get('trophy') ?? '🏆';
  return {
    title: player.name ?? `#${tag}`,
    url: `${SITE}/player/${tag}`,
    color: BRAND,
    thumbnail: { url: playerIconUrl(player.icon?.id) },
    description: [
      `\`#${tag}\`${player.club?.name ? ` · ${player.club.name}` : ''}`,
      '',
      `**Skill score ${skill.score.toFixed(1)}/10** · ${skill.tier}`,
      bar(skill.score),
    ].join('\n'),
    fields: [
      {
        name: 'Trophies',
        value: `${trophy} **${formatNumber(player.trophies ?? 0)}**\n-# best ${formatNumber(player.highestTrophies ?? 0)}`,
        inline: true,
      },
      { name: 'Ranked now', value: rankLine(e, player.rankedRankName, player.rankedElo), inline: true },
      {
        name: 'Best rank',
        value: rankLine(e, player.highestAllTimeRankedRankName, player.highestAllTimeRankedElo),
        inline: true,
      },
      {
        name: 'Victories',
        value: `3v3 **${formatNumber(player['3vs3Victories'] ?? 0)}**\nSolo ${formatNumber(player.soloVictories ?? 0)} · Duo ${formatNumber(player.duoVictories ?? 0)}`,
        inline: true,
      },
      { name: 'Brawlers', value: `**${brawlers.length}** unlocked\n${maxed} at power 11`, inline: true },
      {
        name: 'Mains',
        value: top.length
          ? top.map((b) => `${titleCase(b.name.toLowerCase())} · ${formatNumber(b.trophies)}`).join('\n')
          : '—',
        inline: true,
      },
    ],
    footer: { text: 'brawlzone.net · skill score, roster gaps and upgrade plan on the full profile' },
  };
}

async function profileCommand(token: string, raw: string | undefined, userId: string) {
  const tag = normalizeTag(raw ?? '') || (await linkedTag(userId));
  if (!tag) {
    await respond(token, {
      content: 'Give a tag, like `/profile 2RLCPVGUG` — or use `/link` once and `/profile` will show yours.',
    });
    return;
  }
  const player = await getPlayer(tag).catch(() => null);
  if (!player) {
    await respond(token, {
      content: `No player found for \`#${tag}\`. Tags only use the characters 0289PYLQGRJCUV — check for typos.`,
    });
    return;
  }
  await respond(token, {
    embeds: [profileEmbed(player, tag, await emojis())],
    components: buttons(['Full profile', `${SITE}/player/${tag}`], ['Get the Bubble app', `${SITE}/bubble`]),
  });
}

/* ------------------------------------------------------------- /link roles */

const TROPHY_ROLES: [number, string][] = [
  [10_000, '0–10k Trophies'],
  [30_000, '10k–30k Trophies'],
  [50_000, '30k–50k Trophies'],
  [70_000, '50k–70k Trophies'],
  [100_000, '70k–100k Trophies'],
  [Infinity, '100k+ Trophies'],
];
const RANK_ROLES = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Mythic', 'Legendary', 'Masters', 'Pro'];

/** Sets one role from a group and clears the rest of that group. */
async function setGroup(userId: string, roleIds: Map<string, string>, group: string[], want: string | null) {
  for (const name of group) {
    const id = roleIds.get(name);
    if (!id) continue;
    if (name === want) await bot('PUT', `/guilds/${GUILD_ID}/members/${userId}/roles/${id}`);
    else await bot('DELETE', `/guilds/${GUILD_ID}/members/${userId}/roles/${id}`);
  }
}

async function roleIds(): Promise<Map<string, string>> {
  const res = await bot('GET', `/guilds/${GUILD_ID}/roles`);
  if (!res.ok) return new Map();
  return new Map(((await res.json()) as { id: string; name: string }[]).map((r) => [r.name, r.id]));
}

async function linkCommand(token: string, raw: string | undefined, userId: string, home: boolean) {
  const tag = normalizeTag(raw ?? '');
  if (!tag) {
    await respond(token, { content: 'Give your player tag, like `/link 2RLCPVGUG`. It is under your name in game.' });
    return;
  }
  const player = await getPlayer(tag).catch(() => null);
  if (!player) {
    await respond(token, { content: `No player found for \`#${tag}\`. Check the tag and try again.` });
    return;
  }
  const prisma = getPrisma();
  if (prisma) {
    await prisma.discordLink.upsert({
      where: { discordUserId: userId },
      create: { discordUserId: userId, playerTag: tag },
      update: { playerTag: tag, linkedAt: new Date() },
    });
  }

  // Roles from the account's real numbers, replacing whatever was picked in
  // onboarding: trophy bracket from current trophies, rank from the best ever.
  const trophies = player.trophies ?? 0;
  const bracket = TROPHY_ROLES.find(([below]) => trophies < below)?.[1] ?? null;
  const best = league(player.highestAllTimeRankedRankName ?? player.rankedRankName);
  const rank = best && RANK_ROLES.includes(best) ? best : null;
  const ids = await roleIds();
  await setGroup(userId, ids, TROPHY_ROLES.map(([, n]) => n), bracket);
  await setGroup(userId, ids, RANK_ROLES, rank);

  const e = await emojis();
  await respond(token, {
    // Roles exist only in the BrawlZone server; anywhere else it just links.
    content: home
      ? `✅ Linked to **${player.name}** (\`#${tag}\`). Roles set: **${bracket ?? '—'}**${rank ? ` · ${e.get(`rank_${rank.toLowerCase()}`) ?? ''} **${rank}**` : ''}. Now \`/profile\` on its own shows you.`
      : `✅ Linked to **${player.name}** (\`#${tag}\`). Now \`/profile\` on its own shows you. Rank roles come with it in the BrawlZone server: ${SERVER_INVITE}`,
    embeds: [profileEmbed(player, tag, e)],
  });
}

async function unlinkCommand(token: string, userId: string) {
  const prisma = getPrisma();
  if (prisma) await prisma.discordLink.deleteMany({ where: { discordUserId: userId } }).catch(() => undefined);
  const ids = await roleIds();
  await setGroup(userId, ids, TROPHY_ROLES.map(([, n]) => n), null);
  await setGroup(userId, ids, RANK_ROLES, null);
  await respond(token, { content: 'Unlinked. Your trophy and rank roles are cleared.' });
}

/* ----------------------------------------------------------------- /brawler */

async function brawlerCommand(token: string, query: string) {
  const b = await findBrawler(query);
  if (!b) {
    await respond(token, { content: `No brawler called “${query}”. Try \`/brawler shade\`.` });
    return;
  }
  const [row, build, official] = await Promise.all([
    getBrawlerStat(b.id).catch(() => null),
    getBrawlerBuild(b.id).catch(() => null),
    getOfficialBrawlers()
      .then((r) => r.items.find((x) => x.id === b.id))
      .catch(() => undefined),
  ]);
  const name = titleCase(b.name);
  const fields: Embed[] = [];
  let description = 'Not enough sampled Ranked battles to rate yet.';
  if (row) {
    const adjusted = normalizeWinRate(row.winRate, row.baselineWinRate, row.decidedSampleSize);
    const score = metaScore(adjusted, row.usageRate);
    const tier = assignTierFromScore(score);
    if (tier) description = `**${tier} tier** in Ranked · meta score **${score?.toFixed(1)}/10**`;
    fields.push(
      { name: 'Adjusted win rate', value: pct(adjusted), inline: true },
      { name: 'Pick rate', value: pct(row.usageRate), inline: true },
      { name: 'Battles', value: formatNumber(row.decidedSampleSize), inline: true },
    );
  }
  if (build && build.sampleSize > 0) {
    const named = (list: { id: number; name: string }[] | undefined, id: number) =>
      titleCase((list?.find((x) => x.id === id)?.name ?? '').toLowerCase()) || `#${id}`;
    const sp = build.starPowers[0];
    const gd = build.gadgets[0];
    const gears = build.gears.slice(0, 2);
    fields.push({
      name: 'The build owners run',
      value: [
        sp ? `⭐ ${named(official?.starPowers ?? b.starPowers, sp.itemId)} · ${pct(sp.share)}` : null,
        gd ? `🔧 ${named(official?.gadgets ?? b.gadgets, gd.itemId)} · ${pct(gd.share)}` : null,
        ...gears.map((g) => `⚙️ ${named(official?.gears, g.itemId)} · ${pct(g.share)}`),
      ]
        .filter(Boolean)
        .join('\n'),
      inline: false,
    });
  }
  await respond(token, {
    embeds: [
      {
        title: name,
        url: `${SITE}${brawlerPath(b.id, b.name)}`,
        description,
        color: parseInt((b.rarity?.color ?? '#ffc93c').replace('#', ''), 16) || BRAND,
        thumbnail: { url: b.imageUrl ?? brawlerPortraitUrl(b.id) },
        fields,
        footer: { text: `brawlzone.net · from ${formatNumber(build?.sampleSize ?? 0)} sampled owners` },
      },
    ],
    components: buttons(['Full build & matchups', `${SITE}${brawlerPath(b.id, b.name)}`]),
  });
}

/* --------------------------------------------------------------------- /map */

async function rankedMaps() {
  return getRankedMapPicks(10, RANKED_MAP_WINDOW_DAYS).catch(() => []);
}

async function mapCommand(token: string, query: string) {
  const maps = await rankedMaps();
  const key = mapNameKey(query);
  const map = maps.find((m) => mapNameKey(m.mapName) === key) ?? maps.find((m) => mapNameKey(m.mapName).includes(key));
  if (!map) {
    await respond(token, { content: `“${query}” is not in the current Ranked pool. Start typing and pick from the list.` });
    return;
  }
  const [comps, art] = await Promise.all([
    getRankedComps().catch(() => ({ maps: [], modes: [] })),
    getMaps()
      .then((all) => all.find((m) => slugify(m.name) === slugify(map.mapName))?.imageUrl)
      .catch(() => undefined),
  ]);
  const meta = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());
  const nameOf = (id: number) => titleCase((meta.get(id)?.name ?? `#${id}`).toLowerCase());
  const trios = comps.maps.find((m) => m.mode === map.mode && m.mapName === map.mapName)?.comps.slice(0, 3) ?? [];
  const href = `${SITE}/maps/${slugify(humanizeMode(map.mode))}/${slugify(map.mapName)}`;
  await respond(token, {
    embeds: [
      {
        title: `${map.mapName} · ${humanizeMode(map.mode)}`,
        url: href,
        color: BRAND,
        ...(art ? { thumbnail: { url: art } } : {}),
        description: `Best picks from ${formatNumber(map.sampleSize)} sampled Ranked battles on this map.`,
        fields: [
          {
            name: 'Best picks',
            value: map.picks
              .slice(0, 5)
              .map((p, i) => `**${i + 1}.** ${titleCase(p.brawlerName.toLowerCase())} · ${pct(p.score)} (${signed(p.score - p.overallScore)} vs usual)`)
              .join('\n'),
          },
          ...(trios.length
            ? [
                {
                  name: 'Best trios',
                  value: trios
                    .map((t) => `${t.brawlerIds.map(nameOf).join(' · ')} — **${pct(t.winRate)}** (${t.battles} games)`)
                    .join('\n'),
                },
              ]
            : []),
        ],
        footer: { text: 'brawlzone.net · same numbers as the Bubble app' },
      },
    ],
    components: buttons(['Map page', href], ['Draft on this map', `${SITE}/draft`]),
  });
}

/* ------------------------------------------------------------------- /draft */

async function draftCommand(token: string, options: unknown) {
  const mapName = opt(options, 'map') ?? '';
  const enemies = ['enemy1', 'enemy2', 'enemy3'].map((k) => Number(opt(options, k))).filter((n) => n > 0);
  const allies = ['ally1', 'ally2'].map((k) => Number(opt(options, k))).filter((n) => n > 0);
  const maps = await rankedMaps();
  const map = maps.find((m) => mapNameKey(m.mapName) === mapNameKey(mapName));
  if (!map) {
    await respond(token, { content: `“${mapName}” is not in the current Ranked pool. Pick a map from the list.` });
    return;
  }
  const full = await getRankedMapPicks(60, RANKED_MAP_WINDOW_DAYS, { mapName: map.mapName }).catch(() => []);
  const pool = (full.find((m) => m.mapName === map.mapName) ?? map).picks;
  const [counters, synergies] = await Promise.all([
    enemies.length ? getCounterScores(enemies).catch(() => new Map()) : Promise.resolve(new Map()),
    allies.length ? getAllyScores(allies).catch(() => new Map()) : Promise.resolve(new Map()),
  ]);
  const taken = new Set([...enemies, ...allies]);
  const meta = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());
  const nameOf = (id: number) => titleCase((meta.get(id)?.name ?? `#${id}`).toLowerCase());
  const ranked = pool
    .filter((p) => !taken.has(p.brawlerId))
    .map((p) => {
      const c = counters.get(p.brawlerId)?.edge ?? 0;
      const a = synergies.get(p.brawlerId)?.edge ?? 0;
      return { p, c, a, total: p.score + c + a };
    })
    .sort((x, y) => y.total - x.total)
    .slice(0, 5);
  await respond(token, {
    embeds: [
      {
        title: `Draft · ${map.mapName}`,
        url: `${SITE}/draft`,
        color: BRAND,
        description: [
          enemies.length ? `**Against:** ${enemies.map(nameOf).join(', ')}` : null,
          allies.length ? `**With:** ${allies.map(nameOf).join(', ')}` : null,
          'Map form, plus how each does against the enemies and alongside your team.',
        ]
          .filter(Boolean)
          .join('\n'),
        fields: [
          {
            name: 'Pick',
            value: ranked
              .map(({ p, c, a }, i) => {
                const notes = [
                  enemies.length ? `${signed(c)} vs them` : null,
                  allies.length ? `${signed(a)} with team` : null,
                ].filter(Boolean);
                return `**${i + 1}. ${titleCase(p.brawlerName.toLowerCase())}** · ${pct(p.score)} here${notes.length ? ` · ${notes.join(' · ')}` : ''}`;
              })
              .join('\n') || 'Not enough data on this map yet.',
          },
        ],
        footer: { text: 'brawlzone.net · or float it over the game with the Bubble app' },
      },
    ],
    components: buttons(['Full draft helper', `${SITE}/draft`], ['Bubble app', `${SITE}/bubble`]),
  });
}

/* -------------------------------------------------------------------- /meta */

async function metaCommand(token: string, mode: string | undefined) {
  const [rows, edges] = await Promise.all([
    getBrawlerStatsForWindow(7, mode, 'ranked').catch(() => []),
    getSkillEdge('ranked').catch(() => undefined),
  ]);
  const top = scoreBrawlers(rows, 'ranked', edges)
    .filter((e) => e.tier !== null)
    .sort((a, b) => (b.metaScore ?? 0) - (a.metaScore ?? 0))
    .slice(0, 10);
  const e = await emojis();
  const modeIcon = mode ? (e.get(`mode_${mode.toLowerCase()}`) ?? '') : '';
  await respond(token, {
    embeds: [
      {
        title: `${modeIcon} Ranked meta${mode ? ` · ${humanizeMode(mode)}` : ''} — top 10`.trim(),
        url: `${SITE}/tier-list/ranked`,
        color: BRAND,
        description: top.length
          ? top
              .map((b, i) => `**${i + 1}.** \`${b.tier}\` ${titleCase(b.brawlerName.toLowerCase())} · ${b.metaScore?.toFixed(1)} · ${pct(b.normalizedWinRate)} win`)
              .join('\n')
          : 'Not enough sampled Ranked battles yet.',
        footer: { text: 'brawlzone.net · last 7 days of sampled Ranked battles' },
      },
    ],
    components: buttons(['Full tier list', `${SITE}/tier-list/ranked`]),
  });
}

/* ---------------------------------------------------------------- /rotation */

/** "20260903T080000.000Z" -- the game's compact form, not ISO. */
function gameTime(value: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/.exec(value);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : NaN;
}

async function rotationCommand(token: string) {
  const slots = await getEventRotation().catch(() => []);
  const now = Date.now();
  const live = slots.filter((s) => gameTime(s.startTime) <= now && gameTime(s.endTime) > now && s.event.map);
  const e = await emojis();
  const left = (end: number) => {
    const h = Math.floor((end - now) / 3_600_000);
    return h >= 24 ? `${Math.floor(h / 24)}d` : h >= 1 ? `${h}h` : `${Math.max(1, Math.round((end - now) / 60_000))}m`;
  };
  await respond(token, {
    embeds: [
      {
        title: 'Live maps right now',
        url: `${SITE}/events`,
        color: BRAND,
        description:
          live
            .map((s) => {
              const key = /showdown/i.test(s.event.mode) ? 'showdown' : slugify(s.event.mode).replace(/-/g, '');
              const icon = e.get(`mode_${key}`) ?? '•';
              return `${icon} **${humanizeMode(s.event.mode)}** — ${s.event.map} · ${left(gameTime(s.endTime))} left`;
            })
            .join('\n') || 'The rotation is unavailable right now.',
        footer: { text: 'brawlzone.net · straight from the game API' },
      },
    ],
    components: buttons(['All events', `${SITE}/events`], ['Ranked maps', `${SITE}/ranked`]),
  });
}

/* ----------------------------------------------------------------- /compare */

async function compareCommand(token: string, qa: string, qb: string) {
  const [a, b] = await Promise.all([findBrawler(qa), findBrawler(qb)]);
  if (!a || !b || a.id === b.id) {
    await respond(token, { content: 'Pick two different brawlers, like `/compare shade bo`.' });
    return;
  }
  const side = async (x: BABrawler) => {
    const row = await getBrawlerStat(x.id).catch(() => null);
    const adjusted = row ? normalizeWinRate(row.winRate, row.baselineWinRate, row.decidedSampleSize) : null;
    const score = row ? metaScore(adjusted, row.usageRate) : null;
    return { x, row, adjusted, score, tier: assignTierFromScore(score) };
  };
  const [l, r] = await Promise.all([side(a), side(b)]);
  const val = (s: typeof l) =>
    s.row
      ? `${s.tier ? `**${s.tier} tier**` : 'unrated'} · ${s.score?.toFixed(1) ?? '—'}/10\n${pct(s.adjusted)} win · ${pct(s.row.usageRate)} pick`
      : 'No sampled data yet';
  const ahead =
    l.adjusted !== null && r.adjusted !== null
      ? l.adjusted >= r.adjusted
        ? `**${titleCase(a.name)}** is ahead by ${Math.abs((l.adjusted - r.adjusted) * 100).toFixed(1)} points of adjusted win rate.`
        : `**${titleCase(b.name)}** is ahead by ${Math.abs((r.adjusted - l.adjusted) * 100).toFixed(1)} points of adjusted win rate.`
      : 'Not enough data on both to call it.';
  const href = `${SITE}${comparePath(a, b)}`;
  await respond(token, {
    embeds: [
      {
        title: `${titleCase(a.name)} vs ${titleCase(b.name)}`,
        url: href,
        color: BRAND,
        description: ahead,
        fields: [
          { name: titleCase(a.name), value: val(l), inline: true },
          { name: titleCase(b.name), value: val(r), inline: true },
        ],
        footer: { text: 'brawlzone.net · head-to-head record on the full page' },
      },
    ],
    components: buttons(['Full comparison', href]),
  });
}

/* ------------------------------------------------------------- /leaderboard */

async function leaderboardCommand(token: string) {
  const { items } = await getPlayerRankings('global', 10).catch(() => ({ items: [] }));
  const e = await emojis();
  const trophy = e.get('trophy') ?? '🏆';
  const medal = ['🥇', '🥈', '🥉'];
  await respond(token, {
    embeds: [
      {
        title: 'Global top 10',
        url: `${SITE}/leaderboard`,
        color: BRAND,
        description:
          items
            .map((p, i) => `${medal[i] ?? `**${i + 1}.**`} ${p.name}${p.club?.name ? ` · ${p.club.name}` : ''} — ${trophy} ${formatNumber(p.trophies)}`)
            .join('\n') || 'The rankings are unavailable right now.',
        footer: { text: 'brawlzone.net · from the game API' },
      },
    ],
    components: buttons(['Top 100', `${SITE}/leaderboard`]),
  });
}

/* ----------------------------------------------------------------- /counter */

/** Ranked games against the brawler before a counter is listed. */
const COUNTER_MIN_GAMES = 150;
const COUNTER_MIN_GAMES_AT_RANK = 60;

/**
 * Who beats a brawler in Ranked: the same numbers as /brawlers/<slug>/counters
 * and the counter-of-the-day post -- Ranked matchups, each measured against
 * what the two brawlers' own rates predict -- optionally at one rank.
 */
async function counterCommand(token: string, query: string, rankSlug: string | undefined) {
  const all = [...(await getBrawlerArtMap().catch(() => new Map<number, BABrawler>())).values()];
  const target =
    all.find((b) => b.name.toLowerCase() === query.toLowerCase()) ??
    all.find((b) => b.name.toLowerCase().includes(query.toLowerCase()));
  if (!target) {
    await respond(token, { content: `No brawler called “${query}”. Start typing and pick from the list.` });
    return;
  }
  const bracket = bracketBySlug(rankSlug ?? null);
  const scores = await getRankedCounterScores([target.id], 21, bracket?.id).catch(() => new Map());
  const floor = bracket ? COUNTER_MIN_GAMES_AT_RANK : COUNTER_MIN_GAMES;
  const nameOf = new Map(all.map((b) => [b.id, titleCase(b.name.toLowerCase())]));
  const rows = [...scores.values()].filter((s) => s.brawlerId !== target.id && s.decidedSampleSize >= floor);
  const counters = rows.filter((s) => s.edge >= 0.01 && s.winRate >= 0.5).sort((a, b) => b.edge - a.edge).slice(0, 5);
  const avoid = rows.filter((s) => s.edge <= -0.01 && s.winRate < 0.5).sort((a, b) => a.edge - b.edge).slice(0, 3);
  const name = titleCase(target.name.toLowerCase());
  const href = `${SITE}/brawlers/${slugify(target.name)}/counters`;
  const line = (s: { brawlerId: number; winRate: number; edge: number; decidedSampleSize: number }, i: number) =>
    `**${i + 1}.** ${nameOf.get(s.brawlerId) ?? `#${s.brawlerId}`} · **${pct(s.winRate)}** (${signed(s.edge)} vs expected, ${formatNumber(s.decidedSampleSize)} games)`;
  await respond(token, {
    embeds: [
      {
        title: `How to beat ${name}${bracket ? ` · ${bracket.label}` : ''}`,
        url: href,
        color: BRAND,
        ...(target.imageUrl ? { thumbnail: { url: target.imageUrl } } : {}),
        description: `Ranked win rates against ${name} over the last 21 days${bracket ? `, ${bracket.label} lobbies only` : ', every rank'}.`,
        fields: [
          { name: 'Pick these', value: counters.length ? counters.map(line).join('\n') : 'Not enough Ranked games yet.' },
          ...(avoid.length ? [{ name: `Don't pick into ${name}`, value: avoid.map(line).join('\n') }] : []),
        ],
        footer: { text: 'brawlzone.net · same numbers as the Bubble app' },
      },
    ],
    components: buttons(['All counters by rank', href], ['Draft helper', `${SITE}/draft`]),
  });
}

/* -------------------------------------------------------------------- /team */

async function teamCommand(token: string, mapQuery: string, rankSlug: string | undefined) {
  const maps = await rankedMaps();
  const key = mapNameKey(mapQuery);
  const map = maps.find((m) => mapNameKey(m.mapName) === key) ?? maps.find((m) => mapNameKey(m.mapName).includes(key));
  if (!map) {
    await respond(token, { content: `“${mapQuery}” is not in the current Ranked pool. Start typing and pick from the list.` });
    return;
  }
  const bracket = bracketBySlug(rankSlug ?? null);
  const comps = await getRankedComps(8, bracket?.id).catch(() => ({ maps: [], modes: [] }));
  const own = comps.maps.find((m) => m.mode === map.mode && m.mapName === map.mapName)?.comps;
  const list = (own ?? comps.modes.find((m) => m.mode === map.mode)?.comps ?? []).slice(0, 3);
  const meta = await getBrawlerArtMap().catch(() => new Map<number, BABrawler>());
  const nameOf = (id: number) => titleCase((meta.get(id)?.name ?? `#${id}`).toLowerCase());
  const href = `${SITE}/maps/${slugify(humanizeMode(map.mode))}/${slugify(map.mapName)}`;
  await respond(token, {
    embeds: [
      {
        title: `Best teams · ${map.mapName}${bracket ? ` · ${bracket.label}` : ''}`,
        url: href,
        color: BRAND,
        description: own
          ? `The trios that win most together on ${map.mapName} in Ranked${bracket ? `, ${bracket.label} lobbies` : ''}.`
          : `Not enough trios on ${map.mapName} yet, so these are the best in ${humanizeMode(map.mode)}.`,
        fields: list.length
          ? list.map((t, i) => ({
              name: `${i + 1}. ${t.brawlerIds.map(nameOf).join(' · ')}`,
              value: `**${pct(t.normalizedWinRate ?? t.winRate)}** adjusted win rate · ${t.battles} games`,
            }))
          : [{ name: 'No trios yet', value: 'Not enough Ranked games at this rank yet.' }],
        footer: { text: 'brawlzone.net · same numbers as the Bubble app' },
      },
    ],
    components: buttons(['Map page', href], ['Team comps in the Bubble', `${SITE}/bubble`]),
  });
}

/* -------------------------------------------------------------------- /help */

async function helpCommand(token: string, home: boolean) {
  await respond(token, {
    embeds: [
      {
        title: 'BrawlZone bot',
        color: BRAND,
        description: [
          '`/link tag` — link your account: sets your trophy and rank roles',
          '`/profile [tag]` — your card, or anyone\'s',
          '`/brawler name` — tier, win rate and the build owners run',
          '`/map name` — best picks and trios on a Ranked map',
          '`/draft map enemies…` — what to pick against them',
          '`/counter brawler [rank]` — who beats a brawler, by rank',
          '`/team map [rank]` — the best trios on a map, by rank',
          '`/meta [mode]` — the Ranked top 10 right now',
          '`/rotation` — maps live right now',
          '`/compare a b` — brawler vs brawler',
          '`/leaderboard` — the global top 10',
          '`/daily [zoom|shadow]` — today’s puzzle: guess the brawler, then share your score',
          '`/unlink` — remove your link and roles',
          '',
          `**Add the bot** to your server, or to your account to use it in any chat: ${INSTALL_URL}`,
          ...(home ? [] : [`**Join the BrawlZone server** for rank roles and daily meta posts: ${SERVER_INVITE}`]),
          'Want it inside the game? The **Bubble app** floats the meta over your draft: https://brawlzone.net/bubble',
        ].join('\n'),
        footer: { text: 'brawlzone.net · free' },
      },
    ],
  });
}

/* ------------------------------------------------------------------ /daily */

const today = () => new Date().toISOString().slice(0, 10);
const DAILY_LABEL: Record<DailyMode, { icon: string; name: string; ask: string }> = {
  zoom: { icon: '🔍', name: 'Zoom', ask: 'Who is this, up close?' },
  shadow: { icon: '👤', name: 'Shadow', ask: 'Whose shadow is this?' },
};

/**
 * The board as one ephemeral message: only the player sees it, so nobody's
 * guesses spoil the puzzle for the channel. `note` is the line about the last
 * guess. Finished boards show the full model and a button to brag.
 */
function dailyBoard(mode: DailyMode, date: string, misses: number, note: string, end?: { solvedIn: number; answer: string }): Reply {
  const label = DAILY_LABEL[mode];
  const step = end ? DAILY_TRIES : misses;
  const title = `${label.icon} ${label.name} · BrawlZone Daily #${dailyNumber(date)}`;
  const description = end
    ? [end.solvedIn > 0 ? `✅ **Solved in ${end.solvedIn}/${DAILY_TRIES}!**` : `💀 Out of guesses. It was **${end.answer}**.`, note].filter(Boolean).join('\n')
    : [`${hearts(misses)}`, `**${label.ask}**`, note, mode === 'zoom' ? '-# Every wrong guess zooms out a little.' : ''].filter(Boolean).join('\n');
  const site: [string, string] = ['More puzzles on BrawlZone', `${SITE}/daily-challenge`];
  return {
    embeds: [
      {
        title,
        color: end ? (end.solvedIn > 0 ? 0x4ade80 : 0xfb7185) : BRAND,
        description,
        image: { url: `${SITE}/api/brawldle/picture?mode=${mode}&step=${step}&d=${date}` },
        footer: { text: 'New puzzle every day at midnight UTC · brawlzone.net' },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          end
            ? { type: 2, style: 1, label: 'Share result', emoji: { name: '📣' }, custom_id: encodeDaily({ action: 'share', mode, date, n: end.solvedIn }) }
            : { type: 2, style: 1, label: 'Guess', emoji: { name: '✏️' }, custom_id: encodeDaily({ action: 'guess', mode, date, n: misses }) },
          { type: 2, style: 5, label: site[0], url: site[1] },
        ],
      },
    ],
  };
}

/** A finished Discord game counts in the site's "X% solved today" too. */
async function tallyDaily(mode: DailyMode, solved: boolean, guesses: number) {
  const bucket = tallyBucket(mode, solved, guesses);
  const prisma = getPrisma();
  if (bucket === null || !prisma) return;
  const key = { day: new Date(`${today()}T00:00:00Z`), mode, guesses: bucket };
  await prisma.dailyChallengeTally
    .upsert({ where: { day_mode_guesses: key }, create: { ...key, count: 1 }, update: { count: { increment: 1 } } })
    .catch(() => undefined);
}

/** A typed guess, from the modal: checked against today's answer, then the board moves on. */
async function dailyAnswer(token: string, ref: DailyRef, typed: string) {
  const guess = await findBrawler(typed);
  if (!guess) {
    await respond(token, dailyBoard(ref.mode, ref.date, ref.n, `❓ No brawler called “${typed.slice(0, 30)}”. That one does not count.`));
    return;
  }
  const roster = await brawldleRoster().catch(() => []);
  const answer = await pictureAnswer(ref.mode, ref.date, roster).catch(() => null);
  if (!answer) {
    await respond(token, { content: 'Today’s puzzle could not be loaded. Try again shortly.', embeds: [], components: [] });
    return;
  }
  const name = titleCase(guess.name);
  if (guess.id === answer.id) {
    await tallyDaily(ref.mode, true, ref.n + 1);
    await respond(token, dailyBoard(ref.mode, ref.date, ref.n, `It was **${titleCase(answer.name)}**.`, { solvedIn: ref.n + 1, answer: titleCase(answer.name) }));
    return;
  }
  const misses = ref.n + 1;
  if (misses >= DAILY_TRIES) {
    await tallyDaily(ref.mode, false, DAILY_TRIES);
    await respond(token, dailyBoard(ref.mode, ref.date, misses, `Your last guess was ${name}.`, { solvedIn: 0, answer: titleCase(answer.name) }));
    return;
  }
  await respond(token, dailyBoard(ref.mode, ref.date, misses, `❌ Not ${name}.`));
}

/* ------------------------------------------------------------- autocomplete */

async function autocomplete(name: string | undefined, options: unknown): Promise<{ name: string; value: string }[]> {
  const focused = Array.isArray(options) ? (options as Option[]).find((o) => o.focused) : undefined;
  const typed = String(focused?.value ?? '').toLowerCase();
  if (!focused) return [];

  if (focused.name === 'map' || (name === 'map' && focused.name === 'name')) {
    const maps = await rankedMaps();
    return maps
      .filter((m) => m.mapName.toLowerCase().includes(typed))
      .slice(0, 25)
      .map((m) => ({ name: `${m.mapName} (${humanizeMode(m.mode)})`, value: m.mapName }));
  }

  // Every other autocompleted option is a brawler.
  const all = [...(await getBrawlerArtMap().catch(() => new Map<number, BABrawler>())).values()];
  const value = name === 'draft' ? (b: BABrawler) => String(b.id) : (b: BABrawler) => b.name;
  return all
    .filter((b) => b.name.toLowerCase().includes(typed))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(typed)) - Number(!b.name.toLowerCase().startsWith(typed)) || a.name.localeCompare(b.name))
    .slice(0, 25)
    .map((b) => ({ name: titleCase(b.name), value: value(b) }));
}

/* ------------------------------------------------------------------- router */

export async function POST(request: Request): Promise<Response> {
  // The raw text: the signature covers these exact bytes.
  const body = await request.text();
  const valid = verifyDiscordRequest(
    PUBLIC_KEY,
    request.headers.get('x-signature-ed25519'),
    request.headers.get('x-signature-timestamp'),
    body,
  );
  // Discord probes with bad signatures and refuses the endpoint unless 401.
  if (!valid) return new Response('invalid request signature', { status: 401 });

  const interaction = JSON.parse(body) as {
    type: number;
    token: string;
    data?: {
      name?: string;
      options?: unknown;
      custom_id?: string;
      components?: { components?: { custom_id?: string; value?: string }[] }[];
    };
    member?: { user?: { id?: string } };
    user?: { id?: string };
    guild_id?: string;
  };

  if (interaction.type === 1) return Response.json({ type: 1 });

  // /daily's buttons (3) and its guess box (5). State is in the custom_id.
  if (interaction.type === 3 || interaction.type === 5) {
    const ref = decodeDaily(interaction.data?.custom_id ?? '');
    if (!ref) return Response.json({ type: 4, data: { content: 'That button has expired.', flags: 64 } });
    if (ref.date !== today() && ref.action !== 'share') {
      return Response.json({ type: 4, data: { content: 'That puzzle is over. `/daily` has today’s.', flags: 64 } });
    }
    if (ref.action === 'guess') {
      // 9 = a modal: the one place Discord lets a player type mid-interaction.
      return Response.json({
        type: 9,
        data: {
          custom_id: encodeDaily({ ...ref, action: 'answer' }),
          title: `${DAILY_LABEL[ref.mode].name}: who is it?`,
          components: [
            { type: 1, components: [{ type: 4, custom_id: 'name', style: 1, label: 'Brawler name', min_length: 2, max_length: 30, required: true, placeholder: 'e.g. Shelly' }] },
          ],
        },
      });
    }
    if (ref.action === 'share') {
      const userId = interaction.member?.user?.id ?? interaction.user?.id ?? '';
      const label = DAILY_LABEL[ref.mode];
      const result = ref.n > 0 ? `${ref.n}/${DAILY_TRIES}` : `X/${DAILY_TRIES}`;
      return Response.json({
        type: 4,
        data: {
          content: `${label.icon} <@${userId}> ${ref.n > 0 ? 'solved' : 'played'} BrawlZone Daily #${dailyNumber(ref.date)} ${label.name}: **${result}** ${squares(ref.n)}\nYour turn: \`/daily\` · ${SITE}/daily-challenge`,
          allowed_mentions: { parse: [] },
        },
      });
    }
    // The typed guess: defer an update (6), then edit the board in place.
    const typed = interaction.data?.components?.[0]?.components?.[0]?.value ?? '';
    after(async () => {
      try {
        await dailyAnswer(interaction.token, ref, typed);
      } catch {
        await respond(interaction.token, { content: 'Something went wrong checking that guess. Try again.' });
      }
    });
    return Response.json({ type: 6 });
  }

  // Autocomplete: answered inline, from cached reads only.
  if (interaction.type === 4) {
    const choices = await autocomplete(interaction.data?.name, interaction.data?.options).catch(() => []);
    return Response.json({ type: 8, data: { choices } });
  }

  if (interaction.type === 2) {
    const name = interaction.data?.name;
    const options = interaction.data?.options;
    const token = interaction.token;
    const userId = interaction.member?.user?.id ?? interaction.user?.id ?? '';
    // Nothing to look up yet: the board is today's picture at step 0, sent at
    // once and only to the player (64 = ephemeral).
    if (name === 'daily') {
      const mode: DailyMode = opt(options, 'mode') === 'shadow' ? 'shadow' : 'zoom';
      return Response.json({ type: 4, data: { ...dailyBoard(mode, today(), 0, ''), flags: 64 } });
    }
    // Our own server, where the roles are; anywhere else the bot only answers.
    const home = interaction.guild_id === GUILD_ID;

    after(async () => {
      try {
        if (name === 'profile') await profileCommand(token, opt(options, 'tag'), userId);
        else if (name === 'link') await linkCommand(token, opt(options, 'tag'), userId, home);
        else if (name === 'unlink') await unlinkCommand(token, userId);
        else if (name === 'brawler' || name === 'tier') await brawlerCommand(token, opt(options, 'name') ?? opt(options, 'brawler') ?? '');
        else if (name === 'map') await mapCommand(token, opt(options, 'name') ?? '');
        else if (name === 'draft') await draftCommand(token, options);
        else if (name === 'counter') await counterCommand(token, opt(options, 'brawler') ?? '', opt(options, 'rank'));
        else if (name === 'team') await teamCommand(token, opt(options, 'map') ?? '', opt(options, 'rank'));
        else if (name === 'meta') await metaCommand(token, opt(options, 'mode'));
        else if (name === 'rotation') await rotationCommand(token);
        else if (name === 'compare') await compareCommand(token, opt(options, 'a') ?? '', opt(options, 'b') ?? '');
        else if (name === 'leaderboard') await leaderboardCommand(token);
        else if (name === 'help') await helpCommand(token, home);
        else await respond(token, { content: 'Unknown command. Try `/help`.' });
      } catch {
        await respond(token, { content: 'Something went wrong looking that up. Try again shortly.' });
      }
    });
    // 5 = deferred: Discord shows "BrawlZone is thinking…" until the edit lands.
    return Response.json({ type: 5 });
  }

  return Response.json({ type: 1 });
}
