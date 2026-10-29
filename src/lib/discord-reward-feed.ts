/**
 * Free rewards posted into other people's Discord servers (2026-10-29).
 *
 * A server admin runs `/rewards-feed setup #channel` once; from then on every
 * batch `brawlzone-rewards` finds is posted there too, by
 * `scripts/discord-reward-feeds.ts`. Server owners look for bots that post
 * free stuff, and every post names brawlzone.net to that server's members.
 *
 * Pure message building and one REST call, so the interactions route and the
 * job's script share it and the message can be tested without Discord.
 */

const API = 'https://discord.com/api/v10';
const SITE = 'https://brawlzone.net';

export interface FeedReward {
  name: string;
  url: string;
}

/** Three failed posts in a row and the channel is dropped: kicked, deleted or muted. */
export const FEED_GONE_AFTER = 3;

/** "1x Chaos Drop" is a Chaos Drop; "2000 Credits" keeps its number. */
export function rewardTitle(name: string): string {
  return name.replace(/^\s*1\s*[x×]\s*/i, '').trim();
}

/**
 * Manage Server (0x20) or Administrator (0x8), from the interaction's
 * `member.permissions` bitfield string. The command is also hidden from
 * everyone else by `default_member_permissions`, but a server can override
 * that, and the check is what decides.
 */
export function canManageServer(permissions: string | undefined): boolean {
  if (!permissions) return false;
  try {
    const bits = BigInt(permissions);
    return (bits & BigInt(0x20)) !== BigInt(0) || (bits & BigInt(0x8)) !== BigInt(0);
  } catch {
    return false;
  }
}

/**
 * The post: one embed with every claim link, the slide with the codes for
 * people on PC, and link buttons -- a button is the biggest tap target
 * Discord has, and these are Supercell's own links.
 */
export function rewardFeedMessage(rewards: FeedReward[], imageUrl: string | null) {
  const n = rewards.length;
  const lines = rewards.map((r) => `🎁 **${rewardTitle(r.name)}**: [claim it](${r.url})`).join('\n');
  const claim = rewards.slice(0, 4).map((r) => ({
    type: 2,
    style: 5,
    label: `Claim ${rewardTitle(r.name)}`.slice(0, 80),
    url: r.url,
  }));
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: n === 1 ? `🎁 Free Brawl Stars reward: ${rewardTitle(rewards[0].name)}` : `🎁 ${n} free Brawl Stars rewards`,
        description:
          `Tap ${n > 1 ? 'each link' : 'the link'} on your phone and claim it in the game while it lasts:\n\n${lines}\n\n` +
          `Every free reward in one place: ${SITE}/rewards`,
        color: 0xffc72c,
        ...(imageUrl ? { image: { url: imageUrl } } : {}),
        footer: { text: 'Official Supercell links · posted by BrawlZone, an unofficial fan project · admins: /rewards-feed stop' },
      },
    ],
    components: [{ type: 1, components: [...claim, { type: 2, style: 5, label: 'All free rewards', url: `${SITE}/rewards` }].slice(0, 5) }],
  };
}

export type FeedResult = 'sent' | 'gone' | 'failed';

/**
 * Posts into a channel as the bot. "gone" is Discord saying it never will
 * work -- no access (50001), no permission (50013) or no channel (10003) --
 * as opposed to a hiccup worth retrying next time.
 */
export async function postToChannel(channelId: string, body: object, token: string): Promise<{ result: FeedResult; code?: number }> {
  try {
    const res = await fetch(`${API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bot ${token}`,
        'content-type': 'application/json',
        'user-agent': 'BrawlZone (https://brawlzone.net, 1.0)',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { result: 'sent' };
    const err = (await res.json().catch(() => null)) as { code?: number } | null;
    const gone = res.status === 403 || res.status === 404 || [10003, 50001, 50013].includes(err?.code ?? 0);
    return { result: gone ? 'gone' : 'failed', code: err?.code };
  } catch {
    return { result: 'failed' };
  }
}
