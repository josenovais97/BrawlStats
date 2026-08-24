/**
 * Reports what the database is spending its 512 MB on, and reclaims what
 * deleting rows alone cannot.
 *
 *   npx tsx scripts/db-storage.ts           # report only
 *   npx tsx scripts/db-storage.ts --reclaim # report, then rebuild bloated storage
 *
 * Why this exists as a script rather than part of the cron job.
 *
 * Postgres does not return space to the operating system when rows are
 * deleted. `pruneOldSamples` frees pages *inside* the table files, which new
 * rows then reuse, so pruning is what stops the database growing — but the
 * files stay at their high-water mark, and a Neon plan is billed on the files.
 * Getting the space back needs `VACUUM FULL`, which rewrites the table under
 * an ACCESS EXCLUSIVE lock: every read of that table blocks until it finishes.
 * That is fine to do deliberately and wrong to do twice a day from a cron job,
 * which is why it lives here and is opt-in.
 *
 * Measured on 2026-08-24, before the daily roll-ups existed: 44.8% of
 * `player_brawler_snapshots` was free space and its 46 MB unique index was at
 * 42% leaf density — about 100 MB of a 446 MB database, reclaimable without
 * deleting a single row.
 *
 * Reindexing runs CONCURRENTLY and needs room for a second copy of the index
 * being rebuilt, so it is done smallest-first: each one finishes and frees its
 * own slack before the next and larger one starts. On a nearly-full database
 * that ordering is the difference between working and running out of room.
 *
 * Requires DATABASE_URL_UNPOOLED (or DATABASE_URL) in the environment;
 * `.env.local` is loaded automatically. The unpooled endpoint is preferred
 * because VACUUM and REINDEX want a real session, not PgBouncer.
 */

import 'dotenv/config';

import { config } from 'dotenv';
import { Client } from 'pg';

// `dotenv/config` only reads `.env`; Next.js projects keep secrets in
// `.env.local`, so load that too without clobbering real env vars.
config({ path: '.env.local' });

/** The ceiling this project is built to live under. Mirrors `lib/aggregation`. */
const STORAGE_LIMIT_BYTES = 512 * 1024 * 1024;

/** Rebuild a table only when this much of it is free space. */
const BLOAT_THRESHOLD_PERCENT = 20;

/** Rebuild an index only when its leaf pages are this empty. */
const LEAF_DENSITY_THRESHOLD = 70;

const mb = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

interface TableRow {
  relname: string;
  total_bytes: string;
  heap_bytes: string;
  index_bytes: string;
  live: string;
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is not set.');
  }

  const reclaim = process.argv.includes('--reclaim');
  // VACUUM FULL on a large table can outrun any sensible statement timeout,
  // and being killed half way through is the one outcome worth avoiding.
  const client = new Client({ connectionString, statement_timeout: 0 });
  await client.connect();

  try {
    const dbBytes = async () =>
      Number(
        (await client.query<{ bytes: string }>(
          'SELECT pg_database_size(current_database()) AS bytes',
        )).rows[0].bytes,
      );

    const before = await dbBytes();
    console.log(
      `database: ${mb(before)} of ${mb(STORAGE_LIMIT_BYTES)} ` +
        `(${((before / STORAGE_LIMIT_BYTES) * 100).toFixed(0)}%)\n`,
    );

    const { rows: tables } = await client.query<TableRow>(`
      SELECT c.relname,
             pg_total_relation_size(c.oid)::text AS total_bytes,
             pg_relation_size(c.oid)::text       AS heap_bytes,
             pg_indexes_size(c.oid)::text        AS index_bytes,
             COALESCE(s.n_live_tup, 0)::text     AS live
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC
    `);

    console.log('table                        total      heap     index      rows');
    for (const t of tables) {
      if (Number(t.total_bytes) < 64 * 1024) continue;
      console.log(
        `${t.relname.padEnd(28)}${mb(Number(t.total_bytes)).padStart(9)}` +
          `${mb(Number(t.heap_bytes)).padStart(10)}${mb(Number(t.index_bytes)).padStart(10)}` +
          `${Number(t.live).toLocaleString().padStart(10)}`,
      );
    }

    // pgstattuple reads every page, so it is only worth asking about tables
    // big enough for the answer to matter.
    await client.query('CREATE EXTENSION IF NOT EXISTS pgstattuple');

    const bloated: string[] = [];
    console.log('\nfree space inside tables');
    for (const t of tables) {
      if (Number(t.total_bytes) < 8 * 1024 * 1024) continue;
      const { rows } = await client.query<{ free_percent: number }>(
        'SELECT free_percent FROM pgstattuple($1)',
        [t.relname],
      );
      const free = rows[0].free_percent;
      console.log(`  ${t.relname.padEnd(28)}${free.toFixed(1).padStart(6)}%`);
      if (free >= BLOAT_THRESHOLD_PERCENT) bloated.push(t.relname);
    }

    // Smallest first: each rebuild frees its own slack before the next starts.
    const { rows: indexes } = await client.query<{
      indexrelname: string;
      bytes: string;
      density: number;
    }>(`
      SELECT i.indexrelname, pg_relation_size(i.indexrelid)::text AS bytes,
             (pgstatindex(i.indexrelid::regclass::text)).avg_leaf_density AS density
      FROM pg_stat_user_indexes i
      JOIN pg_index x ON x.indexrelid = i.indexrelid
      WHERE i.schemaname = 'public'
        AND pg_relation_size(i.indexrelid) > 4 * 1024 * 1024
        AND x.indisvalid
      ORDER BY pg_relation_size(i.indexrelid) ASC
    `);

    const looseIndexes = indexes.filter((i) => i.density < LEAF_DENSITY_THRESHOLD);
    console.log('\nindex leaf density (lower is more wasted space)');
    for (const i of indexes) {
      console.log(
        `  ${i.indexrelname.padEnd(60)}${i.density.toFixed(1).padStart(6)}%` +
          `${mb(Number(i.bytes)).padStart(10)}`,
      );
    }

    if (!reclaim) {
      console.log(
        `\n${looseIndexes.length} index(es) and ${bloated.length} table(s) worth rebuilding.` +
          '\nRe-run with --reclaim to rebuild them. Reindexing is online; the table' +
          '\nrewrites block reads of that table while they run.',
      );
      return;
    }

    let running = before;
    for (const i of looseIndexes) {
      // CONCURRENTLY so readers are never blocked. It cannot run inside a
      // transaction, which is why these are issued one statement at a time.
      await client.query(`REINDEX INDEX CONCURRENTLY "${i.indexrelname}"`);
      const now = await dbBytes();
      console.log(`reindex ${i.indexrelname}: ${mb(running)} -> ${mb(now)}`);
      running = now;
    }

    for (const table of bloated) {
      // Needs room for a second copy of the live rows. Reindexing first is
      // what makes that room on a database close to its ceiling.
      await client.query(`VACUUM FULL "${table}"`);
      const now = await dbBytes();
      console.log(`vacuum full ${table}: ${mb(running)} -> ${mb(now)}`);
      running = now;
    }

    console.log(
      `\ndatabase: ${mb(before)} -> ${mb(running)} ` +
        `(${((running / STORAGE_LIMIT_BYTES) * 100).toFixed(0)}% of the ceiling)`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
