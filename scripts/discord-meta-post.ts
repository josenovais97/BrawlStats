/**
 * Posts the day's meta movement to Discord.
 *
 * The same numbers behind the tier list's "What changed" panel, in the one
 * place a person will see them without visiting: biggest riser, biggest
 * faller, and every brawler that crossed a tier. That is the whole argument
 * for the server existing — nobody else can post it, because nobody else has
 * the sample.
 *
 * Silent when nothing moved, deliberately. A bot that posts "no changes today"
 * every quiet day teaches the channel to be ignored, and then the day
 * something does move it is ignored too. Same reasoning as the panel on the
 * site, which renders nothing rather than saying it has nothing.
 *
 * Run by `brawlzone-discord.timer`. Needs `--conditions=react-server`, because
 * `lib/stats` imports `server-only`, which throws outside a server bundle.
 * No top-level await: there is no `"type": "module"`, so tsx compiles this to
 * CommonJS where that is a parse error which nothing in CI would catch.
 */
import { getBrawlerMap } from '@/lib/brawlapi';
import { buildChangeIndex, isNotable, spanLabel, tierRank } from '@/lib/meta-changes';
import { getMetaMovers } from '@/lib/stats';
import type { MetaMover } from '@/types/stats';

const WEBHOOK = process.env.DISCORD_META_WEBHOOK ?? '';
const SITE = 'https://brawlzone.net';

/** BrawlZone yellow, so the embed stripe matches the site. */
const BRAND = 0xffc93c;

function line(m: MetaMover, change: ReturnType<typeof buildChangeIndex> extends Map<number, infer C> ? C : never): string {
  const name = m.brawlerName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const sign = m.metaScoreDelta > 0 ? '+' : '';
  const bits = [`score ${sign}${m.metaScoreDelta.toFixed(1)}`];
  if (change.rankDelta !== 0) {
    bits.push(`${Math.abs(change.rankDelta)} ${Math.abs(change.rankDelta) === 1 ? 'place' : 'places'} ${change.rankDelta > 0 ? 'up' : 'down'}`);
  }
  if (change.crossedTier) bits.push(`**${change.tierBefore} → ${change.tierNow}**`);
  return `${change.scoreDelta > 0 ? '▲' : '▼'} **${name}** — ${bits.join(', ')}`;
}

async function main(): Promise<void> {
  if (!WEBHOOK) {
    console.error('DISCORD_META_WEBHOOK is not set; nothing to post to.');
    process.exitCode = 1;
    return;
  }

  /*
   * Deliberately NOT wrapped in a `.catch` that returns an empty list. That is
   * what hid the first version's real failure: every call was throwing, the
   * empty result read as "nothing moved", and the bot reported a quiet meta
   * every day while being completely broken. A throw here fails the systemd
   * unit, which is what `OnFailure=brawlzone-alert@` exists for.
   */
  const movers: MetaMover[] = await getMetaMovers(7);
  const changes = buildChangeIndex(movers);
  const notable = movers.filter((m) => {
    const c = changes.get(m.brawlerId);
    return c ? isNotable(c) : false;
  });

  if (notable.length === 0) {
    console.log('Nothing moved enough to be worth a post.');
    return;
  }

  const span = spanLabel(movers[0].fromDate, movers[0].toDate);
  const riser = notable.reduce((b, m) => (m.metaScoreDelta > b.metaScoreDelta ? m : b));
  const faller = notable.reduce((w, m) => (m.metaScoreDelta < w.metaScoreDelta ? m : w));
  const crossings = notable.filter((m) => changes.get(m.brawlerId)!.crossedTier);
  const promoted = crossings.filter(
    (m) => tierRank(changes.get(m.brawlerId)!.tierNow) < tierRank(changes.get(m.brawlerId)!.tierBefore),
  );

  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (riser.metaScoreDelta > 0) {
    fields.push({ name: 'Biggest riser', value: line(riser, changes.get(riser.brawlerId)!), inline: false });
  }
  if (faller.metaScoreDelta < 0) {
    fields.push({ name: 'Biggest faller', value: line(faller, changes.get(faller.brawlerId)!), inline: false });
  }
  if (crossings.length > 0) {
    // Capped: a balance patch can move a dozen at once, and an embed field is
    // limited to 1024 characters.
    const shown = crossings
      .slice(0, 8)
      .map((m) => line(m, changes.get(m.brawlerId)!))
      .join('\n');
    const more = crossings.length > 8 ? `\n…and ${crossings.length - 8} more` : '';
    fields.push({
      name: `Tier changes (${crossings.length}: ${promoted.length} up, ${crossings.length - promoted.length} down)`,
      value: shown + more,
      inline: false,
    });
  } else {
    fields.push({
      name: 'Tier changes',
      value: `None — every brawler held its tier. ${notable.length} moved within one.`,
      inline: false,
    });
  }

  // Thumbnail is the riser's portrait, which makes the post scannable in a
  // feed before a word of it is read.
  const art = await getBrawlerMap()
    .then((m) => m.get(riser.brawlerId)?.imageUrl)
    .catch(() => undefined);

  const body = {
    username: 'BrawlZone',
    embeds: [
      {
        title: 'What changed in Ranked',
        url: `${SITE}/tier-list/ranked`,
        description: `Against the last comparable snapshot, ${span}. Sampled from real battles every two hours.`,
        color: BRAND,
        fields,
        thumbnail: art ? { url: art } : undefined,
        footer: { text: 'brawlzone.net · Ranked and ladder are scored separately' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`Discord rejected the post: HTTP ${res.status} ${await res.text()}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Posted: ${notable.length} notable movers, ${crossings.length} tier change(s).`);
}

void main();
