/**
 * Runs a sampling pass directly, without going through the deployed site.
 *
 *   npm run stats:refresh
 *
 * Why this exists rather than `curl /api/cron/refresh-stats`.
 *
 * The work was always a batch job wearing an HTTP route: `runAggregation` takes
 * no request, returns a plain object, and nothing about it needs a web server.
 * It ran on Vercel only because that is where the cron trigger lived — and a
 * Vercel Function is the most expensive place this project can put CPU. On the
 * Hobby plan the sampler measured ~184s a run at eight runs a day, which is
 * ~12.3 hours a month against a 4-hour Fluid Active CPU allowance: the batch
 * job alone could exceed the whole plan before a single page was rendered.
 *
 * The trigger already ran on GitHub Actions. This moves the *work* to the same
 * runner, where the minutes are free and the 300-second ceiling does not exist.
 *
 * Requires DATABASE_URL and BRAWL_STARS_API_KEY in the environment;
 * `.env.local` is loaded automatically for local runs. In CI they come from
 * repository secrets.
 *
 * Must run with `--conditions=react-server`. `lib/aggregation` reaches
 * `lib/stats` and `lib/bs-api`, both of which `import 'server-only'`, and that
 * package is a deliberate throw outside a server bundle. The condition is what
 * resolves it to the empty module instead — the same flag `npm test` uses.
 */

import 'dotenv/config';

import { config } from 'dotenv';

// `dotenv/config` only reads `.env`; Next.js projects keep secrets in
// `.env.local`, so load that too without clobbering real env vars.
config({ path: '.env.local' });

/*
 * Prefer the direct endpoint over the pooled one.
 *
 * `lib/prisma` reads DATABASE_URL and nothing else, so the choice has to be
 * made here, before its client is constructed. Neon's pooled URL fronts
 * PgBouncer, which exists for serverless callers opening a connection per
 * request — the opposite of this job, which holds one connection for minutes
 * and runs the roll-up's large `INSERT INTO ... SELECT` statements through it.
 * `scripts/db-storage.ts` makes the same choice for the same reason.
 *
 * Falls back to DATABASE_URL, so setting only that still works.
 */
const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (connectionString) process.env.DATABASE_URL = connectionString;

function requireEnv(name: string, hint: string): void {
  if (process.env[name]) return;
  console.error(`::error::${name} is not set. ${hint}`);
  process.exit(1);
}

const SECRETS_HINT =
  'In CI, add it under Settings -> Secrets and variables -> Actions -> New repository secret.';

requireEnv('DATABASE_URL', `Set DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL. ${SECRETS_HINT}`);
requireEnv('BRAWL_STARS_API_KEY', SECRETS_HINT);

/*
 * Imported after the environment is settled, not at the top of the file.
 *
 * `lib/prisma` captures the connection string when its client is first
 * constructed, so a static import would hoist above the `config()` calls and
 * the override just above, and capture whatever was there before.
 */
const { runAggregation } = await import('@/lib/aggregation');

const started = Date.now();
const result = await runAggregation();
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log(JSON.stringify(result, null, 2));
console.log(`\nCompleted in ${seconds}s.`);

/*
 * The checks below were bash in the workflow, reading this object back out of
 * an HTTP response. They live here now because this is where the object is —
 * and because a green run that did nothing is the failure mode that actually
 * costs something here.
 *
 * `status: 'partial'` is deliberately not one of them: roughly 30 of 1,000
 * sampled tags 404 on any given run (deleted accounts), so partial is the
 * normal state, and alerting on it would train everyone to ignore this job.
 */

if (result.status === 'failed') {
  console.error(`::error::Sampling run completed but sampled no players at all. ${result.notes ?? ''}`);
  process.exit(1);
}

/*
 * The expensive one. `pruneOldSamples` refuses to delete raw days that were
 * never folded, so a roll-up that keeps failing parks the prune while the
 * sampler keeps writing — about 35 MB/day, roughly a week to a full database,
 * with nothing else to announce it.
 */
if (result.notes?.includes('roll-up FAILED')) {
  console.error(
    '::error::Roll-up failed. The prune is now parked and raw rows will accumulate (~35MB/day, ~1 week to full). See aggregation_runs.notes.',
  );
  process.exit(1);
}

// The same failure caught from the other side, in case the roll-up returns
// cleanly but writes nothing: new battles always move a day's watermark, so
// folding them can never legitimately yield zero rows.
if (result.battlesRecorded > 0 && result.rolledUp === 0) {
  console.error(
    `::error::Recorded ${result.battlesRecorded} battles but rolled up 0 rows — the roll-up is not keeping up with the sampler.`,
  );
  process.exit(1);
}

process.exit(0);
