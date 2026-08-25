import 'dotenv/config';

import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// `dotenv/config` only reads `.env`; Next.js projects keep secrets in
// `.env.local`, so load that too without clobbering real env vars. Every other
// script in this repo does the same — without it, `prisma migrate deploy` on a
// developer machine fails with "datasource.url property is required" even
// though the URL is sitting right there in .env.local.
config({ path: '.env.local' });

/**
 * Prisma 7 reads the migration connection URL from here rather than from
 * schema.prisma. At runtime the client gets its connection from the driver
 * adapter in src/lib/prisma.ts instead.
 *
 * Migrations run over the *unpooled* connection. Neon's pooled endpoint is
 * PgBouncer in transaction mode, which does not hold the session state that
 * migrations rely on (advisory locks, prepared statements across a DDL
 * transaction). The Neon integration injects `DATABASE_URL_UNPOOLED` on Vercel
 * and `vercel env pull` brings it down locally; the pooled URL is the fallback
 * for setups that only have one.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL'],
  },
});
