/**
 * Registers the slash commands, and points Discord at the interactions route.
 *
 * Run once after changing a command's name, description or options — Discord
 * stores these, so editing the handler alone changes nothing a user sees.
 *
 * Registers globally since 2026-10-23, when the bot went public: installable to
 * any server, and to a user's own account so the commands work in any chat
 * (integration types 0 and 1, every context). The guild's own copies are
 * cleared, or the BrawlZone server would list every command twice. Global
 * changes can take a while to reach every client, so re-run this only when
 * something actually changed.
 *
 * It also sets the install links (Discord's "Add App" chooser): a server
 * install adds the commands and a bot user that can post in channels, for
 * /rewards-feed (2026-10-29); the commands themselves need no permission.
 *
 * Needs DISCORD_BOT_TOKEN and DISCORD_APP_ID in the environment:
 *   set -a && . .env.production && set +a && node scripts/discord-register-commands.mjs
 *
 * Setting the endpoint makes Discord verify it immediately: it sends a signed
 * PING and a couple of deliberately-bad ones, and refuses the URL unless the
 * good one answers a PONG and the bad ones come back 401. So this failing is
 * usually a signature problem, not a networking one.
 */
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const APP = process.env.DISCORD_APP_ID;
const GUILD = process.env.DISCORD_GUILD_ID;
const ENDPOINT = 'https://brawlzone.net/api/discord/interactions';

if (!TOKEN || !APP || !GUILD) {
  console.error('DISCORD_BOT_TOKEN, DISCORD_APP_ID and DISCORD_GUILD_ID must be set.');
  process.exit(1);
}

const STRING = 3;
const brawlerOpt = (name, description, required = true) => ({
  name, type: STRING, required, description, autocomplete: true,
});
const mapOpt = (name = 'map') => ({
  name, type: STRING, required: true, description: 'A map in the current Ranked pool', autocomplete: true,
});
/** An optional rank bracket, for the commands that answer per rank. */
const RANK_OPT = {
  name: 'rank', type: STRING, required: false, description: 'Only lobbies at this rank',
  choices: [
    { name: 'Diamond and below', value: 'diamond' },
    { name: 'Mythic', value: 'mythic' },
    { name: 'Legendary', value: 'legendary' },
    { name: 'Masters to Pro', value: 'masters' },
  ],
};
const MODES = [
  ['Gem Grab', 'gemGrab'], ['Brawl Ball', 'brawlBall'], ['Knockout', 'knockout'],
  ['Heist', 'heist'], ['Hot Zone', 'hotZone'], ['Bounty', 'bounty'],
];

