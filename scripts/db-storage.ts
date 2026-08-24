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

/**
 * What Neon itself thinks the project costs, which is not what Postgres says.
 *
 * Neon bills data plus retained WAL, and only the first half is visible from
 * inside the database — so `pg_database_size` can read 298 MB while the console
 * shows 98% of the plan and both are correct. That gap cost real time to
 * diagnose on 2026-08-24: the fix in the end was the project's history
 * retention, a control-plane setting no SQL query can see.
 *
 * So when a key is available this prints the authoritative numbers next to the
 * local ones. Optional on purpose — a NEON_API_KEY is a broader credential than
 * a connection string, and nothing else in this script needs it.
 *
 * `synthetic_storage_size` is the figure the plan is measured against.
 * `history_retention_seconds` is the lever: on a database whose every row is
 * re-derivable, a long window is pure cost.
 */
async function reportNeonStorage(): Promise<void> {
  const key = process.env.NEON_API_KEY;
  if (!key) {
    console.log('  (set NEON_API_KEY to also show Neon\'s own storage + history figures)');
    return;
  }

  const api = async (path: string) => {
    const res = await fetch(`https://console.neon.tech/api/v2/${path}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return res.json();
  };

  try {
    // Vercel-managed orgs require the org id even to list projects.
    const orgs = await api('users/me/organizations');
    const orgId = orgs.organizations?.[0]?.id;
    const list = await api(`projects${orgId ? `?org_id=${orgId}` : ''}`);
    const summary = list.projects?.[0];
    if (!summary) return;

    const { project } = await api(`projects/${summary.id}`);
    const retention = project.history_retention_seconds ?? 0;
    const storage = project.synthetic_storage_size ?? 0;

    console.log(
      `neon "${project.name}": ${mb(storage)} billed storage · ` +
        `history retention ${(retention / 3600).toFixed(2)}h · ` +
        `period ends ${String(project.consumption_period_end).slice(0, 10)}`,
    );
    if (retention > 6 * 3600) {
      console.log(
        '  NOTE: retention above 6h. Retained WAL is billed, and this project' +
          '\n  writes ~250 MB of it a day, so this can dominate the plan.',
      );
    }
  } catch (err) {
    console.log(`  (neon api unavailable: ${err instanceof Error ? err.message : 'error'})`);
  }
}

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
        `(${((before / STORAGE_LIMIT_BYTES) * 100).toFixed(0)}%)`,
    );

    await reportNeonStorage();
    console.log('');

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

    /*
     * Dead space counts as reclaimable, not just free space.
     *
     * Right after a large prune the deleted rows are *dead*, not *free*:
     * nothing is reusable until a vacuum processes them, so `free_percent`
     * alone reads near zero on a table that was just halved. Judging on that
     * would skip exactly the table the prune had emptied — which is the moment
     * this script is most likely to be run. Both halves are reclaimable, so
     * both count.
     */
    const bloated: { name: string; bytes: number; wasted: number }[] = [];
    console.log('\nreclaimable space inside tables (free + not-yet-vacuumed)');
    for (const t of tables) {
      if (Number(t.total_bytes) < 8 * 1024 * 1024) continue;
      const { rows } = await client.query<{
        free_percent: number;
        dead_tuple_percent: number;
      }>('SELECT free_percent, dead_tuple_percent FROM pgstattuple($1)', [t.relname]);
      const wasted = rows[0].free_percent + rows[0].dead_tuple_percent;
      console.log(
        `  ${t.relname.padEnd(28)}${wasted.toFixed(1).padStart(6)}%` +
          `  (free ${rows[0].free_percent.toFixed(1)}%, dead ${rows[0].dead_tuple_percent.toFixed(1)}%)`,
      );
      if (wasted >= BLOAT_THRESHOLD_PERCENT) {
        bloated.push({ name: t.relname, bytes: Number(t.heap_bytes), wasted });
      }
    }
    // Smallest first, for the same reason the indexes are: a rewrite needs room
    // for a second copy of the table, and each one finished frees space for the
    // next. On a database this close to its ceiling that ordering is what keeps
    // the peak under the limit.
    bloated.sort((a, b) => a.bytes - b.bytes);

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

    /*
     * A plain VACUUM before anything else, because it is free.
     *
     * It rewrites nothing and takes no exclusive lock, but it turns dead rows
     * into reusable space and hands back any wholly-empty pages at the end of
     * the file. That shrinks what the rewrites below have to copy — and on a
     * table pruned down to its last few days, the emptied tail is often most
     * of the file, so this alone can do most of the work.
     */
    for (const t of bloated) {
      await client.query(`VACUUM (ANALYZE) "${t.name}"`);
    }
    const afterVacuum = await dbBytes();
    console.log(`\nvacuum: ${mb(running)} -> ${mb(afterVacuum)}`);
    running = afterVacuum;

    for (const i of looseIndexes) {
      // CONCURRENTLY so readers are never blocked. It cannot run inside a
      // transaction, which is why these are issued one statement at a time.
      await client.query(`REINDEX INDEX CONCURRENTLY "${i.indexrelname}"`);
      const now = await dbBytes();
      console.log(`reindex ${i.indexrelname}: ${mb(running)} -> ${mb(now)}`);
      running = now;
    }

    for (const t of bloated) {
      // Needs room for a second copy of the live rows. The plain vacuum and
      // the reindexes above are what make that room on a database close to its
      // ceiling.
      await client.query(`VACUUM FULL "${t.name}"`);
      const now = await dbBytes();
      console.log(`vacuum full ${t.name}: ${mb(running)} -> ${mb(now)}`);
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
