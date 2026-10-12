/**
 * Sets up the Discord server's structure: emojis, roles, channels and the
 * onboarding questions. Idempotent: everything is looked up by name first and
 * only created when missing, and onboarding is rebuilt from this file each run
 * (keeping the prompt that already existed), so running it twice changes
 * nothing the second time.
 *
 * Needs DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in the environment. The bot has
 * Administrator, which this needs (roles, channels, emojis, onboarding).
 *
 *   node scripts/discord-setup.mjs
 *
 * Rank and mode badges are the game's own icons from the same CDN the site
 * draws them from; Brawl Stars' fan content policy allows this for a free,
 * unofficial community, and the welcome post says the server is unofficial.
 */

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD = process.env.DISCORD_GUILD_ID;
if (!TOKEN || !GUILD) {
  console.error('DISCORD_BOT_TOKEN and DISCORD_GUILD_ID must be set.');
  process.exit(1);
}

const API = 'https://discord.com/api/v10';
const headers = {
  authorization: `Bot ${TOKEN}`,
  'content-type': 'application/json',
  'user-agent': 'BrawlZone (https://brawlzone.net, 1.0)',
};

async function call(method, path, body, attempt = 0) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 429 && attempt < 5) {
    const wait = Number((await res.json()).retry_after ?? 1) * 1000 + 250;
    await new Promise((r) => setTimeout(r, wait));
    return call(method, path, body, attempt + 1);
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? {} : res.json();
}

/* ------------------------------------------------------------------ emojis */

const CDN = 'https://cdn.brawlify.com';
const EMOJIS = {
  rank_bronze: `${CDN}/ranked/regular/Bronze.png`,
  rank_silver: `${CDN}/ranked/regular/Silver.png`,
  rank_gold: `${CDN}/ranked/regular/Gold.png`,
  rank_diamond: `${CDN}/ranked/regular/Diamond.png`,
  rank_mythic: `${CDN}/ranked/regular/Mythic.png`,
  rank_legendary: `${CDN}/ranked/regular/Legendary.png`,
  rank_masters: `${CDN}/ranked/regular/Masters.png`,
  rank_pro: `${CDN}/ranked/regular/Pro.png`,
  mode_gemgrab: `${CDN}/game-modes/regular/48000000.png`,
  mode_heist: `${CDN}/game-modes/regular/48000002.png`,
  mode_bounty: `${CDN}/game-modes/regular/48000003.png`,
  mode_brawlball: `${CDN}/game-modes/regular/48000005.png`,
  mode_showdown: `${CDN}/game-modes/regular/48000006.png`,
  mode_hotzone: `${CDN}/game-modes/regular/48000017.png`,
  mode_knockout: `${CDN}/game-modes/regular/48000020.png`,
  trophy: 'https://brawlzone.net/icons/trophy.png',
};

async function ensureEmojis() {
  const existing = await call('GET', `/guilds/${GUILD}/emojis`);
  const byName = new Map(existing.map((e) => [e.name, e]));
  for (const [name, url] of Object.entries(EMOJIS)) {
    if (byName.has(name)) continue;
    const img = await fetch(url, { headers: { 'user-agent': headers['user-agent'] } });
    if (!img.ok) throw new Error(`emoji ${name}: ${url} -> ${img.status}`);
    const b64 = Buffer.from(await img.arrayBuffer()).toString('base64');
    const made = await call('POST', `/guilds/${GUILD}/emojis`, {
      name,
      image: `data:image/png;base64,${b64}`,
    });
    byName.set(name, made);
    console.log(`  emoji :${name}: created`);
  }
  return byName;
}

/* ------------------------------------------------------------------- roles */