const COMMANDS = [
  {
    name: 'profile',
    type: 1,
    description: 'Player card: trophies, Ranked rank, skill score and mains',
    options: [
      {
        name: 'tag',
        type: STRING,
        required: false,
        description: 'Player tag (e.g. 2RLCPVGUG). Leave empty to show your linked account',
      },
    ],
  },
  {
    name: 'link',
    type: 1,
    description: 'Link your Brawl Stars account (and get rank roles in the BrawlZone server)',
    options: [{ name: 'tag', type: STRING, required: true, description: 'Your player tag, under your name in game' }],
  },
  { name: 'unlink', type: 1, description: 'Remove your linked account and its roles' },
  {
    name: 'brawler',
    type: 1,
    description: 'Tier, win rate and the build owners run',
    options: [brawlerOpt('name', 'Brawler name')],
  },
  {
    // Kept so the old name still works for people who learnt it.
    name: 'tier',
    type: 1,
    description: 'How a brawler is performing in Ranked right now',
    options: [brawlerOpt('brawler', 'Brawler name')],
  },
  {
    name: 'map',
    type: 1,
    description: 'Best picks and trios on a Ranked map',
    options: [mapOpt('name')],
  },
  {
    name: 'draft',
    type: 1,
    description: 'What to pick on a map, against their picks and with yours',
    options: [
      mapOpt('map'),
      brawlerOpt('enemy1', 'An enemy pick', false),
      brawlerOpt('enemy2', 'An enemy pick', false),
      brawlerOpt('enemy3', 'An enemy pick', false),
      brawlerOpt('ally1', 'A team-mate pick', false),
      brawlerOpt('ally2', 'A team-mate pick', false),
    ],
  },
  {
    name: 'meta',
    type: 1,
    description: 'The Ranked top 10 right now',
    options: [
      {
        name: 'mode', type: STRING, required: false, description: 'Only one mode',
        choices: MODES.map(([name, value]) => ({ name, value })),
      },
    ],
  },
  {
    name: 'counter',
    type: 1,
    description: 'Who beats a brawler in Ranked, and who not to pick into it',
    options: [brawlerOpt('brawler', 'The brawler to beat'), RANK_OPT],
  },
  {
    name: 'team',
    type: 1,
    description: 'The best Ranked trios on a map',
    options: [mapOpt('map'), RANK_OPT],
  },
  { name: 'rotation', type: 1, description: 'Maps live right now and when they end' },
  {
    name: 'giveaway',
    type: 1,
    description: 'Confirm your giveaway entry for +2 points (BrawlZone server only)',
    options: [{ name: 'code', type: STRING, required: true, description: 'The 8-letter code on your entry page' }],
  },
  {
    name: 'compare',
    type: 1,
    description: 'Brawler vs brawler',
    options: [brawlerOpt('a', 'First brawler'), brawlerOpt('b', 'Second brawler')],
  },
  { name: 'leaderboard', type: 1, description: 'The global top 10 players' },
  { name: 'rewards', type: 1, description: 'Free Brawl Stars rewards you can claim right now' },
  {
    // Server admins only (Manage Server = 32), and only in servers: it picks
    // a channel there for every new free reward (2026-10-29).
    name: 'rewards-feed',
    type: 1,
    description: 'Post every new free Brawl Stars reward in a channel of this server',
    default_member_permissions: '32',
    integration_types: [0],
    contexts: [0],
    options: [
      {
        name: 'setup',
        type: 1,
        description: 'Choose the channel for free reward posts',
        options: [{ name: 'channel', type: 7, required: true, channel_types: [0, 5], description: 'Where to post them' }],
      },
      { name: 'stop', type: 1, description: 'Stop posting free rewards in this server' },
    ],
  },
  {
    name: 'daily',
    type: 1,
    description: 'Today’s puzzle: guess the brawler from a zoom or its shadow, then share your score',
    options: [
      {
        name: 'mode', type: STRING, required: false, description: 'Zoom (default) or Shadow',
        choices: [{ name: 'Zoom', value: 'zoom' }, { name: 'Shadow', value: 'shadow' }],
      },
    ],
  },
  { name: 'help', type: 1, description: 'Everything the BrawlZone bot can do' },
];

const headers = {
  authorization: `Bot ${TOKEN}`,
  'content-type': 'application/json',
  'user-agent': 'BrawlZone (https://brawlzone.net, 1.0)',
};

async function call(method, path, body) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? {} : res.json();
}

await call('PATCH', '/applications/@me', { interactions_endpoint_url: ENDPOINT });
console.log(`endpoint set and verified: ${ENDPOINT}`);

await call('PATCH', '/applications/@me', {
  description: 'Brawl Stars stats in Discord: counters, the Ranked meta, best picks per map, drafts and player cards, from real sampled battles. Free, by brawlzone.net.',
  tags: ['brawl stars', 'stats', 'gaming', 'meta', 'tier list'],
  integration_types_config: {
    // View Channel + Send Messages + Embed Links (1024 + 2048 + 16384): what
    // /rewards-feed needs to post. Everything else is answered through
    // interactions and needs no permission at all.
    0: { oauth2_install_params: { scopes: ['applications.commands', 'bot'], permissions: '19456' } },
    1: { oauth2_install_params: { scopes: ['applications.commands'], permissions: '0' } },
  },
});
console.log(`install link: https://discord.com/oauth2/authorize?client_id=${APP}`);

// A command's own integration types and contexts win: /rewards-feed is servers only.
const everywhere = COMMANDS.map((c) => ({ integration_types: [0, 1], contexts: [0, 1, 2], ...c }));
const registered = await call('PUT', `/applications/${APP}/commands`, everywhere);
await call('PUT', `/applications/${APP}/guilds/${GUILD}/commands`, []);
for (const c of registered) console.log(`  /${c.name} — ${c.description}`);
