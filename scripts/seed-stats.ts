/**
 * Seeds the sampling pool without running a full aggregation.
 *
 * Useful right after provisioning Neon: it fills `sampled_players` from the
 * global leaderboard and top club rosters so the first cron run has a pool to
 * walk through instead of spending its budget on seeding.
 *
 *   npm run db:seed
 *
 * Requires DATABASE_URL and BRAWL_STARS_API_KEY in the environment
 * (`.env.local` is loaded automatically).
 */

import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

import { PrismaClient } from '../src/generated/prisma/client';

// `dotenv/config` only reads `.env`; Next.js projects keep secrets in
// `.env.local`, so load that too without clobbering real env vars.
config({ path: '.env.local' });

const API_BASE = process.env.BRAWL_STARS_API_BASE ?? 'https://bsproxy.royaleapi.dev/v1';

interface RankedPlayer {
  tag: string;
  name: string;
  trophies: number;
}

interface RankedClub {
  tag: string;
}

interface ClubDetail {
  members?: { tag: string; name: string; trophies: number }[];
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, '').toUpperCase();
}

async function api<T>(path: string): Promise<T> {
  const key = process.env.BRAWL_STARS_API_KEY;
  if (!key) throw new Error('BRAWL_STARS_API_KEY is not set');

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  return (await res.json()) as T;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — provision Neon before seeding.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const candidates = new Map<string, { name: string; trophies: number; source: string }>();

    console.log('Fetching global player rankings...');
    const players = await api<{ items: RankedPlayer[] }>(
      '/rankings/global/players?limit=200',
    );
    for (const p of players.items) {
      candidates.set(normalizeTag(p.tag), {
        name: p.name,
        trophies: p.trophies,
        source: 'ranking',
      });
    }
    console.log(`  ${players.items.length} players`);

    console.log('Fetching top club rosters...');
    const clubs = await api<{ items: RankedClub[] }>('/rankings/global/clubs?limit=20');
    for (const club of clubs.items) {
      try {
        const detail = await api<ClubDetail>(
          `/clubs/${encodeURIComponent(`#${normalizeTag(club.tag)}`)}`,
        );
        for (const member of detail.members ?? []) {
          const tag = normalizeTag(member.tag);
          if (!candidates.has(tag)) {
            candidates.set(tag, {
              name: member.name,
              trophies: member.trophies,
              source: 'club',
            });
          }
        }
      } catch (err) {
        console.warn(`  skipped club ${club.tag}: ${(err as Error).message}`);
      }
    }

    const { count } = await prisma.sampledPlayer.createMany({
      data: [...candidates.entries()].map(([tag, meta]) => ({ tag, ...meta })),
      skipDuplicates: true,
    });

    const total = await prisma.sampledPlayer.count();
    console.log(`\nInserted ${count} new tags (${total} in the pool).`);
    console.log(
      'Now trigger the aggregation to collect battle samples:\n' +
        '  curl -X POST -H "Authorization: Bearer $CRON_SECRET" \\\n' +
        '    http://localhost:3000/api/cron/refresh-stats',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
