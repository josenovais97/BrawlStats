/**
 * Registers the slash commands, and points Discord at the interactions route.
 *
 * Run once after changing a command's name, description or options — Discord
 * stores these, so editing the handler alone changes nothing a user sees.
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
const ENDPOINT = 'https://brawlzone.net/api/discord/interactions';

if (!TOKEN || !APP) {
  console.error('DISCORD_BOT_TOKEN and DISCORD_APP_ID must be set.');
  process.exit(1);
}

const COMMANDS = [
  {
    name: 'profile',
    type: 1,
    description: 'Look up a Brawl Stars player: skill score, trophies and roster',
    options: [
      {
        name: 'tag',
        type: 3,
        required: true,
        description: 'Player tag, with or without the # (e.g. 2RLCPVGUG)',
      },
    ],
  },
  {
    name: 'tier',
    type: 1,
    description: 'How a brawler is performing in Ranked right now',
    options: [
      { name: 'brawler', type: 3, required: true, description: 'Brawler name (e.g. brock)' },
    ],
  },
  { name: 'draft', type: 1, description: 'Open the draft helper' },
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

const registered = await call('PUT', `/applications/${APP}/commands`, COMMANDS);
for (const c of registered) console.log(`  /${c.name} — ${c.description}`);