const TROPHY_ROLES = [
  ['0–10k Trophies', 0x8b95b8],
  ['10k–30k Trophies', 0x6bbf59],
  ['30k–50k Trophies', 0x3fa7f5],
  ['50k–70k Trophies', 0xa25bff],
  ['70k–100k Trophies', 0xff8a3d],
  ['100k+ Trophies', 0xffc53d],
];
const RANK_ROLES = [
  ['Bronze', 0xb07a4f, 'rank_bronze'],
  ['Silver', 0xb8c4d6, 'rank_silver'],
  ['Gold', 0xf2c14e, 'rank_gold'],
  ['Diamond', 0x52b8ff, 'rank_diamond'],
  ['Mythic', 0xd25bff, 'rank_mythic'],
  ['Legendary', 0xff4d6d, 'rank_legendary'],
  ['Masters', 0xffd166, 'rank_masters'],
  ['Pro', 0x35d07f, 'rank_pro'],
];
const MODE_ROLES = [
  ['Gem Grab main', 'mode_gemgrab'],
  ['Brawl Ball main', 'mode_brawlball'],
  ['Knockout main', 'mode_knockout'],
  ['Heist main', 'mode_heist'],
  ['Hot Zone main', 'mode_hotzone'],
  ['Bounty main', 'mode_bounty'],
  ['Showdown main', 'mode_showdown'],
];
const PING_ROLES = [
  ['Meta pings', 0xffc53d],
  ['Map pings', 0x3fa7f5],
  ['App updates', 0x35d07f],
];

async function ensureRoles() {
  const roles = await call('GET', `/guilds/${GUILD}/roles`);
  const byName = new Map(roles.map((r) => [r.name, r]));
  const want = [
    ...TROPHY_ROLES.map(([n, c]) => [n, c]),
    ...RANK_ROLES.map(([n, c]) => [n, c]),
    ...MODE_ROLES.map(([n]) => [n, 0]),
    ...PING_ROLES,
  ];
  for (const [name, color] of want) {
    if (byName.has(name)) continue;
    const made = await call('POST', `/guilds/${GUILD}/roles`, {
      name,
      color,
      permissions: '0',
      hoist: false,
      mentionable: false,
    });
    byName.set(name, made);
    console.log(`  role @${name} created`);
  }
  return byName;
}

/* ---------------------------------------------------------------- channels */

const VIEW = 1n << 10n;
const SEND = 1n << 11n;
const SEND_IN_THREADS = 1n << 38n;
const CREATE_PUBLIC_THREADS = 1n << 35n;

async function ensureChannels() {
  const chans = await call('GET', `/guilds/${GUILD}/channels`);
  const byName = new Map(chans.map((c) => [c.name, c]));
  const site = chans.find((c) => c.type === 4 && /site/i.test(c.name));

  if (!byName.has('📱-bubble-app')) {
    const made = await call('POST', `/guilds/${GUILD}/channels`, {
      name: '📱-bubble-app',
      type: 5,
      parent_id: site?.id,
      topic:
        'BrawlZone Bubble: every new version, what changed and the download link. Download: https://brawlzone.net/bubble',
      // Announcements only: the bot posts, everyone reads and reacts.
      permission_overwrites: [{ id: GUILD, type: 0, deny: String(SEND), allow: String(VIEW) }],
    });
    byName.set(made.name, made);
    console.log('  #📱-bubble-app created');
  }

  if (!byName.has('💡-suggestions')) {
    const made = await call('POST', `/guilds/${GUILD}/channels`, {
      name: '💡-suggestions',
      type: 15,
      parent_id: site?.id,
      topic:
        'Ideas, bugs and feedback for brawlzone.net and the Bubble app. One post per idea, pick a tag, and 👍 the ones you want most.',
      available_tags: [
        { name: 'Idea', emoji_name: '💡' },
        { name: 'Bug', emoji_name: '🐛' },
        { name: 'Bubble app', emoji_name: '📱' },
        { name: 'Website', emoji_name: '🌐' },
        { name: 'Done', emoji_name: '✅', moderated: true },
      ],
      default_reaction_emoji: { emoji_name: '👍' },
      default_sort_order: 0,
      permission_overwrites: [
        {
          id: GUILD,
          type: 0,
          allow: String(VIEW | SEND_IN_THREADS | CREATE_PUBLIC_THREADS | SEND),
        },
      ],
    });
    byName.set(made.name, made);
    console.log('  #💡-suggestions forum created');
  }
  return byName;
}

