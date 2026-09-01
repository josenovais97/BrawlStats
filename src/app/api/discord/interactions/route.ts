import { after } from 'next/server';

import { brawlerPortraitUrl } from '@/lib/brawlapi';
import { getPlayer } from '@/lib/bs-api';
import { verifyDiscordRequest } from '@/lib/discord-verify';
import { formatNumber, formatPercent, titleCase } from '@/lib/format';
import { computeSkillScore } from '@/lib/skill-score';
import { assignTierFromScore, getBrawlerStat, metaScore, normalizeWinRate } from '@/lib/stats';
import { normalizeTag } from '@/lib/tags';
import { getBrawlerArtMap } from '@/lib/brawler-catalog';

/**
 * Slash commands, over HTTP rather than a gateway connection.
 *
 * Discord will POST an interaction here instead of this box holding a
 * WebSocket open forever. That matters on two shared cores: a gateway client
 * is a process that must stay alive, reconnect, and be supervised, and it buys
 * nothing for commands. The one thing it would buy is reacting to ordinary
 * messages — which is why `#profile-reviews` is a forum with `/profile`
 * rather than a channel watching for raw tags.
 *
 * Every command defers first. Discord gives an endpoint three seconds to
 * answer, and a cold player lookup against the game API can exceed that on its
 * own; `after()` finishes the work once the deferral is already sent and edits
 * the reply in place.
 */

export const dynamic = 'force-dynamic';

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY ?? '';
const APP_ID = process.env.DISCORD_APP_ID ?? '';
const SITE = 'https://brawlzone.net';
const BRAND = 0xffc93c;

type Embed = Record<string, unknown>;

/** Edits the deferred reply. The token is valid for 15 minutes. */
async function respond(token: string, body: { content?: string; embeds?: Embed[] }) {
  await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${token}/messages/@original`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  }).catch(() => undefined);
}

function optionValue(options: unknown, name: string): string | undefined {
  if (!Array.isArray(options)) return undefined;
  const hit = options.find((o) => (o as { name?: string }).name === name);
  return (hit as { value?: string } | undefined)?.value;
}

async function profileCommand(token: string, rawTag: string) {
  const tag = normalizeTag(rawTag);
  if (!tag) {
    await respond(token, { content: 'That does not look like a player tag. Try `/profile 2RLCPVGUG`.' });
    return;
  }

  const player = await getPlayer(tag).catch(() => null);
  if (!player) {
    await respond(token, {
      content: `No player found for \`#${tag}\`. Tags are made of the characters 0289PYLQGRJCUV — check for typos.`,
    });
    return;
  }

  const brawlers = player.brawlers ?? [];
  const skill = computeSkillScore(player, brawlers.length || undefined);
  const maxed = brawlers.filter((b) => b.power >= 11).length;

  await respond(token, {
    embeds: [
      {
        title: `${player.name ?? tag}`,
        url: `${SITE}/player/${tag}`,
        description: `Skill score **${skill.score.toFixed(1)}/10** · ${skill.tier}${
          skill.rankedUnavailable ? '\n-# No Ranked elo recorded, so the score is weighted without it.' : ''
        }`,
        color: BRAND,
        fields: [
          { name: 'Trophies', value: formatNumber(player.trophies ?? 0), inline: true },
          { name: 'Highest', value: formatNumber(player.highestTrophies ?? 0), inline: true },
          { name: '3v3 wins', value: formatNumber(player['3vs3Victories'] ?? 0), inline: true },
          { name: 'Brawlers', value: `${brawlers.length}`, inline: true },
          { name: 'At power 11', value: `${maxed}`, inline: true },
          { name: 'Club', value: player.club?.name || 'None', inline: true },
        ],
        footer: { text: 'brawlzone.net · full profile, roster gaps and progression on the site' },
      },
    ],
  });
}

async function tierCommand(token: string, query: string) {
  const map = await getBrawlerArtMap().catch(() => new Map());
  const needle = query.trim().toLowerCase();
  const match = [...map.values()].find(
    (b) => b.name.toLowerCase() === needle || b.name.toLowerCase().startsWith(needle),
  );
  if (!match) {
    await respond(token, { content: `No brawler called “${query}”. Try \`/tier brock\`.` });
    return;
  }

  const row = await getBrawlerStat(match.id).catch(() => null);
  if (!row) {
    await respond(token, {
      content: `**${titleCase(match.name)}** has no sampled data yet. All brawlers: ${SITE}/brawlers`,
    });
    return;
  }

  const adjusted = normalizeWinRate(row.winRate, row.baselineWinRate, row.decidedSampleSize);
  const score = metaScore(adjusted, row.usageRate);
  const tier = assignTierFromScore(score);

  await respond(token, {
    embeds: [
      {
        title: titleCase(match.name),
        url: `${SITE}/brawlers/${match.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        description:
          tier === null
            ? 'Not enough sampled battles to rate this brawler yet.'
            : `**${tier} tier** in Ranked · meta score **${score?.toFixed(1)}**`,
        color: BRAND,
        thumbnail: { url: brawlerPortraitUrl(match.id) },
        fields: [
          { name: 'Adjusted win rate', value: formatPercent(adjusted), inline: true },
          { name: 'Pick rate', value: formatPercent(row.usageRate), inline: true },
          { name: 'Decided battles', value: formatNumber(row.decidedSampleSize), inline: true },
        ],
        footer: { text: 'brawlzone.net · Ranked and ladder are scored separately' },
      },
    ],
  });
}

async function draftCommand(token: string) {
  await respond(token, {
    embeds: [
      {
        title: 'Draft helper',
        url: `${SITE}/draft`,
        description:
          'Pick the map, name what the enemy took, and the list reorders around both — scored from sampled Ranked battles rather than opinion.',
        color: BRAND,
        footer: { text: 'brawlzone.net' },
      },
    ],
  });
}

export async function POST(request: Request): Promise<Response> {
  // The raw text, not parsed JSON: the signature covers these exact bytes, so
  // re-serialising would change them and every check would fail.
  const body = await request.text();

  const valid = verifyDiscordRequest(
    PUBLIC_KEY,
    request.headers.get('x-signature-ed25519'),
    request.headers.get('x-signature-timestamp'),
    body,
  );
  // Discord probes this deliberately with bad signatures and refuses the
  // endpoint unless they come back 401.
  if (!valid) return new Response('invalid request signature', { status: 401 });

  const interaction = JSON.parse(body) as {
    type: number;
    token: string;
    data?: { name?: string; options?: unknown };
  };

  if (interaction.type === 1) {
    return Response.json({ type: 1 });
  }

  if (interaction.type === 2) {
    const name = interaction.data?.name;
    const options = interaction.data?.options;
    const token = interaction.token;

    after(async () => {
      try {
        if (name === 'profile') await profileCommand(token, optionValue(options, 'tag') ?? '');
        else if (name === 'tier') await tierCommand(token, optionValue(options, 'brawler') ?? '');
        else if (name === 'draft') await draftCommand(token);
        else await respond(token, { content: 'Unknown command.' });
      } catch {
        await respond(token, { content: 'Something went wrong looking that up. Try again shortly.' });
      }
    });

    // 5 = deferred reply: Discord shows "BrawlZone is thinking…" until the
    // edit above lands.
    return Response.json({ type: 5 });
  }

  return Response.json({ type: 1 });
}
