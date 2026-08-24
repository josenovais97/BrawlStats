import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
const { default: pg } = await import('pg');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });
await c.connect();
const q = async (s) => (await c.query(s)).rows;
const gb = (b) => (Number(b) / 1073741824).toFixed(3) + ' GB';
console.log('now (UTC):', new Date().toISOString());
console.log('pg_database_size :', gb((await q(`SELECT pg_database_size(current_database()) b`))[0].b));
console.log('sum all databases:', gb((await q(`SELECT SUM(pg_database_size(datname)) b FROM pg_database`))[0].b));
console.log('\nper-database:');
console.table(await q(`SELECT datname, pg_size_pretty(pg_database_size(datname)) size FROM pg_database ORDER BY pg_database_size(datname) DESC`));
console.log('\nWAL / history signals:');
console.table(await q(`SELECT name, setting, unit FROM pg_settings
  WHERE name IN ('wal_level','max_wal_size','wal_keep_size','neon.max_cluster_size','archive_timeout','full_page_writes')`));
await c.end();