/* -------------------------------------------------------------- onboarding */

/* A snowflake-shaped id for a new prompt or option; Discord keeps it. */
let counter = 0n;
function newId() {
  counter += 1n;
  return String(((BigInt(Date.now()) - 1420070400000n) << 22n) | counter);
}

async function setOnboarding(emojis, roles, channels) {
  const current = await call('GET', `/guilds/${GUILD}/onboarding`);
  const role = (n) => roles.get(n)?.id;
  const chan = (n) => channels.get(n)?.id;
  const emoji = (n) => {
    const e = emojis.get(n);
    return e ? { emoji_id: e.id, emoji_name: e.name, emoji_animated: false } : {};
  };

  // Keep the existing first prompt, adding the two new opt-ins to it.
  const existing = current.prompts.map((p) => ({
    ...p,
    options: p.options.map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description ?? '',
      role_ids: o.role_ids,
      channel_ids: o.channel_ids,
      ...(o.emoji?.id ? { emoji_id: o.emoji.id } : o.emoji?.name ? { emoji_name: o.emoji.name } : {}),
    })),
  }));
  const brings = existing.find((p) => /brings you here/i.test(p.title));
  if (brings) {
    const add = [
      ['Map rotation pings', 'A ping when new Ranked maps go live', 'Map pings', '📈-meta-updates', '🗺️'],
      ['Bubble app updates', 'A ping when a new app version is out', 'App updates', '📱-bubble-app', '📱'],
    ];
    for (const [title, description, r, c, e] of add) {
      if (brings.options.some((o) => o.title === title)) continue;
      brings.options.push({
        id: newId(),
        title,
        description,
        role_ids: [role(r)].filter(Boolean),
        channel_ids: [chan(c)].filter(Boolean),
        emoji_name: e,
      });
    }
  }

  const prompt = (title, single, options) => ({
    id: existing.find((p) => p.title === title)?.id ?? newId(),
    type: 0,
    title,
    single_select: single,
    required: false,
    in_onboarding: true,
    options: options.map((o) => ({
      id: existing.find((p) => p.title === title)?.options.find((x) => x.title === o.title)?.id ?? newId(),
      description: '',
      channel_ids: [],
      ...o,
    })),
  });

  const ours = [
    prompt('How many trophies do you have?', true,
      TROPHY_ROLES.map(([n]) => ({ title: n.replace(' Trophies', ''), role_ids: [role(n)], ...emoji('trophy') }))),
    prompt("What's your best Ranked rank?", true,
      RANK_ROLES.map(([n, , e]) => ({ title: n, role_ids: [role(n)], ...emoji(e) }))),
    prompt('Which modes do you main?', false,
      MODE_ROLES.map(([n, e]) => ({ title: n.replace(' main', ''), role_ids: [role(n)], ...emoji(e) }))),
  ];

  const prompts = [
    ...existing.filter((p) => !ours.some((o) => o.title === p.title)),
    ...ours,
  ];
  const defaults = [...new Set([...current.default_channel_ids, chan('📱-bubble-app'), chan('💡-suggestions')].filter(Boolean))];

  await call('PUT', `/guilds/${GUILD}/onboarding`, {
    prompts,
    default_channel_ids: defaults,
    enabled: true,
    mode: current.mode ?? 0,
  });
  console.log(`  onboarding: ${prompts.length} questions, ${defaults.length} default channels`);
}

/* -------------------------------------------------------------------- run */

const emojis = await ensureEmojis();
console.log(`emojis: ${emojis.size}`);
const roles = await ensureRoles();
console.log(`roles: ${roles.size}`);
const channels = await ensureChannels();
console.log(`channels: ${channels.size}`);
await setOnboarding(emojis, roles, channels);
console.log('done');
