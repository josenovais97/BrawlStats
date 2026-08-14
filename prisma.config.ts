import 'dotenv/config';
import { defineConfig } from 'prisma/config';

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
